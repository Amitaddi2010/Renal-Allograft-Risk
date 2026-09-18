"""
build_hla_scores_reference.py — generate ../hla_scores_data.js (HED, AAMS, EMS3D residues)

    py tools/build_hla_scores_reference.py

Inputs
    tools/imgt_cache/<locus>_prot.txt   IPD-IMGT/HLA protein alignments (tools/fetch_imgt_alignments.py)

Outputs
    ../hla_scores_data.js               residues the browser needs for HED and AAMS (tracked)
    tools/hla_scores_sequences.json     full extracellular sequences for the EMS3D build (git-ignored)

What the browser scores need from IMGT
--------------------------------------
HED (Pierini & Lenz 2018; HLAdiv.net, Chowell et al. 2019)
    Class I: mature residues 2-182 (exons 2+3; residue 1 is dropped because codon 1
    straddles the exon 1/2 boundary). Class II (Lenz script, DRB1 and DQB1 only):
    beta-chain residues 6-94. Columns where the locus reference carries an alignment
    gap are removed before numbering, which is how the Lenz alignments were cut.
AAMS (Kosmoliaptsis et al. 2009, 2011, 2016)
    The whole extracellular domain. Its end is taken from the UniProt "Topological
    domain: Extracellular" annotation of each locus (EXTRACELLULAR_END below) and
    mapped onto IMGT numbering by locating the UniProt residues around that end in
    the IMGT reference allele. The Kosmoliaptsis lab has not published its residue
    range, so this is our documented choice.

Allele naming
    Two-field names only. Members of a two-field group share one protein sequence, so
    residues are merged across the group's full-resolution entries (an entry sequenced
    only over exons 2-3 is completed by a sibling that was sequenced in full).
    Alleles carrying an expression suffix (N, L, S, C, A, Q) are left out, as HLAdiv does.

Incomplete sequences
    Many alleles are known only over exons 2-3. For AAMS and the EMS3D models their
    missing residues are filled from the closest completely sequenced allele of the
    same locus (fewest differences over the known residues, same first field
    preferred). Filled residues are written in lower case, so every consumer can tell
    them apart, and HED - which only accepts upper-case amino-acid letters, exactly
    like the Lenz script - never uses them.

Encoding (hla_scores_data.js)
    Each allele is stored as its closest earlier completely sequenced allele (the
    "parent") plus the residues where it differs, plus the ranges it inherited by
    imputation. The browser decodes on demand (HLAScores.sequence()).
"""
import datetime
import json
import os
import re
import sys

import numpy as np

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(TOOLS)
CACHE = os.path.join(TOOLS, 'imgt_cache')
OUT_JS = os.path.join(ROOT, 'hla_scores_data.js')
OUT_SEQ = os.path.join(TOOLS, 'hla_scores_sequences.json')

sys.path.insert(0, TOOLS)
from fetch_imgt_alignments import parse  # noqa: E402  (same IMGT parser the molecular layer uses)

LOCI = ['A', 'B', 'C', 'DRB1', 'DRB3', 'DRB4', 'DRB5', 'DQA1', 'DQB1', 'DPA1', 'DPB1']
AA = 'ARNDCQEGHILKMFPSTWYV'
SUFFIX = re.compile(r'[NLSCAQ]$')

# UniProt reviewed entries, "Topological domain: Extracellular" end (UniProt numbering,
# signal peptide included) and the 12 residues ending there, used as the anchor.
EXTRACELLULAR_END = {
    'A':    ('P04439', 308, 'RWELSSQPTIPI'),
    'B':    ('P01889', 309, 'WEPSSQSTVPIV'),
    'C':    ('P10321', 308, 'SWEPSSQPTIPI'),
    'DRB1': ('P01911', 227, 'EWRARSESAQSK'),
    'DRB3': ('P79483', 227, 'EWRARSESAQSK'),
    'DRB4': ('P13762', 227, 'QWSARSESAQSK'),
    'DRB5': ('Q30154', 227, 'EWRAQSESAQSK'),
    'DQA1': ('P01909', 216, 'PEIPAPMSELTE'),
    'DQB1': ('P01920', 230, 'EWRAQSESAQSK'),
    'DPA1': ('P20036', 222, 'AQEPIQMPETTE'),
    'DPB1': ('P04440', 225, 'EWKAQSDSARSK'),
}

HED_RANGES = {'A': (2, 182), 'B': (2, 182), 'C': (2, 182), 'DRB1': (6, 94), 'DQB1': (6, 94)}

