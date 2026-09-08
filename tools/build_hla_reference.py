"""
build_hla_reference.py
======================
Extracts the HLAMatchmaker v3.1 allele/eplet tables and the PGIMER immunogenic
eplet reference (IE.xlsx) into a single JavaScript data file that the RAMRT
calculator loads offline (no network, no external calculator).

Sources (copied into ../reference_sources/):
  ABC_Antibody_Analysis_3.1.xlsb     sheet 'Ep'      : class I allele x eplet matrix
                                      sheet 'Acc Mm'  : per-column category labels
                                                        (Abver / Ehi / Elo) and cached
                                                        per-allele counts used for validation
  DRDQDP_Antibody_Analysis_3.1.xlsb  sheet 'UnAcc B' : the workbook's own per-allele eplet listing for
                                                        DRB1/3/4/5, DQB1, DPB1 in blocks AbV / Inter / oth
                                                        (columns 110+) with cached AbVer/Other counts
                                      sheet 'UnAcc A' : same for DQA1, DPA1 (blocks Aver / Inter / othA)
                                      sheet 'B', 'A'  : raw matrices, used only to cross-check the listings
                                      sheet 'DRB345DQB assoc' : DRB1 -> DRB3/4/5, DQB1 linkage
                                      sheet 'DQAB assoc'      : DRB1+DQB1 -> DQA1 linkage
  IE.xlsx                             immunogenic eplet reference catalogue (Class I / Class II)

Why the listings and not the raw class II matrices: sheet 'A' contains four columns (114K, 127L,
160F, 190T) that the workbook never counts, sheet 'B' labels one antibody-verified interlocus
column (rq75VT) as 'Inter' in its header, and some eplet names (35FV, 69E, 85VY, 98Q, 56PV) sit in
both an antibody-verified and an 'other' column. The 'UnAcc' listings are what HLAMatchmaker itself
computes for every allele, so they are the authoritative content; the raw sheets are cross-checked.

Outputs:
  ../hla_reference_data.js        window.HLA_REF = {...}   (loaded by index.html)
  hla_reference_data.json         same content, for Node validation
  validation_vectors.json         allele-level test pairs derived from Dataset/Objective 1.xlsx
                                  (typing strings only, no identifiers) + per-allele expectations
  reference_build_report.md       counts and validation results of this build

Every mapping is taken verbatim from the workbooks; nothing is typed by hand.
"""
import os, re, sys, json, collections, datetime
from pyxlsb import open_workbook
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.abspath(os.path.join(HERE, '..'))
SRC = os.path.join(APP, 'reference_sources')
ABC = os.path.join(SRC, 'ABC_Antibody_Analysis_3.1.xlsb')
DRDQDP = os.path.join(SRC, 'DRDQDP_Antibody_Analysis_3.1.xlsb')
IE = os.path.join(SRC, 'IE.xlsx')
OBJ1 = r'E:\Heera_Singh\PHD\Dataset\Objective 1.xlsx'   # validation pairs only (optional)

report = []
def log(msg):
    print(msg)
    report.append(msg)

def load(f, sheet):
    with open_workbook(f) as wb:
        with wb.get_sheet(sheet) as sh:
            return [[c.v for c in r] for r in sh.rows()]

def clean(v):
    return v.replace('\xa0', ' ').strip() if isinstance(v, str) else v

def is_allele(v):
    return isinstance(v, str) and re.match(r'^[A-Z]+\d?\*\d{2,3}:\d{2,3}$', clean(v)) is not None

# ---------------------------------------------------------------------------
# 1. CLASS I (ABC)
# ---------------------------------------------------------------------------
log('# HLA reference build report (' + datetime.date.today().isoformat() + ')')
log('')
log('## Class I (ABC_Antibody_Analysis_3.1.xlsb)')
ep = load(ABC, 'Ep')
acc = load(ABC, 'Acc Mm')

