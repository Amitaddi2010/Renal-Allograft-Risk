"""
crosscheck_hlar.py — compare our eplet reference against hlaR's.

    python tools/crosscheck_hlar.py <dir with hlaR ref CSVs>

hlaR (Zhang, Johnson & Larsen; Emory; MIT licence; CRAN + github.com/LarsenLab/hlaR)
ships the HLAMatchmaker v3 eplet tables as CSV. Our engine derives the same
tables independently, by parsing the ABC / DRDQDP .xlsb workbooks. Comparing the
two is the only independent check available on the eplet reference: agreement is
evidence the parse is right, and any disagreement is worth knowing before a viva.

The hlaR CSVs are laid out as cells: one row per eplet cell, one column per
allele, the value being the eplet name carried by that allele in that cell.
"""
import csv
import json
import os
import sys

TOOLS = os.path.dirname(os.path.abspath(__file__))
FILES = {
    'classI': 'MHC_I_eplet_v3.csv',
    'classIIB': 'MHC_II_eplet_B_v3.csv',
    'classIIA': 'MHC_II_eplet_A_v3.csv',
}


def load_hlar(path):
    """allele -> set of eplet names."""
    out = {}
    with open(path, newline='', encoding='utf-8-sig') as fh:
        rows = list(csv.reader(fh))
    header = rows[0]
    alleles = header[2:]
    for a in alleles:
        out[a.strip()] = set()
    for row in rows[1:]:
        for i, val in enumerate(row[2:]):
            v = (val or '').strip()
            if v:
                out[alleles[i].strip()].add(v)
    return out


def load_ours(ref, key):
    """allele -> set of eplet names, from the generated reference."""
    block = ref[key]
    eplets = block['eplets']
    cells = block['cells']
    out = {}
    for allele, cell_ids in block['alleles'].items():
        names = set()
        for ci in cell_ids:
            cell = cells[ci]
            names.add(eplets[cell[1]])
        out[allele] = names
    return out


def compare(ours, theirs, label):
    shared = sorted(set(ours) & set(theirs))
    only_ours = sorted(set(ours) - set(theirs))
    only_theirs = sorted(set(theirs) - set(ours))

    identical, differing, diff_examples = 0, 0, []
    extra_total = missing_total = 0
    for a in shared:
        o, t = ours[a], theirs[a]
        if o == t:
            identical += 1
            continue
        differing += 1
        extra = sorted(o - t)
        missing = sorted(t - o)
        extra_total += len(extra)
        missing_total += len(missing)
        if len(diff_examples) < 6:
            diff_examples.append((a, extra[:5], missing[:5]))

    print('\n=== %s ===' % label)
    print('  alleles in both references : %d' % len(shared))
    print('  identical eplet set        : %d (%.2f%%)'
          % (identical, 100.0 * identical / len(shared) if shared else 0))
    print('  differing                  : %d' % differing)
    if differing:
        print('  eplets only in ours        : %d' % extra_total)
        print('  eplets only in hlaR        : %d' % missing_total)
        for a, extra, missing in diff_examples:
            print('    %-14s ours+%s hlaR+%s' % (a, extra or '-', missing or '-'))
    print('  alleles only in ours       : %d %s' % (len(only_ours), only_ours[:5]))
    print('  alleles only in hlaR       : %d %s' % (len(only_theirs), only_theirs[:5]))
    return {'shared': len(shared), 'identical': identical, 'differing': differing,
            'only_ours': len(only_ours), 'only_hlar': len(only_theirs)}


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    refdir = sys.argv[1]
    ref = json.load(open(os.path.join(TOOLS, 'hla_reference_data.json'), encoding='utf-8'))

    summary = {}
    for key, fname in FILES.items():
        path = os.path.join(refdir, fname)
        if not os.path.exists(path):
            print('missing %s' % path)
            continue
        summary[key] = compare(load_ours(ref, key), load_hlar(path), key)

    total_shared = sum(s['shared'] for s in summary.values())
    total_same = sum(s['identical'] for s in summary.values())
    print('\nOVERALL: %d of %d shared alleles carry an identical eplet set (%.2f%%)'
          % (total_same, total_shared, 100.0 * total_same / total_shared if total_shared else 0))
    return 0


if __name__ == '__main__':
    sys.exit(main())