# Grantham R. Science 1974;185:862-864, Table 1 - the integer matrix the Lenz scripts
# (AAdistMatrix_Grantham.cnv) and therefore HLAdiv.net look up.
GRANTHAM_ORDER = 'ARNDCQEGHILKMFPSTWYV'
GRANTHAM_ROWS = [
    [0, 112, 111, 126, 195, 91, 107, 60, 86, 94, 96, 106, 84, 113, 27, 99, 58, 148, 112, 64],
    [112, 0, 86, 96, 180, 43, 54, 125, 29, 97, 102, 26, 91, 97, 103, 110, 71, 101, 77, 96],
    [111, 86, 0, 23, 139, 46, 42, 80, 68, 149, 153, 94, 142, 158, 91, 46, 65, 174, 143, 133],
    [126, 96, 23, 0, 154, 61, 45, 94, 81, 168, 172, 101, 160, 177, 108, 65, 85, 181, 160, 152],
    [195, 180, 139, 154, 0, 154, 170, 159, 174, 198, 198, 202, 196, 205, 169, 112, 149, 215, 194, 192],
    [91, 43, 46, 61, 154, 0, 29, 87, 24, 109, 113, 53, 101, 116, 76, 68, 42, 130, 99, 96],
    [107, 54, 42, 45, 170, 29, 0, 98, 40, 134, 138, 56, 126, 140, 93, 80, 65, 152, 122, 121],
    [60, 125, 80, 94, 159, 87, 98, 0, 98, 135, 138, 127, 127, 153, 42, 56, 59, 184, 147, 109],
    [86, 29, 68, 81, 174, 24, 40, 98, 0, 94, 99, 32, 87, 100, 77, 89, 47, 115, 83, 84],
    [94, 97, 149, 168, 198, 109, 134, 135, 94, 0, 5, 102, 10, 21, 95, 142, 89, 61, 33, 29],
    [96, 102, 153, 172, 198, 113, 138, 138, 99, 5, 0, 107, 15, 22, 98, 145, 92, 61, 36, 32],
    [106, 26, 94, 101, 202, 53, 56, 127, 32, 102, 107, 0, 95, 102, 103, 121, 78, 110, 85, 97],
    [84, 91, 142, 160, 196, 101, 126, 127, 87, 10, 15, 95, 0, 28, 87, 135, 81, 67, 36, 21],
    [113, 97, 158, 177, 205, 116, 140, 153, 100, 21, 22, 102, 28, 0, 114, 155, 103, 40, 22, 50],
    [27, 103, 91, 108, 169, 76, 93, 42, 77, 95, 98, 103, 87, 114, 0, 74, 38, 147, 110, 68],
    [99, 110, 46, 65, 112, 68, 80, 56, 89, 142, 145, 121, 135, 155, 74, 0, 58, 177, 144, 124],
    [58, 71, 65, 85, 149, 42, 65, 59, 47, 89, 92, 78, 81, 103, 38, 58, 0, 128, 92, 69],
    [148, 101, 174, 181, 215, 130, 152, 184, 115, 61, 61, 110, 67, 40, 147, 177, 128, 0, 37, 88],
    [112, 77, 143, 160, 194, 99, 122, 147, 83, 33, 36, 85, 36, 22, 110, 144, 92, 37, 0, 55],
    [64, 96, 133, 152, 192, 96, 121, 109, 84, 29, 32, 97, 21, 50, 68, 124, 69, 88, 55, 0],
]


def field_key(name):
    """Sort key for two-field names: A*02:01 < A*02:101 < A*10:01."""
    locus, _, rest = name.partition('*')
    return (locus, tuple(int(re.match(r'\d+', f).group()) for f in rest.split(':')))


def imgt_version(path):
    with open(path, encoding='utf-8', errors='replace') as fh:
        for line in fh:
            if line.startswith('# version:'):
                return line.split(':', 1)[1].strip()
            if not line.startswith('#'):
                break
    return 'unknown'


def numbered_columns(ref_seq, offset):
    """Alignment columns carrying a mature residue number of the locus reference.

    Columns that are a gap in the reference (insertions relative to it) get no
    number and are left out, as in the Lenz alignments."""
    cols, n = [], 0
    for i in range(offset, len(ref_seq)):
        if ref_seq[i] != '.':
            n += 1
            cols.append(i)
    return cols


def extracellular_end(locus, aligned, cols):
    """Mature IMGT residue number of the last extracellular residue (UniProt anchor).

    The motif is looked for in the locus's own alleles read at the numbered columns,
    because the DRB3/4/5 files are numbered on DRB1*01:01, which does not carry the
    DRB4 motif. One substitution is tolerated (UniProt entries are single alleles)."""
    acc, _, motif = EXTRACELLULAR_END[locus]
    own = [n for n in aligned if n.startswith(locus + '*') and not SUFFIX.search(n)]
    for name in own[:25]:
        s = aligned[name]
        numbered = ''.join(s[i] if i < len(s) else '*' for i in cols)
        for i in range(len(numbered) - len(motif) + 1):
            window = numbered[i:i + len(motif)]
            if '*' in window:
                continue
            if sum(a != b for a, b in zip(window, motif)) <= 1:
                return i + len(motif)          # 1-based number of the motif's last residue
    raise SystemExit('%s: UniProt %s anchor %s not found in the IMGT alleles' % (locus, acc, motif))