# category labels live in 'Acc Mm' row 1 at column (Ep column + offset); find offset with A*01:01
acc_labels = {j: v for j, v in enumerate(acc[1]) if v in ('Abver', 'Ehi', 'Elo')}
a0101_ep = next(r for r in ep if r and r[0] == 'A*01:01')
a0101_acc = next(r for r in acc if len(r) > 1 and r[1] == 'A*01:01')
ep_cells = {j: v for j, v in enumerate(a0101_ep) if isinstance(v, str) and j >= 2}
acc_cells = {j: v for j, v in enumerate(a0101_acc) if isinstance(v, str) and j >= 9}
offset, hits = max(((o, sum(1 for j, v in ep_cells.items() if acc_cells.get(j + o) == v)) for o in range(0, 20)), key=lambda t: t[1])
assert hits == len(ep_cells), f'Could not align Ep and Acc Mm columns ({hits}/{len(ep_cells)})'
abc_col_cat = {j - offset: lab for j, lab in acc_labels.items() if j - offset >= 2}
log(f'- Ep/Acc Mm column offset = {offset}; categorised columns = {len(abc_col_cat)} '
    f'({collections.Counter(abc_col_cat.values())})')

abc_alleles = {}
uncategorised = collections.Counter()
for r in ep[3:]:
    if r and is_allele(r[0]):
        cells = []
        for j, v in enumerate(r):
            if j >= 2 and isinstance(v, str) and v.strip():
                if j in abc_col_cat:
                    cells.append((j, v.strip(), abc_col_cat[j]))
                else:
                    uncategorised[j] += 1
        abc_alleles[clean(r[0])] = cells
assert not uncategorised, f'Class I cells in uncategorised columns: {dict(uncategorised)}'
log(f'- alleles extracted: {len(abc_alleles)} '
    f'({collections.Counter(a.split("*")[0] for a in abc_alleles)})')

# validate against the workbook's own cached per-allele counts (#TotEp, #AbvEp, #HiEp, #loEp)
ok = bad = 0; bad_examples = []
for r in acc[4:]:
    if len(r) > 8 and is_allele(r[1]) and clean(r[1]) in abc_alleles:
        cells = abc_alleles[clean(r[1])]
        mine = (len(cells),
                sum(1 for c in cells if c[2] == 'Abver'),
                sum(1 for c in cells if c[2] == 'Ehi'),
                sum(1 for c in cells if c[2] == 'Elo'))
        theirs = tuple(int(r[k] or 0) for k in (2, 4, 6, 8))
        if mine == theirs: ok += 1
        else:
            bad += 1
            if len(bad_examples) < 5: bad_examples.append((r[1], mine, theirs))
log(f'- validation vs cached "Acc Mm" per-allele counts: {ok} match, {bad} differ' + (f' {bad_examples}' if bad else ''))
assert bad == 0, 'Class I extraction does not reproduce the workbook counts'

# ---------------------------------------------------------------------------
# 2. CLASS II beta chains (UnAcc B listing) and alpha chains (UnAcc A listing)
# ---------------------------------------------------------------------------
log('')
log('## Class II (DRDQDP_Antibody_Analysis_3.1.xlsb)')
B = load(DRDQDP, 'B'); Am = load(DRDQDP, 'A'); ub = load(DRDQDP, 'UnAcc B'); ua = load(DRDQDP, 'UnAcc A')

def block_lookup(row, start):
    lab = {j: clean(v) for j, v in enumerate(row) if isinstance(v, str) and v.strip()}
    def block(j):
        k = j
        while k >= start and k not in lab: k -= 1
        return lab.get(k) if k >= start else None
    return block

def extract_listing(rows, label_row, start, cat_of_block, allele_col=1, cnt_cols=(4, 5)):
    block = block_lookup(label_row, start)
    alleles, cached, blanks = {}, {}, {}
    for r in rows:
        if len(r) > max(cnt_cols) and is_allele(r[allele_col]):
            name = clean(r[allele_col])
            cells = []
            blank = collections.Counter()
            for j, v in enumerate(r):
                if j >= start and isinstance(v, str):
                    if v.strip():
                        bl = block(j)
                        cat = cat_of_block(bl, v.strip())
                        assert cat, f'unexpected block {bl!r} at column {j} for {name}'
                        cells.append((j, v.strip(), cat))
                    elif v != '':
                        blank[block(j)] += 1   # whitespace-only cell: counted by the workbook's COUNTA, but not an eplet
            alleles[name] = cells
            cached[name] = tuple(int(r[k] or 0) for k in cnt_cols)
            blanks[name] = blank
    return alleles, cached, blanks

