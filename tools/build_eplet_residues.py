"""
build_eplet_residues.py — derives the residue set of every eplet from the workbooks' own sequence tables
plus template structures, so the 3D view can colour exact eplet patches instead of only anchor residues.

Method (HLAMatchmaker definition: an eplet = a polymorphic residue plus the residues within ~3-3.5 A on the
molecular surface; the eplet name lists the anchor position followed by the residue letters, e.g. 62QE,
65RNA, 163RW):
  1. sequences: class I from ABC workbook sheet 'Seq' (tokens like '62Q'); class II beta from the residue
     columns of DRDQDP sheet 'B' (position = column - 115); class II alpha from sheet 'A' (position = column - 52).
  2. carriers: alleles that carry the eplet (from tools/hla_reference_data.json).
  3. anchor check: the consensus residue of the carriers at the anchor position must equal the first letter.
  4. remaining letters are assigned, in increasing position order, to positions with the matching consensus
     residue that lie closest to the anchor in a template structure (min heavy-atom distance, 4 A, then 6 A,
     then a sequence-window fallback). Template: 1AKJ chain A (class I), 1DLH chain B (class II beta),
     1JK8 chain A (class II alpha).
Output: ../hla_eplet_residues.js (window.HLA_EPLET_RES) and tools/eplet_residues_report.md.
Run from the clinical_risk_calculator folder after tools/fetch_structures.py.
"""
import os, io, re, json, collections
import numpy as np
from pyxlsb import open_workbook

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.abspath(os.path.join(HERE, '..'))
SRC = os.path.join(APP, 'reference_sources')
ABC = os.path.join(SRC, 'ABC_Antibody_Analysis_3.1.xlsb')
DRDQDP = os.path.join(SRC, 'DRDQDP_Antibody_Analysis_3.1.xlsb')
REF = json.load(io.open(os.path.join(HERE, 'hla_reference_data.json'), encoding='utf-8'))

def load(f, sheet):
    with open_workbook(f) as wb:
        with wb.get_sheet(sheet) as sh:
            return [[c.v for c in r] for r in sh.rows()]
def clean(v): return v.replace('\xa0', ' ').strip() if isinstance(v, str) else v
def is_allele(v): return isinstance(v, str) and re.match(r'^[A-Z]+\d?\*\d{2,3}:\d{2,3}$', clean(v)) is not None

# ---- sequences -------------------------------------------------------------
seqs = {}
for r in load(ABC, 'Seq'):
    if r and is_allele(r[0]):
        d = {}
        for v in r[2:]:
            m = re.match(r'^(\d+)([A-Z])$', str(v).strip()) if isinstance(v, str) else None
            if m: d[int(m.group(1))] = m.group(2)
        seqs[clean(r[0])] = d
nI = len(seqs)
def renumbered(row, first_col, skip_x=True, lead_offset=0):
    """Residue columns are aligned to DR/DQ numbering (column first_col = position 1). Unknown residues of partially
    sequenced alleles are empty cells and keep their position. Deletions are 'x' cells: DPB1 (positions 23-24) and
    DPA1 (position 16). Locus-specific eplet names count positions without the deletions (skip_x) and, for DPA1,
    without the two N-terminal residues that DP alpha chains lack (lead_offset=2). skip_x=False gives the aligned
    numbering that HLAMatchmaker uses for interlocus eplets shared with DR/DQ."""
    d, skipped = {}, lead_offset
    for j, v in enumerate(row):
        if j < first_col: continue
        s = v.strip() if isinstance(v, str) else ''
        if s.lower() in ('x', '-', '.'):
            if skip_x: skipped += 1
            continue
        pos = j - first_col + 1 - skipped
        if pos >= 1 and len(s) == 1 and s.isalpha() and s.isupper():
            d[pos] = s
    return d
