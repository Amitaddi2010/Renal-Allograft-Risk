"""
fetch_imgt_alignments.py — download and parse IMGT/HLA protein alignments.

    python tools/fetch_imgt_alignments.py            # download + parse
    python tools/fetch_imgt_alignments.py --offline  # parse whatever is cached

Writes tools/imgt_alignments.json: for every locus, the aligned mature-protein
sequence of each two-field allele, on the IMGT alignment coordinate system.

Why this file exists
--------------------
The eplet engine only knows which eplets an allele carries. Three of the
molecular-mismatch measures we want (amino-acid mismatch, physicochemical
mismatch, evolutionary divergence) need the actual residue at every polymorphic
position, which the HLAMatchmaker workbooks do not carry. IMGT/HLA publishes
exactly that, freely, and is the reference every one of those tools is built on.

Alignment format notes (the parts that bite)
--------------------------------------------
  * The first allele listed for a locus is the reference; every later line shows
    '-' where the residue matches the reference, so the reference must be
    substituted back in.
  * '*' means the position is not determined for that allele.
  * '.' is an alignment gap (an indel relative to the reference).
  * 'X' appears in some entries for an unknown residue.
  * Sequences are split across repeated blocks; each block re-lists the alleles,
    so fragments must be concatenated in file order.
  * The mature protein starts at codon 1; leader-peptide positions are numbered
    negatively and are dropped here, because none of the measures use them.
"""
import argparse
import json
import os
import re
import sys
import urllib.request

TOOLS = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(TOOLS, 'imgt_cache')
OUT = os.path.join(TOOLS, 'imgt_alignments.json')

BASE = 'https://raw.githubusercontent.com/ANHIG/IMGTHLA/Latest/alignments/%s_prot.txt'
LOCI = ['A', 'B', 'C', 'DRB1', 'DRB3', 'DRB4', 'DRB5', 'DQA1', 'DQB1', 'DPA1', 'DPB1']

ALLELE_RE = re.compile(r'^\s*([A-Z0-9]+\*[0-9:]+[A-Z]?)\s+(.*)$')


def download(locus):
    path = os.path.join(CACHE, '%s_prot.txt' % locus)
    if os.path.exists(path) and os.path.getsize(path) > 1000:
        return path
    os.makedirs(CACHE, exist_ok=True)
    url = BASE % locus
    req = urllib.request.Request(url, headers={'User-Agent': 'RAMRT-thesis-tool'})
    with urllib.request.urlopen(req, timeout=120) as r, open(path, 'wb') as f:
        f.write(r.read())
    return path


def parse(path):
    """Return (aligned sequences, codon1_offset) for one locus.

    codon1_offset is the index, inside the space-stripped alignment string, of
    mature-protein residue 1. It is read from the file's own numbering line
    rather than assumed, because the leader peptide length differs by locus:

         Prot              -30                                1
                           |                                  |
         A*01:01:01:01           MAVM APRTLLLLLS GALAL..TQT ...

    The second '|' sits above codon 1, so the number of non-space characters
    between the start of the sequence text and that column gives the offset.
    """
    frags, order = {}, []
    codon1_offset = None
    marker_cols = None
    with open(path, encoding='utf-8', errors='replace') as fh:
        for raw in fh:
            line = raw.rstrip('\n')
            stripped = line.strip()
            if stripped.startswith('Prot'):
                continue
            if marker_cols is None and set(stripped) == {'|'} or (stripped and set(stripped) <= {'|', ' '} and '|' in stripped):
                marker_cols = [i for i, c in enumerate(line) if c == '|']
                continue
            if not stripped or stripped.startswith(('#', 'Please', 'gDNA', 'cDNA', 'AA codon')):
                continue
            m = ALLELE_RE.match(line)
            if not m:
                continue
            allele, seq = m.group(1), m.group(2)
            if codon1_offset is None and marker_cols and len(marker_cols) >= 2:
                seq_start = line.index(m.group(2), len(m.group(1)))
                target = marker_cols[1]
                if target >= seq_start:
                    codon1_offset = len(line[seq_start:target].replace(' ', ''))
            seq = seq.replace(' ', '')
            if not seq:
                continue
            if allele not in frags:
                frags[allele] = []
                order.append(allele)
            frags[allele].append(seq)

    if not order:
        return {}, 0
    ref = order[0]
    ref_seq = ''.join(frags[ref])
    out = {}
    for allele in order:
        s2 = ''.join(frags[allele])
        out[allele] = ''.join(ref_seq[i] if (ch == '-' and i < len(ref_seq)) else ch
                              for i, ch in enumerate(s2))
    return out, (codon1_offset or 0)


def residue_numbers(ref_seq, offset):
    """Column index -> mature residue number, using the reference for numbering.

    Columns that are a gap in the reference are insertions relative to it; they
    keep the previous residue number so nothing is silently renumbered.
    """
    numbers, n = {}, 0
    for i in range(offset, len(ref_seq)):
        if ref_seq[i] != '.':
            n += 1
        numbers[i] = n
    return numbers


def two_field(name):
    """A*01:01:01:01 -> A*01:01 ; keeps an expression suffix off the field list."""
    locus, _, rest = name.partition('*')
    fields = rest.split(':')
    if len(fields) < 2:
        return None
    second = re.match(r'^(\d+)', fields[1])
    if not second:
        return None
    return '%s*%s:%s' % (locus, fields[0], second.group(1))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--offline', action='store_true', help='parse cached files only')
    args = ap.parse_args()

    result, meta = {}, {}
    for locus in LOCI:
        try:
            path = download(locus) if not args.offline else os.path.join(CACHE, '%s_prot.txt' % locus)
            if not os.path.exists(path):
                print('  %-6s no cached file, skipped' % locus)
                continue
            aligned, offset = parse(path)
        except Exception as exc:                       # noqa: BLE001 - report and continue
            print('  %-6s FAILED: %s' % (locus, exc))
            continue

        # collapse to two-field: keep the first (lowest) full-resolution entry,
        # which is IMGT's own representative for that protein
        collapsed = {}
        for name, seq in aligned.items():
            tf = two_field(name)
            if tf and tf not in collapsed:
                collapsed[tf] = seq
        ref_name = next(iter(collapsed))
        result[locus] = collapsed
        lengths = {len(v) for v in collapsed.values()}
        meta[locus] = {'alleles': len(collapsed), 'aligned_length': max(lengths) if lengths else 0,
                       'codon1_offset': offset, 'reference': ref_name}
        mature = ''.join(c for c in collapsed[ref_name][offset:] if c != '.')
        print('  %-6s %5d alleles | aligned %3d | codon1 offset %2d | %s mature starts %s'
              % (locus, len(collapsed), max(lengths) if lengths else 0, offset, ref_name, mature[:10]))

    json.dump({'meta': meta, 'loci': result}, open(OUT, 'w'), separators=(',', ':'))
    print('wrote %s (%.1f MB)' % (OUT, os.path.getsize(OUT) / 1e6))


if __name__ == '__main__':
    sys.exit(main())