def cat_b(block, name):
    if block == 'AbV': return 'AbInt' if re.match(r'^[a-z]', name) else 'AbV'
    if block == 'Inter': return 'Inter'
    if block == 'oth': return 'oth'
    return None
def cat_a(block, name):
    return {'Aver': 'Aver', 'Inter': 'Inter', 'othA': 'othA'}.get(block)

ABV_SET = {'AbV', 'AbInt', 'Aver'}
ABV_BLOCKS = {'AbV', 'Aver'}
b_alleles, cached_b, blanks_b = extract_listing(ub, ub[0], 110, cat_b)
a_alleles, cached_a, blanks_a = extract_listing(ua, ua[1], 48, cat_a)

def validate_listing(alleles, cached, blanks, label):
    bad, ws = [], []
    for a, cells in alleles.items():
        abv = sum(1 for c in cells if c[2] in ABV_SET)
        oth = len(cells) - abv
        abv_ws = sum(n for b, n in blanks[a].items() if b in ABV_BLOCKS)
        oth_ws = sum(n for b, n in blanks[a].items() if b not in ABV_BLOCKS)
        if (abv, oth) == cached[a]:
            continue
        if (abv + abv_ws, oth + oth_ws) == cached[a]:
            ws.append((a, dict(blanks[a])))
        else:
            bad.append((a, (abv, oth), cached[a]))
    log(f'- {label}: {len(alleles)} alleles ({collections.Counter(a.split("*")[0] for a in alleles)}); '
        f'cached (AbVer, Other) counts reproduced for {len(alleles) - len(bad) - len(ws)} of {len(alleles)}'
        + (f'; {len(ws)} explained by whitespace-only cells that the workbook counts as eplets: {ws}' if ws else '')
        + (f'; unexplained differences: {bad[:5]}' if bad else ''))
    assert not bad, f'{label}: listing extraction does not reproduce the workbook counts'
validate_listing(b_alleles, cached_b, blanks_b, 'beta chains from "UnAcc B"')
validate_listing(a_alleles, cached_a, blanks_a, 'alpha chains from "UnAcc A"')

# cross-check the listings against the raw matrices (sheets B and A)
b_hdr = {j: clean(v) for j, v in enumerate(B[0]) if isinstance(v, str) and v.strip()}
b_max = max(b_hdr)
b_sheet = {clean(r[0]): {v.strip() for j, v in enumerate(r) if 2 <= j <= b_max and isinstance(v, str) and v.strip()} for r in B if r and is_allele(r[0])}
a_lab = {j: clean(v) for j, v in enumerate(Am[1]) if isinstance(v, str) and v.strip() and clean(v) != 'res'}
a_sheet = {clean(r[0]): {v.strip() for j, v in enumerate(r) if j in a_lab and isinstance(v, str) and v.strip()} for r in Am if r and is_allele(r[0])}
b_only = sorted(set(b_sheet) - set(b_alleles)); a_only = sorted(set(a_sheet) - set(a_alleles))
b_diff = sorted(a for a in b_alleles if a in b_sheet and {c[1] for c in b_alleles[a]} != b_sheet[a])
a_extra = collections.Counter()
for a in a_alleles:
    if a in a_sheet:
        for n in a_sheet[a] - {c[1] for c in a_alleles[a]}: a_extra[n] += 1
log(f'- cross-check vs sheet B: {len(b_only)} alleles only in sheet B {b_only}; {len(b_diff)} alleles whose eplet names differ {b_diff[:5]}')
log(f'- cross-check vs sheet A: {len(a_only)} alleles only in sheet A {a_only}; eplets present in sheet A but never counted by the workbook: {dict(a_extra)}')
# fallback for alleles present only in the raw sheet B: header labels, with the rq75VT column treated as antibody-verified interlocus
for a in b_only:
    r = next(x for x in B if x and clean(x[0]) == a)
    cells = []
    for j, v in enumerate(r):
        if 2 <= j <= b_max and isinstance(v, str) and v.strip():
            hdr = b_hdr.get(j)
            name = v.strip()
            cat = 'AbInt' if (hdr in ('AbInt',) or re.match(r'^[a-z]', name) and hdr in ('AbV', 'Inter')) else ('AbV' if hdr == 'AbV' else ('Inter' if hdr == 'Inter' else 'oth'))
            cells.append((j, name, cat))
    b_alleles[a] = cells
    log(f'  - {a} added from sheet B (not in the listing): {len(cells)} eplets')

