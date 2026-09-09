"""
pirche_style.py — an offline, open-source T-cell epitope mismatch score.

    python tools/pirche_style.py --recipient "A*01:01,A*02:01,..." --donor "A*02:01,..."
    python tools/pirche_style.py --pairs scratch/hla_pairs.json --out scores.csv

WHAT THIS IS
------------
A reimplementation of the *approach* described for PIRCHE-II (Geneugelijk &
Spierings, Immunogenetics 2020): count donor-HLA-derived peptides that the
recipient's own HLA-DR molecules can present, having removed peptides the
recipient already carries in their own HLA proteins.

    1. take donor HLA alleles mismatched with the recipient
    2. slide 15-mers across their mature protein sequences (IPD-IMGT/HLA)
    3. keep peptides predicted to bind the recipient's HLA-DRB1 molecules
    4. drop any peptide that also occurs in the recipient's own HLA proteins
    5. count the distinct survivors

WHAT THIS IS NOT
----------------
It is NOT PIRCHE-II. PIRCHE-II is proprietary (PIRCHE AG) and uses NetMHCIIpan
for step 3; there is no open-source implementation of it, and none of its code
or data is used here. This script uses the TEPITOPE pocket-profile matrices
(Sturniolo et al., Nat Biotechnol 1999), which are a different, older and
coarser predictor. **The numbers will not match published PIRCHE-II values** and
must never be reported as PIRCHE-II. Treat them as an internally consistent
ranking within one cohort, not as a calibrated score.

Two further approximations, stated plainly:
  * TEPITOPE matrices exist for 10 DRB1 alleles and 1 DRB5. A query DRB1 allele
    is mapped to the reference allele with the highest identity across the
    peptide-binding domain (residues 1-90). TEPITOPEpan does this per binding
    pocket, which is finer; this is a whole-groove approximation.
  * Only HLA-DR presentation is modelled, as in PIRCHE-II's DRB1 restriction.
"""
import argparse
import csv
import json
import os
import sys

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(TOOLS)
ALIGN = os.path.join(TOOLS, 'imgt_alignments.json')
PSSM_DIR = os.path.join(TOOLS, 'tepitope')

PEPTIDE_LEN = 15
CORE_LEN = 9
AAS = 'ACDEFGHIKLMNPQRSTVWY'
DEFAULT_PERCENTILE = 3.0          # top n% of cores counted as binders
PBD_END = 90                      # DR beta peptide-binding domain, for allele matching


def load_pssms():
    """reference allele -> {position(1-9) -> {aa -> score}}; '-' columns are ignored."""
    out = {}
    if not os.path.isdir(PSSM_DIR):
        return out
    for fname in sorted(os.listdir(PSSM_DIR)):
        if not fname.endswith('.csv'):
            continue
        locus, _, rest = fname[:-4].partition('_')
        allele = '%s*%s:%s' % (locus, rest[:2], rest[2:])
        mat = {}
        with open(os.path.join(PSSM_DIR, fname), newline='', encoding='utf-8-sig') as fh:
            rows = list(csv.reader(fh))
        header = rows[0]
        for row in rows[1:]:
            aa = row[0].strip()
            if aa not in AAS:
                continue
            for col, val in zip(header[1:], row[1:]):
                v = (val or '').strip()
                if v in ('', '-'):
                    continue
                mat.setdefault(int(col), {})[aa] = float(v)
        out[allele] = mat
    return out


def load_sequences():
    """locus -> {allele -> ungapped mature protein sequence}."""
    if not os.path.exists(ALIGN):
        sys.exit('missing %s - run tools/fetch_imgt_alignments.py first' % ALIGN)
    data = json.load(open(ALIGN))
    seqs = {}
    for locus, alleles in data['loci'].items():
        offset = data['meta'][locus]['codon1_offset']
        seqs[locus] = {}
        for name, aligned in alleles.items():
            mature = aligned[offset:].replace('.', '').replace('*', '').replace('X', '')
            seqs[locus][name] = mature
    return seqs


def best_reference(drb_allele, seqs, pssms):
    """Map any DRB1/DRB5 allele to the TEPITOPE reference it most resembles."""
    locus = drb_allele.split('*')[0]
    pool = [a for a in pssms if a.split('*')[0] == locus] or list(pssms)
    query = seqs.get(locus, {}).get(drb_allele)
    if not query:
        return None, 0.0
    best, score = None, -1.0
    for cand in pool:
        cl = cand.split('*')[0]
        ref = seqs.get(cl, {}).get(cand)
        if not ref:
            continue
        n = min(len(query), len(ref), PBD_END)
        if not n:
            continue
        ident = sum(1 for i in range(n) if query[i] == ref[i]) / float(n)
        if ident > score:
            best, score = cand, ident
    return best, score


def core_scores(peptide, mat):
    """Best TEPITOPE score over the 9-mer cores of one peptide."""
    best = None
    for s in range(len(peptide) - CORE_LEN + 1):
        core = peptide[s:s + CORE_LEN]
        total = 0.0
        ok = True
        for pos in range(1, CORE_LEN + 1):
            col = mat.get(pos)
            if not col:
                continue                       # non-pocket position
            v = col.get(core[pos - 1])
            if v is None:
                ok = False
                break
            total += v
        if ok and (best is None or total > best):
            best = total
    return best