def two_field_groups(aligned):
    """{two-field name: [full names without expression suffix]} in file order."""
    groups = {}
    for name in aligned:
        if SUFFIX.search(name):
            continue
        locus, _, rest = name.partition('*')
        fields = rest.split(':')
        if len(fields) < 2:
            continue
        groups.setdefault('%s*%s:%s' % (locus, fields[0], fields[1]), []).append(name)
    return groups


def merged_sequence(members, aligned, cols):
    """Residue per numbered column, taking the first determined residue in the group."""
    out, conflicts = [], 0
    for i in cols:
        chosen = None
        for m in members:
            s = aligned[m]
            c = s[i] if i < len(s) else '*'
            if c in ('*', 'X', '-'):
                continue
            if chosen is None:
                chosen = c
            elif c != chosen:
                conflicts += 1
        out.append(chosen or '*')
    return ''.join(out), conflicts


def encode(seqs, names):
    """uint8 matrix, 0 = undetermined, 1..20 = amino acid, 21 = deletion ('.')."""
    lut = {c: k + 1 for k, c in enumerate(AA)}
    lut['.'] = 21
    arr = np.zeros((len(names), len(seqs[names[0]])), dtype=np.uint8)
    for r, n in enumerate(names):
        arr[r] = [lut.get(c, 0) for c in seqs[n]]
    return arr


def mismatch_matrix(q, t):
    """Differences between rows of q and rows of t over the positions q has determined.

    t must be fully determined. Uses one-hot matrix products (22 symbols)."""
    def onehot(a):
        n, L = a.shape
        oh = np.zeros((n, L * 22), dtype=np.float32)
        idx = (np.arange(L)[None, :] * 22 + a).astype(np.int64)
        np.put_along_axis(oh, idx, 1.0, axis=1)
        oh.reshape(n, L, 22)[:, :, 0] = 0.0          # undetermined contributes nothing
        return oh
    qo, to = onehot(q), onehot(t)
    known = (q > 0).sum(axis=1).astype(np.float32)
    same = qo @ to.T
    return known[:, None] - same


def build_locus(locus, path):
    aligned, offset = parse(path)
    order = list(aligned)
    ref_name = order[0]
    ref_seq = aligned[ref_name]
    cols = numbered_columns(ref_seq, offset)
    ext_end = extracellular_end(locus, aligned, cols)
    cols = cols[:ext_end]

    groups = two_field_groups(aligned)
    names = sorted((g for g in groups if g.split('*')[0] == locus), key=field_key)
    seqs, conflicts = {}, 0
    for g in names:
        s, c = merged_sequence(groups[g], aligned, cols)
        seqs[g] = s
        conflicts += c

    # insertion columns (gap in the reference) inside the extracellular domain
    first_col, last_col = cols[0], cols[-1]
    ins_cols = [i for i in range(first_col, last_col + 1) if ref_seq[i] == '.']
    insertions = set()
    for g in names:
        for m in groups[g]:
            s = aligned[m]
            if any(i < len(s) and s[i] not in '.*' for i in ins_cols):
                insertions.add(g)
                break

    arr = encode(seqs, names)
    complete = np.all((arr > 0) & (arr < 21), axis=1)
    comp_idx = np.where(complete)[0]
    if not len(comp_idx):
        raise SystemExit('%s: no completely sequenced allele' % locus)
    first_field = np.array([int(n.split('*')[1].split(':')[0]) for n in names])

    parent = np.full(len(names), -1, dtype=np.int64)
    # incomplete alleles: nearest complete allele, same first field preferred
    inc_idx = np.where(~complete)[0]
    for start in range(0, len(inc_idx), 2000):
        chunk = inc_idx[start:start + 2000]
        d = mismatch_matrix(arr[chunk], arr[comp_idx])
        d = d + 0.5 * (first_field[chunk][:, None] != first_field[comp_idx][None, :])
        parent[chunk] = comp_idx[np.argmin(d, axis=1)]
    # complete alleles: nearest earlier complete allele (encoding only)
    for start in range(0, len(comp_idx), 2000):
        chunk = comp_idx[start:start + 2000]
        d = mismatch_matrix(arr[chunk], arr[comp_idx])
        d[chunk[:, None] <= comp_idx[None, :]] = np.inf       # only earlier alleles
        best = np.argmin(d, axis=1)
        ok = np.isfinite(d[np.arange(len(chunk)), best])
        parent[chunk] = np.where(ok, comp_idx[best], -1)

    # full sequences with imputed residues in lower case
    full = {}
    imputed_count = {}
    for r, g in enumerate(names):
        s = seqs[g]
        if complete[r]:
            full[g] = s
            continue
        src = seqs[names[parent[r]]]
        out = []
        n_imp = 0
        for c, p in zip(s, src):
            if c in ('*', 'X'):
                out.append(p.lower())
                n_imp += 1
            else:
                out.append(c)
        full[g] = ''.join(out)
        imputed_count[g] = n_imp

    meta = {
        'imgt': imgt_version(path), 'reference': ref_name, 'extracellular_end': ext_end,
        'uniprot': EXTRACELLULAR_END[locus][0], 'alleles': len(names),
        'complete': int(complete.sum()), 'imputed': len(imputed_count),
        'group_conflicts': conflicts, 'insertions': sorted(insertions, key=field_key),
    }
    return names, full, parent, meta, imputed_count