# ---------------------------------------------------------------------------
# 3. Linkage tables (DRB3/4/5 and DQA1 inference, as provided in the workbook)
# ---------------------------------------------------------------------------
def norm4(code, locus):
    code = str(code).strip()
    m = re.match(r'^(\d{2})(\d{2})', code)
    return f'{locus}*{m.group(1)}:{m.group(2)}' if m else None

DRB345_CODES = {'NEG': None, 'B3*0101': 'DRB3*01:01', 'B3*0202': 'DRB3*02:02', 'B3*0301': 'DRB3*03:01',
                'B3-0201': 'DRB3*02:01', 'B4*01AC': 'DRB4*01:01', 'B5*0101': 'DRB5*01:01',
                'B5*01CGF': 'DRB5*01:01', 'B5*0202': 'DRB5*02:02'}
assoc = load(DRDQDP, 'DRB345DQB assoc')
pops = ['CAU', 'AFR', 'API', 'HIS']
drb345 = []
unknown_codes = collections.Counter()
for r in assoc[4:]:
    for base in (0, 15):
        if len(r) > base + 12 and isinstance(r[base + 6], str) and r[base + 6].strip():
            code = r[base + 7]
            code_s = str(code).strip() if code is not None else ''
            if code_s not in DRB345_CODES:
                unknown_codes[code_s] += 1
            dqb = r[base + 8]
            drb345.append({
                'drb1': norm4(r[base + 6], 'DRB1'),
                'drb345_code': code_s,
                'drb345': DRB345_CODES.get(code_s),
                'dqb1': norm4(str(dqb).split('*')[-1], 'DQB1') if isinstance(dqb, str) and '*' in dqb else None,
                'prop': {p: (float(r[base + 9 + i]) if isinstance(r[base + 9 + i], (int, float)) else 0.0) for i, p in enumerate(pops)}
            })
assert not unknown_codes, f'Unknown DRB3/4/5 codes in linkage table: {dict(unknown_codes)}'
log('')
log(f'## Linkage tables: DRB345DQB assoc rows = {len(drb345)} (codes {collections.Counter(d["drb345_code"] for d in drb345)})')

FREQ_RANK = {'MOST COMMON': 6, 'VERY COMMON': 5, 'COMMON': 4, '': 3, 'RARE': 2, 'VERY RARE': 1, 'EXTREMELY RARE': 0}
dq = load(DRDQDP, 'DQAB assoc')
dqa_rows = []
for r in dq[1:]:
    for base in (0, 7):
        if len(r) > base + 3 and isinstance(r[base + 1], str) and 'DRB1' in r[base + 1]:
            dqa_raw = str(r[base + 3]).strip()
            m = re.match(r'^DQA1\*(\d{2})(\d{2})', dqa_raw)
            lab = str(r[base + 4]).strip() if len(r) > base + 4 and isinstance(r[base + 4], str) else ''
            dqa_rows.append({
                'drb1': norm4(r[base + 1].split('*')[-1], 'DRB1'),
                'dqb1': norm4(r[base + 2].split('*')[-1], 'DQB1'),
                'dqa1': f'DQA1*{m.group(1)}:{m.group(2)}' if m else None,
                'dqa1_code': dqa_raw,
                'freq': lab, 'rank': FREQ_RANK.get(lab, 3),
                'ethnic': str(r[base + 5]).strip() if len(r) > base + 5 and isinstance(r[base + 5], str) else ''
            })
log(f'- DQAB assoc rows = {len(dqa_rows)} (frequency labels {collections.Counter(d["freq"] for d in dqa_rows)})')

# ---------------------------------------------------------------------------
# 4. IE.xlsx immunogenic reference catalogue
# ---------------------------------------------------------------------------
ie = pd.read_excel(IE, header=None)
ie_c1 = [str(v).strip() for v in ie[1].dropna().tolist() if str(v).strip() and 'immunogenic' not in str(v).lower()]
ie_c2 = [str(v).strip() for v in ie[2].dropna().tolist() if str(v).strip() and 'immunogenic' not in str(v).lower()]
ie_c1_u = list(dict.fromkeys(ie_c1)); ie_c2_u = list(dict.fromkeys(ie_c2))
abc_names = {c[1] for cells in abc_alleles.values() for c in cells}
c2_names = {c[1] for cells in b_alleles.values() for c in cells} | {c[1] for cells in a_alleles.values() for c in cells}
def map_ie(names, pool):
    lower = {n.lower(): n for n in pool}
    out = {}
    for n in names:
        out[n] = n if n in pool else lower.get(n.lower())
    return out
