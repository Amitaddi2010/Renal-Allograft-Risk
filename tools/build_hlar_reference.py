"""
build_hlar_reference.py — build an MIT-licensed v3 eplet reference.

    python tools/build_hlar_reference.py <dir with hlaR ref CSVs> [--out ../hla_reference_v3.js]

Why this exists
---------------
The default reference is parsed from the HLAMatchmaker v3.1 workbooks
(ABC_Antibody_Analysis_3.1.xlsb / DRDQDP_Antibody_Analysis_3.1.xlsb). Those files
carry **no licence, no copyright notice and no terms of use**; their metadata
shows Rene Duquesnoy / UPMC, last modified mid-2020, and both distribution sites
(hlamatchmaker.net, epitopes.net) are now expired parked domains. With no grant
of rights anywhere, default copyright applies and commercial use cannot be
assumed.

hlaR (github.com/LarsenLab/hlaR, CRAN, Emory) publishes HLAMatchmaker v2/v3 eplet
tables under the **MIT licence**, which does permit commercial use with
attribution. This script converts those tables into the same structure the engine
already consumes, so the app can run on a reference whose licence is clear.

The two are NOT interchangeable: v3.1 carries substantially more eplets, and 51
eplet names present in v3 were retired by v3.1 (see validation/HLAR_CROSSCHECK.md).
Notably `130Q` and `160D`, which appear in the thesis's own Class II catalogue,
exist in v3 and not in v3.1 - so for reproducing the thesis's eplet vocabulary,
v3 is the closer match.

Attribution required by the MIT licence is emitted into the generated file.
"""
import argparse
import csv
import datetime
import json
import os
import sys

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(TOOLS)

FILES = {
    'classI': 'MHC_I_eplet_v3.csv',
    'classIIB': 'MHC_II_eplet_B_v3.csv',
    'classIIA': 'MHC_II_eplet_A_v3.csv',
}

# hlaR's `type` column -> the exact category strings the engine recognises.
# ABVER_CATS in hla_engine.js is ['Abver','AbV','AbInt','Aver'], so anything that
# should count as antibody-verified must map onto one of those spellings.
CATEGORY_MAP = {
    'classI':   {'AbV': 'Abver', 'Oth': 'Oth', 'oth': 'Oth', 'other': 'Oth', 'blank': 'Oth', '': 'Oth'},
    'classIIB': {'AbV': 'AbV', 'AbInt': 'AbInt', 'oth Int': 'Inter', 'othInt': 'Inter',
                 'oth': 'oth', 'Oth': 'oth', 'other': 'oth', 'blank': 'oth', '': 'oth'},
    'classIIA': {'AbV': 'Aver', 'oth': 'othA', 'Oth': 'othA', 'other': 'othA', 'blank': 'othA', '': 'othA'},
}
CATEGORY_LABEL = {
    'Abver': 'Antibody-verified', 'Oth': 'Not antibody-verified',
    'AbV': 'Antibody-verified', 'AbInt': 'Antibody-verified interlocus',
    'Inter': 'Interlocus (shared DR/DQ/DP)', 'oth': 'Other',
    'Aver': 'Antibody-verified (alpha chain)', 'othA': 'Other (alpha chain)',
}