seqs_aligned = {}          # DR-aligned numbering (deletions keep their position), used for interlocus eplets
for r in load(DRDQDP, 'B'):
    if r and is_allele(r[0]):
        seqs[clean(r[0])] = renumbered(r, 116)
        seqs_aligned[clean(r[0])] = renumbered(r, 116, skip_x=False)
nB = len(seqs) - nI
for r in load(DRDQDP, 'A'):
    if r and is_allele(r[0]):
        seqs[clean(r[0])] = renumbered(r, 53, lead_offset=2 if clean(r[0]).startswith('DPA1') else 0)
        seqs_aligned[clean(r[0])] = renumbered(r, 53, skip_x=False)
print('sequences: class I %d, class II beta %d, alpha %d' % (nI, nB, len(seqs) - nI - nB))

# ---- template structures ---------------------------------------------------
def residue_atoms(pdb_path, chain):
    res = collections.defaultdict(list)
    for line in io.open(pdb_path, encoding='utf-8', errors='replace'):
        if line.startswith('ENDMDL'): break
        if line.startswith('ATOM') and line[21] == chain and line[76:78].strip() != 'H':
            try: res[int(line[22:26])].append((float(line[30:38]), float(line[38:46]), float(line[46:54])))
            except ValueError: pass
    return {k: np.array(v) for k, v in res.items()}
def min_dist(a, b):
    d = a[:, None, :] - b[None, :, :]
    return float(np.sqrt((d * d).sum(-1)).min())
TEMPLATES = {'classI': ('1AKJ', 'A'), 'DRB': ('1DLH', 'B'), 'DQB1': ('1JK8', 'B'), 'DPB1': ('3LQZ', 'B'), 'DQA1': ('1JK8', 'A'), 'DPA1': ('3LQZ', 'A')}
coords = {k: residue_atoms(os.path.join(APP, 'structures', 'rcsb', pid + '.pdb'), ch) for k, (pid, ch) in TEMPLATES.items()}
for k, c in coords.items(): print('template', k, TEMPLATES[k], len(c), 'residues')
def template_for(group, alleles):
    if group == 'classI': return 'classI'
    loci = collections.Counter(a.split('*')[0] for a in alleles)
    top = loci.most_common(1)[0][0]
    if group == 'classIIA': return 'DPA1' if top == 'DPA1' else 'DQA1'
    return 'DPB1' if top == 'DPB1' else ('DQB1' if top == 'DQB1' else 'DRB')

# ---- eplet carriers ----------------------------------------------------------
def carriers(group):
    g = REF[group]
    out = collections.defaultdict(list)
    for allele, cells in g['alleles'].items():
        for ci in cells:
            out[g['eplets'][g['cells'][ci][1]]].append(allele)
    return out

def consensus(alleles, pos, aligned=False):
    table = seqs_aligned if aligned else seqs
    c = collections.Counter((table.get(a) or seqs.get(a, {})).get(pos) for a in alleles if a in seqs)
    c.pop(None, None)
    return c.most_common(1)[0][0] if c else None

def parse_name(name):
    m = re.match(r'^([a-z]*)(\d+)([A-Z/]+)$', name)
    if not m: return None
    letters = m.group(3)
    alts = letters.split('/')
    return {'prefix': m.group(1), 'anchor': int(m.group(2)), 'letters': alts[0], 'alt': alts[1:] }