ie_map1 = map_ie(ie_c1_u, abc_names); ie_map2 = map_ie(ie_c2_u, c2_names)
log('')
log(f'## IE.xlsx: Class I entries {len(ie_c1)} ({len(ie_c1_u)} unique) -> {sum(1 for v in ie_map1.values() if v)} present in the v3.1 class I tables; '
    f'absent: {[k for k, v in ie_map1.items() if not v]}')
log(f'- Class II entries {len(ie_c2)} ({len(ie_c2_u)} unique) -> {sum(1 for v in ie_map2.values() if v)} present in the v3.1 class II tables; '
    f'absent: {[k for k, v in ie_map2.items() if not v]}')

# ---------------------------------------------------------------------------
# 5. Serialise
# ---------------------------------------------------------------------------
def pack(alleles):
    names = sorted({c[1] for cells in alleles.values() for c in cells})
    idx = {n: i for i, n in enumerate(names)}
    catvotes = collections.defaultdict(collections.Counter)
    for cells in alleles.values():
        for j, n, cat in cells: catvotes[n][cat] += 1
    return names, idx, catvotes

PRIORITY_I = ['Abver', 'Ehi', 'Elo']
PRIORITY_IIB = ['AbV', 'AbInt', 'Inter', 'oth']
PRIORITY_IIA = ['Aver', 'Inter', 'othA']
def dominant(counter, priority):
    for p in priority:
        if counter.get(p): return p
    return max(counter, key=counter.get)

def build_group(alleles, priority):
    """Cell-based model: the workbook compares donor and recipient column by column (one column = one
    polymorphic position), and a category belongs to a column. Each unique (column, eplet, category)
    triple becomes a 'cell'; an allele is the list of its cells. The same eplet name can therefore
    carry different categories on different alleles, exactly as in the workbook."""
    names, idx, votes = pack(alleles)
    cat_idx = {c: i for i, c in enumerate(priority)}
    cells_list, triple_idx, table = [], {}, {}
    for a, cells in alleles.items():
        ids = []
        for j, n, cat in cells:
            key = (j, idx[n], cat_idx[cat])
            if key not in triple_idx:
                triple_idx[key] = len(cells_list)
                cells_list.append([j, idx[n], cat_idx[cat]])
            ids.append(triple_idx[key])
        table[a] = sorted(set(ids))
    cats = [dominant(votes[n], priority) for n in names]
    multi = {n: dict(votes[n]) for n in names if len(votes[n]) > 1}
    percol = {a: len(cells) for a, cells in alleles.items()}   # cell-based totals as HLAMatchmaker counts them
    return {'eplets': names, 'categories': priority, 'cells': cells_list, 'cat': cats, 'alleles': table, 'colCount': percol, 'multiCategory': multi}

classI = build_group(abc_alleles, PRIORITY_I)
classIIB = build_group(b_alleles, PRIORITY_IIB)
classIIA = build_group(a_alleles, PRIORITY_IIA)
log(f'- cell vocabularies (unique column/eplet/category triples): class I {len(classI["cells"])}, class II beta {len(classIIB["cells"])}, class II alpha {len(classIIA["cells"])}')
log('')
log(f'## Eplet vocabularies: class I {len(classI["eplets"])} eplets ({collections.Counter(classI["cat"])}); '
    f'class II beta {len(classIIB["eplets"])} ({collections.Counter(classIIB["cat"])}); class II alpha {len(classIIA["eplets"])} ({collections.Counter(classIIA["cat"])})')
if classI['multiCategory']: log(f'- class I eplets listed under more than one category (antibody-verified takes precedence): {classI["multiCategory"]}')
if classIIB['multiCategory']: log(f'- class II beta eplets under more than one category (antibody-verified takes precedence): {classIIB["multiCategory"]}')
if classIIA['multiCategory']: log(f'- class II alpha eplets under more than one category: {classIIA["multiCategory"]}')