def threshold_for(mat, peptides, percentile):
    """Score cutoff = the given top percentile of this allele's own score distribution."""
    scores = [s for s in (core_scores(p, mat) for p in peptides) if s is not None]
    if not scores:
        return None
    scores.sort(reverse=True)
    idx = max(0, int(len(scores) * percentile / 100.0) - 1)
    return scores[idx]


def peptides_of(seq):
    return {seq[i:i + PEPTIDE_LEN] for i in range(len(seq) - PEPTIDE_LEN + 1)}


def parse_typing(text):
    out = {}
    for tok in str(text).replace(';', ',').split(','):
        tok = tok.strip()
        if not tok or '*' not in tok:
            continue
        out.setdefault(tok.split('*')[0], []).append(tok)
    return out


def score_pair(recipient, donor, seqs, pssms, percentile=DEFAULT_PERCENTILE):
    rec = parse_typing(recipient)
    don = parse_typing(donor)

    # recipient self-peptide pool, from every recipient HLA protein
    self_pool = set()
    for locus, alleles in rec.items():
        for a in alleles:
            s = seqs.get(locus, {}).get(a)
            if s:
                self_pool |= peptides_of(s)

    # donor peptides, from mismatched donor alleles only
    donor_pool, mismatched = set(), []
    for locus, alleles in don.items():
        recset = set(rec.get(locus, []))
        for a in alleles:
            if a in recset:
                continue
            s = seqs.get(locus, {}).get(a)
            if not s:
                continue
            mismatched.append(a)
            donor_pool |= peptides_of(s)
    candidates = sorted(donor_pool - self_pool)

    presenters, unmapped = [], []
    for a in rec.get('DRB1', []) + rec.get('DRB5', []):
        refallele, ident = best_reference(a, seqs, pssms)
        if refallele and refallele in pssms:
            presenters.append((a, refallele, ident))
        else:
            unmapped.append(a)

    total, per_dr = 0, {}
    for a, refallele, ident in presenters:
        mat = pssms[refallele]
        cutoff = threshold_for(mat, candidates, percentile)
        if cutoff is None:
            per_dr[a] = 0
            continue
        binders = {p for p in candidates if (core_scores(p, mat) or -1e9) >= cutoff}
        per_dr[a] = len(binders)
        total += len(binders)

    return {
        # a pair with no mappable DR allele is NOT a zero-epitope pair; it is
        # unevaluable, and must not be averaged in as if it scored nothing
        'evaluable': bool(presenters),
        'mismatched_donor_alleles': mismatched,
        'donor_peptides': len(donor_pool),
        'after_self_filter': len(candidates),
        'presenting_dr': [{'allele': a, 'matrix': r, 'identity': round(i, 3)}
                          for a, r, i in presenters],
        'unmapped_dr': unmapped,
        'per_dr': per_dr,
        'pirche_style_score': total,
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--recipient')
    ap.add_argument('--donor')
    ap.add_argument('--pairs', help='JSON list of {labP,labD,patient,donor}')
    ap.add_argument('--out', help='CSV output for --pairs')
    ap.add_argument('--percentile', type=float, default=DEFAULT_PERCENTILE)
    args = ap.parse_args()

    seqs = load_sequences()
    pssms = load_pssms()
    if not pssms:
        sys.exit('no TEPITOPE matrices in %s' % PSSM_DIR)
    print('TEPITOPE matrices: %s' % ', '.join(sorted(pssms)), file=sys.stderr)

    if args.pairs:
        pairs = json.load(open(args.pairs))
        rows = []
        for i, p in enumerate(pairs, 1):
            r = score_pair(p['patient'], p['donor'], seqs, pssms, args.percentile)
            rows.append({'id': p.get('id', i), 'labP': p.get('labP', ''), 'labD': p.get('labD', ''),
                         'evaluable': int(r['evaluable']),
                         'pirche_style': r['pirche_style_score'] if r['evaluable'] else '',
                         'donor_peptides': r['donor_peptides'],
                         'after_self_filter': r['after_self_filter'],
                         'presenting_dr': len(r['presenting_dr'])})
            if i % 20 == 0:
                print('  %d/%d' % (i, len(pairs)), file=sys.stderr)
        out = args.out or 'pirche_style_scores.csv'
        with open(out, 'w', newline='', encoding='utf-8') as fh:
            w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)
        vals = sorted(r['pirche_style'] for r in rows if r['pirche_style'] != '')
        skipped = len(rows) - len(vals)
        print('%d pairs -> %s | evaluable %d (median %d, range %d-%d) | not evaluable %d '
              '(no mappable DR allele)'
              % (len(rows), out, len(vals), vals[len(vals) // 2], vals[0], vals[-1], skipped))
        return 0

    if not (args.recipient and args.donor):
        ap.print_help()
        return 1
    result = score_pair(args.recipient, args.donor, seqs, pssms, args.percentile)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == '__main__':
    sys.exit(main())