result = {}          # keyed by group + '|' + eplet name (names such as 9F exist in more than one class)
stats = collections.Counter()
report = ['# Eplet residue derivation report', '']
for group in ['classI', 'classIIB', 'classIIA']:
    cmap = carriers(group)
    for ename, alleles in sorted(cmap.items()):
        name = group + '|' + ename
        C = coords[template_for(group, alleles)]
        p = parse_name(ename)
        if not p:
            result[name] = {'anchor': None, 'positions': [], 'method': 'unparsed', 'group': group}; stats['unparsed'] += 1; continue
        p0 = p['anchor']
        # interlocus eplets (lowercase locus prefix) are named in the DR/DQ-aligned numbering, also on DP chains
        aligned = bool(p['prefix'])
        cons = lambda q: consensus(alleles, q, aligned)
        anchor_ok = cons(p0) == p['letters'][0]
        shift = 0
        if not anchor_ok:
            # some class I names (70/71 region) are anchored one position after the first residue
            for s in (-1, 1):
                if cons(p0 + s) == p['letters'][0] and (len(p['letters']) < 2 or cons(p0 + s + 1) == p['letters'][1]):
                    shift = s; break
        start = p0 + shift
        positions = [start]; prev = start; method = 'structure' if not shift else 'anchor-shifted'
        neighbours = sorted(((min_dist(C[start], C[q]), q) for q in C if q != start), key=lambda t: t[0]) if start in C else []
        dist_of = dict((q, d) for d, q in neighbours)
        for letter in p['letters'][1:]:
            chosen = None
            for cutoff in (4.0, 6.0):
                cands = [q for d, q in neighbours if d <= cutoff and q > prev and cons(q) == letter]
                if cands:
                    chosen = min(cands, key=lambda q: dist_of[q]); break
            if chosen is None:
                cands = [q for q in range(prev + 1, prev + 12) if cons(q) == letter]
                if cands: chosen = cands[0]; method = 'sequence-window'
            if chosen is None:
                method = 'incomplete'; break
            positions.append(chosen); prev = chosen
        if start not in C: method = 'no-template-coordinates'
        result[name] = {'anchor': p0, 'positions': positions, 'letters': p['letters'], 'group': group, 'template': template_for(group, alleles),
                        'anchorCheck': anchor_ok or shift != 0, 'method': method, 'carriers': len(alleles), 'aligned': aligned}
        stats[method] += 1; stats['anchor ok' if anchor_ok else 'anchor MISMATCH'] += 1

report.append('Eplets processed: %d' % len(result))
report.append('By method: ' + ', '.join('%s %d' % kv for kv in stats.items()))
bad = [n for n, v in result.items() if v.get('anchorCheck') is False]
report.append('Anchor residue disagrees with the carriers\' consensus sequence for %d eplets: %s' % (len(bad), ', '.join(bad[:40])))
inc = [n for n, v in result.items() if v.get('method') in ('incomplete', 'unparsed', 'no-template-coordinates')]
report.append('Not fully resolved (anchor only shown in 3D): %d: %s' % (len(inc), ', '.join(inc[:60])))
report.append('')
report.append('| eplet | group | anchor | positions | method | anchor check |')
report.append('|---|---|---|---|---|---|')
for n, v in sorted(result.items(), key=lambda kv: (kv[1].get('group', ''), kv[1].get('anchor') or 0, kv[0])):
    report.append('| %s | %s | %s | %s | %s | %s |' % (n.split('|')[1], v.get('group', ''), v.get('anchor'), ' '.join(map(str, v.get('positions', []))), v.get('method'), v.get('anchorCheck')))
io.open(os.path.join(HERE, 'eplet_residues_report.md'), 'w', encoding='utf-8').write('\n'.join(report) + '\n')
out = {'classI': {}, 'classIIB': {}, 'classIIA': {}}
for k, v in result.items():
    grp, ename = k.split('|', 1)
    out[grp][ename] = {'anchor': v.get('anchor'), 'positions': v.get('positions', []), 'method': v.get('method'), 'anchorCheck': v.get('anchorCheck'), 'aligned': v.get('aligned', False)}
with io.open(os.path.join(APP, 'hla_eplet_residues.js'), 'w', encoding='utf-8') as f:
    f.write('/* GENERATED by tools/build_eplet_residues.py - residue positions per eplet (by class) derived from the HLAMatchmaker sequence tables and template structures. */\n')
    f.write('window.HLA_EPLET_RES = '); json.dump(out, f, separators=(',', ':')); f.write(';\n')
print('\n'.join(report[:5]))
print('wrote hla_eplet_residues.js and tools/eplet_residues_report.md')