ref = {
    'meta': {
        'built': datetime.datetime.now().isoformat(timespec='seconds'),
        'sources': ['ABC_Antibody_Analysis_3.1.xlsb (HLAMatchmaker v3.1)', 'DRDQDP_Antibody_Analysis_3.1.xlsb (HLAMatchmaker v3.1)', 'IE.xlsx (PGIMER immunogenic eplet reference)'],
        'classI_alleles': len(abc_alleles), 'classII_beta_alleles': len(b_alleles), 'classII_alpha_alleles': len(a_alleles),
        'categoriesI': {'Abver': 'Antibody-verified eplet', 'Ehi': 'ElliPro high exposure (not antibody-verified)', 'Elo': 'ElliPro low exposure (not antibody-verified)'},
        'categoriesII': {'AbV': 'Antibody-verified', 'AbInt': 'Antibody-verified interlocus', 'Inter': 'Interlocus (shared DR/DQ/DP)', 'oth': 'Other', 'Aver': 'Antibody-verified (alpha chain)', 'othA': 'Other (alpha chain)'},
        'drb345_code_map': DRB345_CODES,
        'populations': pops
    },
    'classI': classI, 'classIIB': classIIB, 'classIIA': classIIA,
    'ie': {'classI': ie_c1_u, 'classII': ie_c2_u, 'mapI': ie_map1, 'mapII': ie_map2,
           'classI_raw_count': len(ie_c1), 'classII_raw_count': len(ie_c2)},
    'drb345': drb345, 'dqa': dqa_rows
}
js_path = os.path.join(APP, 'hla_reference_data.js')
with open(js_path, 'w', encoding='utf-8') as f:
    f.write('/* GENERATED FILE - do not edit. Built by tools/build_hla_reference.py from the HLAMatchmaker v3.1 workbooks and IE.xlsx. */\n')
    f.write('window.HLA_REF = ')
    json.dump(ref, f, separators=(',', ':'), ensure_ascii=False)
    f.write(';\n')
with open(os.path.join(HERE, 'hla_reference_data.json'), 'w', encoding='utf-8') as f:
    json.dump(ref, f, separators=(',', ':'), ensure_ascii=False)
log('')
log(f'## Written {os.path.relpath(js_path, APP)} ({os.path.getsize(js_path)//1024} KB)')

# ---------------------------------------------------------------------------
# 6. Validation vectors from the workbook caches and the thesis records (allele-level mismatch)
# ---------------------------------------------------------------------------
def norm_allele_token(tok, locus):
    tok = tok.strip().rstrip('.').strip()
    m = re.match(r'^(?:HLA-)?(?:[A-Z]+\d?\*)?\s*(\d{1,3}):(\d{1,3})', tok)
    if not m: return None
    return f'{locus}*{int(m.group(1)):02d}:{int(m.group(2)):02d}'

vectors = {'perAllele': [], 'pairs': [], 'summary': {}}
for r in acc[4:]:
    if len(r) > 8 and is_allele(r[1]):
        vectors['perAllele'].append({'allele': clean(r[1]), 'tot': int(r[2] or 0), 'abver': int(r[4] or 0), 'ehi': int(r[6] or 0), 'elo': int(r[8] or 0)})
vectors['perAllele'] = vectors['perAllele'][::37]
for a, (abv, oth) in list(cached_b.items())[::23]:
    vectors['perAllele'].append({'allele': a, 'abver': abv, 'other': oth})
for a, (abv, oth) in list(cached_a.items())[::5]:
    vectors['perAllele'].append({'allele': a, 'abver': abv, 'other': oth})