def compact(names, full, parent):
    """Parent + differences encoding; see the module docstring."""
    ref = full[names[int(np.where(parent == -1)[0][0])]].upper()
    P, D, I = [], [], []
    for r, g in enumerate(names):
        s = full[g]
        base = ref if parent[r] == -1 else full[names[parent[r]]]
        diffs, imp, run = [], [], None
        for k, (c, b) in enumerate(zip(s, base)):
            pos = k + 1
            if c.islower():
                if run and run[1] == pos - 1:
                    run[1] = pos
                else:
                    run = [pos, pos]
                    imp.append(run)
                if c.upper() != b.upper():
                    raise SystemExit('imputed residue differs from its parent: %s %d' % (g, pos))
                continue
            if c != b.upper() or b.islower():
                diffs.append('%d%s' % (pos, c))
        P.append(int(parent[r]))
        D.append(''.join(diffs))
        I.append(','.join('%d-%d' % (a, b) if a != b else str(a) for a, b in imp))
    return ref, P, D, I


def main():
    loci_js, loci_seq, meta = {}, {}, {}
    for locus in LOCI:
        path = os.path.join(CACHE, '%s_prot.txt' % locus)
        if not os.path.exists(path):
            print('  %-5s no cached alignment (run tools/fetch_imgt_alignments.py)' % locus)
            continue
        names, full, parent, m, imputed = build_locus(locus, path)
        ref, P, D, I = compact(names, full, parent)
        loci_js[locus] = {'ref': ref, 'names': names, 'parent': P, 'diff': D, 'imputed': I}
        loci_seq[locus] = {'meta': m, 'sequences': full, 'imputed': imputed}
        meta[locus] = m
        print('  %-5s %5d alleles | extracellular 1-%d (%s) | %5d complete | %5d imputed | '
              '%d group conflicts | %d with insertions'
              % (locus, m['alleles'], m['extracellular_end'], m['uniprot'], m['complete'],
                 m['imputed'], m['group_conflicts'], len(m['insertions'])))

    versions = sorted({m['imgt'] for m in meta.values()})
    payload = {
        'meta': {
            'built': datetime.date.today().isoformat(),
            'imgt': ', '.join(versions),
            'loci': {l: {k: v for k, v in m.items() if k != 'insertions'} for l, m in meta.items()},
            'insertions': {l: m['insertions'] for l, m in meta.items() if m['insertions']},
        },
        'grantham': {'order': GRANTHAM_ORDER, 'rows': GRANTHAM_ROWS},
        'hedRanges': HED_RANGES,
        'loci': loci_js,
    }
    with open(OUT_JS, 'w', encoding='utf-8') as fh:
        fh.write('/* GENERATED by tools/build_hla_scores_reference.py - IPD-IMGT/HLA extracellular '
                 'residues for HED and AAMS (lower case = filled from the closest complete allele). '
                 'Do not edit by hand. */\n')
        fh.write('window.HLA_SCORES_DATA = ')
        json.dump(payload, fh, separators=(',', ':'))
        fh.write(';\n')
    with open(OUT_SEQ, 'w', encoding='utf-8') as fh:
        json.dump({'meta': payload['meta'], 'loci': loci_seq}, fh, separators=(',', ':'))
    print('wrote %s (%.2f MB)' % (OUT_JS, os.path.getsize(OUT_JS) / 1e6))
    print('wrote %s (%.2f MB)' % (OUT_SEQ, os.path.getsize(OUT_SEQ) / 1e6))


if __name__ == '__main__':
    sys.exit(main())