def build_block(path, key):
    """hlaR cell table -> the structure hla_engine.js consumes.

    A CSV row is a *position*, not an eplet: different alleles carry different
    eplet names in the same row. The engine matches by shared cell index - it
    builds the recipient's cell set and skips any donor cell already in it - so a
    cell must be keyed by (row, eplet name) and shared by every allele carrying
    that name there. Keying per allele instead would mean no recipient and donor
    cell ever coincided, and every donor eplet would count as mismatched.
    """
    with open(path, newline='', encoding='utf-8-sig') as fh:
        rows = list(csv.reader(fh))
    header = rows[0]
    allele_names = [a.strip() for a in header[2:]]
    cmap = CATEGORY_MAP[key]

    eplet_index, eplets, eplet_cat = {}, [], []
    cat_names, cat_index = [], {}
    cells, cell_key = [], {}
    per_allele = {a: [] for a in allele_names}

    for row_i, row in enumerate(rows[1:]):
        if len(row) < 3:
            continue
        raw = (row[1] or '').strip()
        cat = cmap.get(raw, cmap.get('', 'oth'))
        if cat not in cat_index:
            cat_index[cat] = len(cat_names)
            cat_names.append(cat)

        for col, val in enumerate(row[2:]):
            name = (val or '').strip()
            if not name or col >= len(allele_names):
                continue
            if name not in eplet_index:
                eplet_index[name] = len(eplets)
                eplets.append(name)
                eplet_cat.append(cat)
            key_rc = (row_i, name)
            if key_rc not in cell_key:
                cell_key[key_rc] = len(cells)
                cells.append([row_i, eplet_index[name], cat_index[cat]])
            per_allele[allele_names[col]].append(cell_key[key_rc])

    for a in per_allele:
        per_allele[a] = sorted(set(per_allele[a]))

    # an eplet name occupying more than one row is recorded, as v3.1 does
    multi = {}
    for (row_i, name), ci in cell_key.items():
        multi.setdefault(name, []).append(ci)
    multi = {n: v for n, v in multi.items() if len(v) > 1}

    return {
        'eplets': eplets,
        'categories': cat_names,
        'cells': cells,
        'cat': eplet_cat,
        'alleles': per_allele,
        'colCount': {a: len(v) for a, v in per_allele.items()},
        'multiCategory': multi,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('refdir', help='directory holding the hlaR MHC_*_eplet_v3.csv files')
    ap.add_argument('--out', default=os.path.join(ROOT, 'hla_reference_v3.js'))
    args = ap.parse_args()

    payload = {'meta': {
        'built': datetime.date.today().isoformat(),
        'version': 'HLAMatchmaker v3 (hlaR tables)',
        'licence': 'MIT',
        'source': 'hlaR 1.0.0, Zhang J, Johnson A, Larsen CP (Emory University); '
                  'CRAN and github.com/LarsenLab/hlaR; inst/extdata/ref/MHC_*_eplet_v3.csv',
        'attribution': 'Copyright (c) 2020 Christian P. Larsen. Licensed under the MIT licence.',
        'commercial_use': 'Permitted under MIT with attribution, unlike the v3.1 workbooks, '
                          'which carry no licence at all.',
        'not_interchangeable_with': 'HLAMatchmaker v3.1 - see validation/HLAR_CROSSCHECK.md',
        'categories': CATEGORY_LABEL,
    }}

    # The immunogenic catalogue comes from PGIMER's own IE.xlsx, so it carries over.
    # The DRB3/4/5 and DQA1 linkage tables do NOT: they are parsed from the
    # Duquesnoy workbook sheets, which is exactly the unlicensed source this build
    # exists to avoid. The engine tolerates their absence (ref.drb345 || []), so
    # linked-allele inference is simply unavailable in this mode.
    base_path = os.path.join(TOOLS, 'hla_reference_data.json')
    if os.path.exists(base_path):
        base = json.load(open(base_path, encoding='utf-8'))
        payload['ie'] = base.get('ie', {'classI': [], 'classII': [], 'mapI': {}, 'mapII': {}})
        print('  ie catalogue carried over from IE.xlsx: %d class I, %d class II'
              % (len(payload['ie'].get('classI', [])), len(payload['ie'].get('classII', []))))
    else:
        payload['ie'] = {'classI': [], 'classII': [], 'mapI': {}, 'mapII': {}}
    payload['drb345'] = []
    payload['dqa'] = []
    payload['meta']['inference'] = ('DRB3/4/5 and DQA1 inference is unavailable in this build: '
                                    'the linkage tables come from the unlicensed workbooks and '
                                    'are deliberately omitted.')

    for key, fname in FILES.items():
        path = os.path.join(args.refdir, fname)
        if not os.path.exists(path):
            sys.exit('missing %s' % path)
        block = build_block(path, key)
        payload[key] = block
        print('  %-9s %5d alleles | %4d distinct eplets | %5d cells | categories %s'
              % (key, len(block['alleles']), len(block['eplets']), len(block['cells']),
                 ','.join(block['categories'])))

    with open(args.out, 'w', encoding='utf-8') as fh:
        fh.write('/* GENERATED by tools/build_hlar_reference.py\n'
                 '   HLAMatchmaker v3 eplet tables from hlaR 1.0.0\n'
                 '   Copyright (c) 2020 Christian P. Larsen - MIT licence.\n'
                 '   Source: https://github.com/LarsenLab/hlaR (CRAN: hlaR)\n'
                 '   Commercial use is permitted under MIT with this attribution.\n'
                 '   NOT interchangeable with the v3.1 reference; see '
                 'validation/HLAR_CROSSCHECK.md. */\n')
        fh.write('window.HLA_REFERENCE_V3 = ')
        json.dump(payload, fh, separators=(',', ':'))
        fh.write(';\n')
    print('wrote %s (%.2f MB)' % (args.out, os.path.getsize(args.out) / 1e6))
    return 0


if __name__ == '__main__':
    sys.exit(main())