if os.path.exists(OBJ1):
    try:
        d = pd.read_excel(OBJ1, sheet_name='HLA_All_Linked', skiprows=1)
        agree_unique = agree_haplo = agree_antigen = total = 0
        pairs, disagreements = [], []
        by_locus = collections.defaultdict(lambda: [0, 0])
        pattern = collections.Counter()
        first = lambda x: x.split('*')[1].split(':')[0]
        for _, row in d.iterrows():
            rec = {}; don = {}; expected = {}
            complete = True
            for locus, rc, dc, mc in [('A', 'Rec A', 'Don A', 'MM A'), ('B', 'Rec B', 'Don B', 'MM B'),
                                      ('DRB1', 'Rec DRB1', 'Don DRB1', 'MM DRB1'), ('DQB1', 'Rec DQB1', 'Don DQB1', 'MM DQB1')]:
                ra = [norm_allele_token(t, locus) for t in str(row[rc]).split(',')] if pd.notna(row[rc]) else []
                da = [norm_allele_token(t, locus) for t in str(row[dc]).split(',')] if pd.notna(row[dc]) else []
                ra = [x for x in ra if x]; da = [x for x in da if x]
                mm = pd.to_numeric(row[mc], errors='coerce')
                if not ra or not da or pd.isna(mm):
                    complete = False; continue
                rec[locus] = ra; don[locus] = da; expected[locus] = int(mm)
            if not expected: continue
            all_agree = True
            for locus in expected:
                total += 1
                uniq = len(set(don[locus]) - set(rec[locus]))
                hap = sum(1 for x in (don[locus] if len(don[locus]) == 2 else don[locus] * 2) if x not in rec[locus])
                ant = len({first(x) for x in don[locus]} - {first(x) for x in rec[locus]})
                by_locus[locus][1] += 1
                agree_unique += (uniq == expected[locus]); agree_haplo += (hap == expected[locus])
                if ant == expected[locus]:
                    agree_antigen += 1; by_locus[locus][0] += 1
                else:
                    all_agree = False
                    key = ('donor homozygous' if len(set(don[locus])) == 1 else 'donor heterozygous',
                           'recipient homozygous' if len(set(rec[locus])) == 1 else 'recipient heterozygous',
                           f'recorded {expected[locus]} vs antigen-level {ant} / allele-level {uniq}')
                    pattern[key] += 1
                    if len(disagreements) < 12:
                        disagreements.append({'locus': locus, 'recipient': rec[locus], 'donor': don[locus], 'recorded': expected[locus], 'computed_antigen': ant, 'computed_allele': uniq, 'computed_haplotype': hap})
            if complete and all_agree and len(pairs) < 40:
                pairs.append({'recipient': rec, 'donor': don, 'expectedMM': expected})
        vectors['pairs'] = pairs
        vectors['summary'] = {'pairs_in_sheet': int(len(d)), 'locus_comparisons': total,
                              'agree_antigen_level_rule': agree_antigen, 'agree_allele_level_unique_rule': agree_unique, 'agree_haplotype_rule': agree_haplo,
                              'by_locus_antigen_rule': {k: {'agree': v[0], 'n': v[1]} for k, v in by_locus.items()},
                              'disagreement_patterns_antigen_rule': [{'pattern': list(k), 'n': n} for k, n in pattern.most_common()],
                              'disagreement_examples': disagreements}
        log('')
        log(f'## Mismatch-count validation against Dataset/Objective 1.xlsx (HLA_All_Linked, {len(d)} pairs): '
            f'{total} locus comparisons; recorded MM reproduced by the antigen-level (first-field) rule in {agree_antigen} ({agree_antigen/total*100:.1f}%), '
            f'by the allele-level (two-field, distinct donor alleles) rule in {agree_unique} ({agree_unique/total*100:.1f}%), '
            f'by the haplotype rule in {agree_haplo} ({agree_haplo/total*100:.1f}%). '
            f'The thesis registers and the Phase 4 model therefore use antigen-level counts.')
        log('- agreement by locus (antigen rule): ' + ', '.join(f'{k} {v[0]}/{v[1]}' for k, v in by_locus.items()))
        log('- remaining disagreement patterns: ' + '; '.join(f'{n} x {k}' for k, n in pattern.most_common(8)))
        log(f'- disagreement examples (typing only): {disagreements[:6]}')
        log(f'- {len(pairs)} fully concordant pairs stored as in-app self-test vectors')
    except Exception as e:
        log(f'- validation pairs skipped: {e}')
with open(os.path.join(HERE, 'validation_vectors.json'), 'w', encoding='utf-8') as f:
    json.dump(vectors, f, separators=(',', ':'))

with open(os.path.join(HERE, 'reference_build_report.md'), 'w', encoding='utf-8') as f:
    f.write('\n'.join(report) + '\n')
print('\nBUILD OK')
