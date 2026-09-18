"""
build_ems3d.py — precompute EMS3D (Mallon et al., J Immunol 2018;201:3780) for the calculator.

Runs inside the ramrt-ems3d container (tools/ems3d/Dockerfile). From clinical_risk_calculator/:

    docker build -t ramrt-ems3d tools/ems3d
    docker run --rm -v "<this folder>:/app" ramrt-ems3d \
        sh -c 'until [ -f tools/ems3d/work/models_done ]; do
                 python tools/ems3d/build_ems3d.py run --set core --models-only --workers 22 --chunk 300; done'
    docker run --rm -v "<this folder>:/app" ramrt-ems3d \
        python tools/ems3d/build_ems3d.py run --set core --potentials-only --follow \
            --workers 10 --apbs-slots 5 --dime 193          # alongside the models run, or afterwards
    docker run --rm -v "<this folder>:/app" ramrt-ems3d \
        python tools/ems3d/build_ems3d.py export --dime 193

Needs tools/hla_scores_sequences.json (tools/build_hla_scores_reference.py) and the crystal
structures in structures/ems3d_templates/ (downloaded from RCSB on first use).

The published method and what this script does at each step
-------------------------------------------------------------
1. Structure. Mallon et al. built MODELLER 9.17 homology models from 12 class I and 22
   class II templates, with an alanine nonamer (class I) or 12-mer (class II) peptide.
   MODELLER needs a licence, so each allele is instead threaded onto ONE high-resolution
   template from their list (class I 1K5N, DR 3PDO, DQ 1JK8, DP 4P5M): substituted side
   chains are built by PDBFixer (fixed random seed) and relaxed by OpenMM with every other
   heavy atom and the whole backbone restrained. The peptide is alanine of the published
   length. All models of a family share the template frame, so no superposition is needed.
   A residue the allele lacks (DQA1*02/*04/*05/*06 at 56) is left out and the backbone around
   it is relaxed freely so the chain closes (thread()).
   Checks (validation/HLA_SCORES_VALIDATION.md): relax_check.py - leaving the relaxation out
   moves ESD by up to 0.09; protocol_check.py / seed_check.py - models of the SAME allele built
   from different random starting points differ by a median ESD of 0.16 whichever protocol is
   used (vacuum, OBC2 implicit solvent, no relaxation), against a median of 0.48 between
   different alleles. That is the noise floor of single-model EMS3D; the fixed seed makes the
   library reproducible but does not remove it.
2. Charges and radii: PDB2PQR with the PARSE force field, protonation by PROPKA at pH 7.4.
3. Electrostatic potential: APBS, linearised Poisson-Boltzmann equation, 0.15 M monovalent
   salt, protein dielectric 2, solvent dielectric 78, 310 K, probe radius 1.4 A, on a cubic
   116 A box (the published 353 points x 0.33 A). The grid density is a parameter here
   (--dime); tools/ems3d/grid_check.py compares it with the published density
   (validation/HLA_SCORES_VALIDATION.md).
4. Comparison (PIPSA, Wade et al.): the potential inside a skin 3 A thick lying 4 A above
   the van der Waals surface (the app's own statement; the paper's methods text swaps the
   two numbers and reports the result is insensitive to both), compared between two
   molecules over the intersection of their skins with the Hodgkin index
       SI = 2 sum(pa*pb) / (sum(pa^2) + sum(pb^2))
   and converted to the electrostatic distance ESD = sqrt(2 - 2 SI), range 0-2.
5. EMS3D of a donor molecule = minimum ESD against the recipient's molecules: all class I
   molecules for class I (interlocus), the same locus for class II (intralocus). That last
   step happens in the browser (hla_scores.js) from the ESD tables this script exports:
   hla_ems3d_meta.js (names, always loaded) and hla_ems3d_I/DR/DQ/DP.js (loaded when needed).
"""
import argparse
import concurrent.futures as cf
import datetime
import json
import os
import random
import re
import shutil
import subprocess
import sys
import tempfile
import time
import traceback
import urllib.request

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)
APP = os.path.dirname(TOOLS)
WORK = os.path.join(HERE, 'work')
TEMPLATE_SRC = os.path.join(APP, 'structures', 'ems3d_templates')
SEQ_JSON = os.path.join(TOOLS, 'hla_scores_sequences.json')
REF_JSON = os.path.join(TOOLS, 'hla_reference_data.json')

BOX = 116.0          # A, 353 points x 0.33 A as published
SIGMA, DELTA = 4.0, 3.0
SKIN_STEP = 2        # compare on every 2nd grid point in each direction
PH = 7.4
SEED = 20260917      # PDBFixer runs Langevin dynamics to clear clashes; a fixed seed makes models reproducible

THREE = {'ALA': 'A', 'ARG': 'R', 'ASN': 'N', 'ASP': 'D', 'CYS': 'C', 'GLN': 'Q', 'GLU': 'E',
         'GLY': 'G', 'HIS': 'H', 'ILE': 'I', 'LEU': 'L', 'LYS': 'K', 'MET': 'M', 'PHE': 'F',
         'PRO': 'P', 'SER': 'S', 'THR': 'T', 'TRP': 'W', 'TYR': 'Y', 'VAL': 'V'}
ONE = {v: k for k, v in THREE.items()}
BACKBONE = ('N', 'CA', 'C', 'O', 'OXT')

# family -> template and what each output chain is.
#   src: (source chain, first residue, last residue); None = keep all
#   locus: IMGT locus threaded onto that chain, with the template's own allele
#   peptide: output chain C, alanine of the published length, taken from the middle of
#            the bound peptide (source chain and residue range)
FAMILIES = {
    'I': {'pdb': '1K5N', 'peptide_len': 9,
          'chains': {'A': {'src': ('A', 1, 276), 'locus': 'B', 'allele': 'B*27:09'},
                     'B': {'src': ('B', 1, 99)}},
          'peptide': ('C', 1, 9)},
    'DR': {'pdb': '3PDO', 'peptide_len': 12,
           'chains': {'A': {'src': ('A', 1, 184)},
                      'B': {'src': ('B', 1, 190), 'locus': 'DRB1', 'allele': 'DRB1*01:01'}},
           'peptide': ('C', 105, 116)},
    'DQ': {'pdb': '1JK8', 'peptide_len': 12,
           'chains': {'A': {'src': ('A', -99, 999), 'locus': 'DQA1', 'allele': 'DQA1*03:01'},
                      'B': {'src': ('B', -99, 999), 'locus': 'DQB1', 'allele': 'DQB1*03:02'}},
           'peptide': ('C', 2, 13)},
    'DP': {'pdb': '4P5M', 'peptide_len': 12,
           'chains': {'A': {'src': ('A', 1, 999), 'locus': 'DPA1', 'allele': 'DPA1*01:03'},
                      'B': {'src': ('B', 1, 999), 'locus': 'DPB1', 'allele': 'DPB1*02:01'}},
           'peptide': ('B', -25, -14)},
}
FAMILY_OF = {'A': 'I', 'B': 'I', 'C': 'I', 'DRB1': 'DR', 'DRB3': 'DR', 'DRB4': 'DR',
             'DRB5': 'DR', 'DQA1': 'DQ', 'DQB1': 'DQ', 'DPA1': 'DP', 'DPB1': 'DP'}
# comparison groups: EMS3D is the minimum ESD within one of these
GROUPS = ['I', 'DRB1', 'DRB3', 'DRB4', 'DRB5', 'DQ', 'DP']


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


def safe(name):
    return re.sub(r'[^A-Za-z0-9]+', '_', name).strip('_')


# --------------------------------------------------------------------------- sequences
_SEQ = None


def sequences():
    global _SEQ
    if _SEQ is None:
        with open(SEQ_JSON, encoding='utf-8') as fh:
            _SEQ = json.load(fh)
    return _SEQ


def allele_seq(allele):
    """(sequence, problem) - upper-cased extracellular residues ('.' = deleted), or why it cannot be modelled."""
    locus = allele.split('*')[0]
    L = sequences()['loci'].get(locus)
    if not L or allele not in L['sequences']:
        return None, 'not in IMGT'
    if allele in L['meta'].get('insertions', []):
        return None, 'insertion relative to the IMGT reference'
    s = L['sequences'][allele]
    # a '.' is a residue the allele lacks; thread() models it as a deletion
    if '*' in s:
        return None, 'undetermined residues'
    return s.upper(), None


# --------------------------------------------------------------------------- templates
def fetch_template(pdb_id):
    os.makedirs(TEMPLATE_SRC, exist_ok=True)
    path = os.path.join(TEMPLATE_SRC, pdb_id + '.pdb')
    if not os.path.exists(path) or os.path.getsize(path) < 1000:
        url = 'https://files.rcsb.org/download/%s.pdb' % pdb_id
        with urllib.request.urlopen(url, timeout=120) as r, open(path, 'wb') as fh:
            fh.write(r.read())
    return path


def read_residues(path):
    """[(chain, resseq, icode, resname, [(atom name, element, xyz)])] - first model, first altloc."""
    out, index = [], {}
    with open(path) as fh:
        for line in fh:
            if line.startswith('ENDMDL'):
                break
            if not line.startswith('ATOM'):
                continue
            alt = line[16]
            if alt not in (' ', 'A'):
                continue
            key = (line[21], int(line[22:26]), line[26])
            if key not in index:
                index[key] = len(out)
                out.append([key[0], key[1], key[2], line[17:20], []])
            name = line[12:16].strip()
            if any(a[0] == name for a in out[index[key]][4]):
                continue
            elem = line[76:78].strip() or name[0]
            xyz = (float(line[30:38]), float(line[38:46]), float(line[46:54]))
            out[index[key]][4].append((name, elem, xyz))
    return out


def align_positions(template_seq, allele_seq_):
    """template residue index -> 1-based IMGT position (global alignment)."""
    from Bio import Align
    from Bio.Align import substitution_matrices
    al = Align.PairwiseAligner()
    al.substitution_matrix = substitution_matrices.load('BLOSUM62')
    al.open_gap_score, al.extend_gap_score = -10, -0.5
    al.mode = 'global'
    al.end_gap_score = 0
    aln = al.align(template_seq, allele_seq_)[0]
    mapping = {}
    for (ts, te), (qs, qe) in zip(*aln.aligned):
        for k in range(int(te - ts)):
            mapping[int(ts) + k] = int(qs) + k + 1
    same = sum(1 for t, q in mapping.items() if template_seq[t] == allele_seq_[q - 1])
    return mapping, same / max(1, len(mapping))


def write_pdb(path, residues):
    serial = 1
    with open(path, 'w') as fh:
        previous = None
        for chain, num, resname, atoms in residues:
            if previous is not None and chain != previous:
                fh.write('TER\n')
            previous = chain
            for name, elem, (x, y, z) in atoms:
                label = name if len(name) == 4 else ' ' + name
                fh.write('ATOM  %5d %-4s %3s %1s%4d    %8.3f%8.3f%8.3f  1.00  0.00          %2s\n'
                         % (serial, label, resname, chain, num, x, y, z, elem))
                serial += 1
        fh.write('TER\nEND\n')


def prepare_template(fam):
    """Clean, renumber and annotate one family template (cached as JSON)."""
    F = FAMILIES[fam]
    os.makedirs(os.path.join(WORK, 'templates'), exist_ok=True)
    cache = os.path.join(WORK, 'templates', fam + '.json')
    if os.path.exists(cache):
        with open(cache) as fh:
            return json.load(fh)
    residues = read_residues(fetch_template(F['pdb']))
    chains = {}
    for out_chain, spec in F['chains'].items():
        c, lo, hi = spec['src']
        chains[out_chain] = [r for r in residues if r[0] == c and lo <= r[1] <= hi and r[3] in THREE]
    pc, lo, hi = F['peptide']
    pep = [r for r in residues if r[0] == pc and lo <= r[1] <= hi and r[3] in THREE]
    if len(pep) != F['peptide_len']:
        raise SystemExit('%s: peptide has %d residues, expected %d' % (fam, len(pep), F['peptide_len']))

    out = {'family': fam, 'pdb': F['pdb'], 'chains': {}}
    for out_chain, rows in chains.items():
        spec = F['chains'][out_chain]
        seq = ''.join(THREE[r[3]] for r in rows)
        entry = {'residues': [[r[3], r[4]] for r in rows], 'seq': seq}
        if 'locus' in spec:
            s, why = allele_seq(spec['allele'])
            if s is None:
                raise SystemExit('%s: template allele %s unusable (%s)' % (fam, spec['allele'], why))
            mapping, identity = align_positions(seq, s)
            entry.update({'locus': spec['locus'], 'allele': spec['allele'], 'identity': identity,
                          'imgt': [mapping.get(i) for i in range(len(rows))]})
            log('template %s chain %s: %s, %d residues, %d mapped, identity %.3f'
                % (F['pdb'], out_chain, spec['allele'], len(rows), len(mapping), identity))
            if identity < 0.98:
                raise SystemExit('template %s chain %s does not match %s' % (F['pdb'], out_chain, spec['allele']))
        out['chains'][out_chain] = entry
    # alanine peptide: backbone + CB (Gly has no CB; PDBFixer adds it)
    out['chains']['C'] = {'residues': [['ALA', [a for a in r[4] if a[0] in BACKBONE + ('CB',)]] for r in pep],
                          'seq': 'A' * len(pep)}
    xyz = np.array([a[2] for ch in out['chains'].values() for r in ch['residues'] for a in r[1]])
    out['center'] = ((xyz.min(axis=0) + xyz.max(axis=0)) / 2).round(3).tolist()
    out['extent'] = (xyz.max(axis=0) - xyz.min(axis=0)).round(1).tolist()
    text = json.dumps(out)                 # serialise first so a failure leaves no partial cache
    with open(cache, 'w') as fh:
        fh.write(text)
    return out


# --------------------------------------------------------------------------- molecules
def molecule_chains(mol):
    """'A*02:01' -> {'A': 'A*02:01'}; 'DQA1*03:01~DQB1*03:02' -> {'A': ..., 'B': ...}."""
    parts = mol.split('~')
    fam = FAMILY_OF[parts[0].split('*')[0]]
    T = FAMILIES[fam]['chains']
    assign = {}
    for p in parts:
        locus = p.split('*')[0]
        for ch, spec in T.items():
            if 'locus' in spec and (spec['locus'] == locus or (fam in ('I', 'DR'))):
                assign[ch] = p
                break
    return fam, assign


DELETION_WINDOW = 2       # residues on each side of a deletion left free to close the backbone


def thread(tpl, assign):
    """Template residues with the target allele's residues substituted (side chains removed).

    A residue the allele does not have (a gap in the IMGT alignment, as in the 232 DQA1 alleles
    of the *02/*04/*05/*06 groups, which are one residue shorter at 56 than the DQA1*03:01 of the
    1JK8 template) is left out of the model. Residues keep consecutive numbers, so OpenMM bonds
    the two sides of the junction, and DELETION_WINDOW residues on each side are reported as
    free: build_model lets the minimiser close the peptide bond there instead of leaving a chain
    break, which PDB2PQR would cap with an artificial pair of charged termini."""
    residues, mutated, free = [], [], []
    for ch in ('A', 'B', 'C'):
        entry = tpl['chains'][ch]
        target = None
        if ch in assign:
            target, why = allele_seq(assign[ch])
            if target is None:
                raise ValueError('%s: %s' % (assign[ch], why))
        kept, deleted_at = [], []
        for i, (resname, atoms) in enumerate(entry['residues']):
            if target is not None:
                pos = entry['imgt'][i]
                if pos is None or pos > len(target):
                    raise ValueError('%s: template residue %d has no IMGT position' % (assign[ch], i + 1))
                want_aa = target[pos - 1]
                if want_aa == '.':                         # the allele lacks this residue
                    deleted_at.append(len(kept))
                    continue
                want = ONE[want_aa]
                if want != resname:
                    keep = BACKBONE + (('CB',) if want != 'GLY' and resname != 'GLY' else ())
                    atoms = [a for a in atoms if a[0] in keep]
                    resname = want
                    kept.append((resname, atoms, True))
                    continue
            kept.append((resname, atoms, False))
        for k, (resname, atoms, changed) in enumerate(kept):
            num = k + 1
            if changed:
                mutated.append((ch, num))
            residues.append((ch, num, resname, atoms))
        for cut in deleted_at:
            for k in range(max(0, cut - DELETION_WINDOW), min(len(kept), cut + DELETION_WINDOW)):
                if (ch, k + 1) not in free:
                    free.append((ch, k + 1))
    return residues, mutated, free


def build_model(mol, tpl, out_pdb):
    """Thread, complete side chains (PDBFixer), relax with restraints (OpenMM), write heavy atoms."""
    import openmm as mm
    from openmm import app, unit
    from pdbfixer import PDBFixer

    fam, assign = molecule_chains(mol)
    residues, mutated, free = thread(tpl, assign)
    fd, tmp = tempfile.mkstemp(prefix='threaded_', suffix='.pdb')
    os.close(fd)
    write_pdb(tmp, residues)

    fixer = PDBFixer(filename=tmp)
    fixer.findMissingResidues()
    fixer.missingResidues = {}
    fixer.findMissingAtoms()
    fixer.addMissingAtoms(seed=SEED)
    random.seed(SEED)                       # OpenMM's Modeller places new hydrogens at random offsets
    fixer.addMissingHydrogens(PH)
    os.remove(tmp)

    # The relaxation only has to clear clashes around the substituted side chains (everything
    # else is restrained), so a 1 nm cutoff in vacuum is enough; implicit solvent with no cutoff
    # took minutes per model for no change in what the restraints allow to move.
    ff = app.ForceField('amber14-all.xml')
    system = ff.createSystem(fixer.topology, nonbondedMethod=app.CutoffNonPeriodic,
                             nonbondedCutoff=1.0 * unit.nanometer, constraints=app.HBonds)
    restraint = mm.CustomExternalForce('0.5*k*((x-x0)^2+(y-y0)^2+(z-z0)^2)')
    restraint.addGlobalParameter('k', 5000.0 * unit.kilojoule_per_mole / unit.nanometer ** 2)
    for p in ('x0', 'y0', 'z0'):
        restraint.addPerParticleParameter(p)
    moved = {(c, n) for c, n in mutated}
    loose = {(c, n) for c, n in free}
    pos = fixer.positions
    for atom in fixer.topology.atoms():
        if atom.element is None or atom.element.symbol == 'H':
            continue
        key = (atom.residue.chain.id, int(atom.residue.id))
        if key in loose:
            continue                                      # around a deletion: free, to close the backbone
        if key in moved and atom.name not in BACKBONE and atom.residue.chain.id != 'C':
            continue                                      # substituted side chains are free
        restraint.addParticle(atom.index, pos[atom.index].value_in_unit(unit.nanometer))
    system.addForce(restraint)
    integrator = mm.LangevinMiddleIntegrator(310 * unit.kelvin, 1 / unit.picosecond, 0.002 * unit.picoseconds)
    platform = mm.Platform.getPlatformByName('CPU')
    sim = app.Simulation(fixer.topology, system, integrator, platform, {'Threads': '1'})
    sim.context.setPositions(pos)
    sim.minimizeEnergy(maxIterations=300)
    state = sim.context.getState(getPositions=True, getEnergy=True)

    modeller = app.Modeller(fixer.topology, state.getPositions())
    modeller.delete([a for a in modeller.topology.atoms() if a.element is not None and a.element.symbol == 'H'])
    with open(out_pdb, 'w') as fh:
        app.PDBFile.writeFile(modeller.topology, modeller.positions, fh, keepIds=True)
    return len(mutated), state.getPotentialEnergy().value_in_unit(unit.kilojoule_per_mole)


# --------------------------------------------------------------------------- electrostatics
APBS_IN = """read
    mol pqr {pqr}
end
elec name pot
    mg-manual
    dime {dime} {dime} {dime}
    glen {box:.3f} {box:.3f} {box:.3f}
    gcent {cx:.3f} {cy:.3f} {cz:.3f}
    mol 1
    lpbe
    bcfl sdh
    pdie 2.0
    sdie 78.0
    ion charge 1 conc 0.150 radius 2.0
    ion charge -1 conc 0.150 radius 2.0
    srfm smol
    chgm spl2
    sdens 10.0
    srad 1.4
    swin 0.3
    temp 310.0
    calcenergy no
    calcforce no
    write pot dx {out}
end
quit
"""


def read_dx(path):
    with open(path) as fh:
        header, counts, origin, deltas = [], None, None, []
        while True:
            line = fh.readline()
            if line.startswith('object 1'):
                counts = [int(v) for v in line.split()[-3:]]
            elif line.startswith('origin'):
                origin = [float(v) for v in line.split()[1:4]]
            elif line.startswith('delta'):
                deltas.append([float(v) for v in line.split()[1:4]])
            elif line.startswith('object 3'):
                break
        n = counts[0] * counts[1] * counts[2]
        values = np.fromstring(fh.read().split('attribute')[0], sep=' ', dtype=np.float64)
    if values.size != n:
        raise ValueError('dx has %d values, expected %d' % (values.size, n))
    return values.reshape(counts), np.array(origin), np.array([deltas[0][0], deltas[1][1], deltas[2][2]])


def read_pqr(path):
    xyz, radius, charge = [], [], []
    with open(path) as fh:
        for line in fh:
            if line.startswith(('ATOM', 'HETATM')):
                f = line[30:].split()
                xyz.append([float(f[0]), float(f[1]), float(f[2])])
                charge.append(float(f[3]))
                radius.append(float(f[4]))
    return np.array(xyz), np.array(radius), np.array(charge)


def skin_points(pqr_xyz, radii, origin, h, dime):
    """Flat indices (on the SKIN_STEP sub-grid) of points SIGMA..SIGMA+DELTA from the vdW surface."""
    from scipy.spatial import cKDTree
    m = (dime - 1) // SKIN_STEP + 1
    ax = [origin[d] + np.arange(m) * h[d] * SKIN_STEP for d in range(3)]
    X, Y, Z = np.meshgrid(ax[0], ax[1], ax[2], indexing='ij')
    pts = np.stack([X.ravel(), Y.ravel(), Z.ravel()], axis=1)
    tree = cKDTree(pqr_xyz)
    reach = SIGMA + DELTA + radii.max() + 0.5
    near, _ = tree.query(pts, k=1, distance_upper_bound=reach)
    cand = np.where(np.isfinite(near) & (near >= SIGMA))[0]
    d, idx = tree.query(pts[cand], k=16, distance_upper_bound=reach)
    ok = np.isfinite(d)
    surf = np.where(ok, d - radii[np.where(ok, idx, 0)], np.inf).min(axis=1)
    keep = cand[(surf >= SIGMA) & (surf <= SIGMA + DELTA)]
    return keep.astype(np.int32), m


_APBS_SLOTS = None


def _init_worker(slots):
    global _APBS_SLOTS
    _APBS_SLOTS = slots


def potentials(mol, tpl, model_pdb, out_npz, dime, keep_pqr_dir=None):
    tmp = tempfile.mkdtemp(prefix='ems3d_')
    try:
        pqr = os.path.join(tmp, 'model.pqr')
        cmd = ['pdb2pqr', '--ff=PARSE', '--titration-state-method=propka', '--with-ph=%.1f' % PH,
               '--drop-water', '--log-level=WARNING', model_pdb, pqr]
        r = subprocess.run(cmd, capture_output=True, text=True, cwd=tmp)
        if r.returncode != 0 or not os.path.exists(pqr):
            raise RuntimeError('pdb2pqr failed: ' + (r.stderr or r.stdout)[-800:])
        cx, cy, cz = tpl['center']
        with open(os.path.join(tmp, 'apbs.in'), 'w') as fh:
            fh.write(APBS_IN.format(pqr=pqr, dime=dime, box=BOX, cx=cx, cy=cy, cz=cz,
                                    out=os.path.join(tmp, 'pot')))
        if _APBS_SLOTS is not None:
            _APBS_SLOTS.acquire()
        try:
            r = subprocess.run(['apbs', 'apbs.in'], capture_output=True, text=True, cwd=tmp)
        finally:
            if _APBS_SLOTS is not None:
                _APBS_SLOTS.release()
        # Debian's MPI-enabled build names the file pot-PE0.dx
        found = sorted(f for f in os.listdir(tmp) if f.startswith('pot') and f.endswith('.dx'))
        if not found or 'Thanks for using APBS' not in r.stdout:
            raise RuntimeError('apbs failed (exit %d): %s' % (r.returncode, (r.stdout + r.stderr)[-800:]))
        dx = os.path.join(tmp, found[0])
        grid, origin, h = read_dx(dx)
        xyz, radii, charge = read_pqr(pqr)
        idx, m = skin_points(xyz, radii, origin, h, dime)
        sub = grid[::SKIN_STEP, ::SKIN_STEP, ::SKIN_STEP].ravel()
        np.savez_compressed(out_npz + '.part.npz', name=np.array(mol), idx=idx, pot=sub[idx].astype(np.float32), m=m,
                            origin=origin, h=h * SKIN_STEP, charge=float(charge.sum()))
        os.replace(out_npz + '.part.npz', out_npz)
        if keep_pqr_dir:
            shutil.copy(pqr, os.path.join(keep_pqr_dir, safe(mol) + '.pqr'))
        return len(idx), float(charge.sum())
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def process(mol, dime, tag, models_only=False):
    """model (+ potentials) for one molecule; returns a status dict (never raises)."""
    t0 = time.time()
    fam, _ = molecule_chains(mol)
    tpl = prepare_template(fam)
    mdir = os.path.join(WORK, 'models', fam)
    sdir = os.path.join(WORK, 'skins_' + tag, fam)
    os.makedirs(mdir, exist_ok=True)
    os.makedirs(sdir, exist_ok=True)
    pdb = os.path.join(mdir, safe(mol) + '.pdb')
    npz = os.path.join(sdir, safe(mol) + '.npz')
    status = {'mol': mol, 'family': fam}
    try:
        if not os.path.exists(pdb):
            n_mut, energy = build_model(mol, tpl, pdb + '.part')
            os.replace(pdb + '.part', pdb)          # a killed run never leaves a half-written model
            status.update(mutations=n_mut, energy=round(energy, 1))
        if not models_only and not os.path.exists(npz):
            n_pts, q = potentials(mol, tpl, pdb, npz, dime)
            status.update(skin_points=n_pts, net_charge=round(q, 2))
        status['ok'] = True
    except ValueError as exc:                       # cannot be modelled (indel, missing residues)
        status.update(ok=False, skipped=str(exc))
    except Exception as exc:                        # noqa: BLE001 - report and continue
        status.update(ok=False, error='%s: %s' % (type(exc).__name__, exc),
                      trace=traceback.format_exc()[-1500:])
    status['seconds'] = round(time.time() - t0, 1)
    return status


# --------------------------------------------------------------------------- molecule sets
def engine_alleles():
    with open(REF_JSON, encoding='utf-8') as fh:
        ref = json.load(fh)
    out = set()
    for key in ('classI', 'classIIB', 'classIIA'):
        out |= set(ref[key]['alleles'])
    return ref, out


def molecule_set(name):
    ref, engine = engine_alleles()
    by_locus = {}
    for a in engine:
        by_locus.setdefault(a.split('*')[0], []).append(a)
    for v in by_locus.values():
        v.sort()
    mols = []
    if name in ('core', 'engine', 'I', 'DR', 'DQ', 'DP'):
        # every allele of the eplet engine (HLAMatchmaker tables); DQ heterodimers that follow the
        # DQA1*01 <-> DQB1*05/06 pairing rule; DP with the five DPA1 alleles that carry almost all
        # DP haplotypes worldwide
        if name in ('core', 'engine', 'I'):
            mols += by_locus['A'] + by_locus['B'] + by_locus['C']
        if name in ('core', 'engine', 'DR'):
            for l in ('DRB1', 'DRB3', 'DRB4', 'DRB5'):
                mols += by_locus.get(l, [])
        if name in ('core', 'engine', 'DQ'):
            mols += ['%s~%s' % (a, b) for a in by_locus['DQA1'] for b in by_locus['DQB1']
                     if a.startswith('DQA1*01:') == b.startswith(('DQB1*05:', 'DQB1*06:'))]
        if name in ('core', 'engine', 'DP'):
            common_dpa = ['DPA1*01:03', 'DPA1*02:01', 'DPA1*02:02', 'DPA1*03:01', 'DPA1*04:01']
            mols += ['%s~%s' % (a, b) for a in common_dpa if a in by_locus['DPA1'] for b in by_locus['DPB1']]
    elif name.startswith('list:'):
        with open(name[5:]) as fh:
            mols = [l.strip() for l in fh if l.strip() and not l.startswith('#')]
    else:
        mols = [m.strip() for m in name.split(',') if m.strip()]
    return mols


# --------------------------------------------------------------------------- comparison
def compare_group(files):
    """ESD matrix for molecules whose skins are in `files` (same family grid)."""
    idx_all, data = [], []
    for f in files:
        z = np.load(f)
        idx_all.append(z['idx'])
        data.append(z['pot'])
    union = np.unique(np.concatenate(idx_all))
    n, p = len(files), len(union)
    phi = np.zeros((n, p), dtype=np.float64)
    mask = np.zeros((n, p), dtype=np.float64)
    for r, (ix, pot) in enumerate(zip(idx_all, data)):
        cols = np.searchsorted(union, ix)
        phi[r, cols] = pot
        mask[r, cols] = 1.0
    cross = phi @ phi.T                    # sum over Sa & Sb of pa*pb (phi is 0 outside a skin)
    own = (phi * phi) @ mask.T             # [a, b] = sum over Sa & Sb of pa^2
    denom = own + own.T
    with np.errstate(invalid='ignore', divide='ignore'):
        si = np.where(denom > 0, 2 * cross / denom, 1.0)
    si = np.clip(si, -1, 1)
    np.fill_diagonal(si, 1.0)
    esd = np.sqrt(np.maximum(0.0, 2 - 2 * si))
    overlap = mask @ mask.T
    return esd, overlap, p


def group_of(mol):
    first = mol.split('~')[0].split('*')[0]
    fam = FAMILY_OF[first]
    return 'I' if fam == 'I' else (first if fam == 'DR' else fam)


def export(tag, dime):
    """hla_ems3d_meta.js (names, always loaded) + hla_ems3d_<family>.js (distances, loaded on demand)."""
    groups = {}
    status = {}
    # model failures first, then potential failures (a molecule is unscored if either failed)
    for name in ('status_models.json', 'status_%s.json' % tag):
        path = os.path.join(WORK, name)
        if os.path.exists(path):
            with open(path) as fh:
                for m, s_ in json.load(fh).items():
                    if m.startswith('_') or (m in status and not status[m].get('ok')):
                        continue
                    status[m] = s_
    for fam in FAMILIES:
        sdir = os.path.join(WORK, 'skins_' + tag, fam)
        if not os.path.isdir(sdir):
            continue
        for f in sorted(os.listdir(sdir)):
            if not f.endswith('.npz'):
                continue
            path = os.path.join(sdir, f)
            with np.load(path) as z:
                mol = str(z['name']) if 'name' in z.files else unsafe(f[:-4], fam)
            groups.setdefault(group_of(mol), []).append((mol, path))
    unscored = {m: (s.get('skipped') or s.get('error', '')[:160]) for m, s in status.items()
                if not m.startswith('_') and not s.get('ok')}
    meta = {'built': datetime.date.today().isoformat(), 'method': 'EMS3D (Mallon et al. 2018)',
            'templates': {f: FAMILIES[f]['pdb'] for f in FAMILIES},
            'grid': {'box': BOX, 'dime': dime, 'spacing': round(BOX / (dime - 1), 4),
                     'skin_spacing': round(BOX / (dime - 1) * SKIN_STEP, 4)},
            'skin': {'sigma': SIGMA, 'delta': DELTA}, 'ph': PH,
            'imgt': sequences()['meta']['imgt'], 'scale': 1000, 'groups': {},
            'unscored': len(unscored)}
    names_out, tables = {}, {}
    for g in GROUPS:
        if g not in groups:
            continue
        items = sorted(groups[g], key=lambda t: t[0])
        names = [t[0] for t in items]
        esd, overlap, p = compare_group([t[1] for t in items])
        iu = np.triu_indices(len(names), 1)
        vals = esd[iu]
        q = np.clip(np.rint(vals * 1000), 0, 2000).astype(np.uint16)
        names_out[g] = {'names': names}
        tables.setdefault(FAMILY_OF_GROUP[g], {})[g] = _b64(q)
        off = vals if vals.size else np.array([0.0])
        own = np.maximum(1, np.diag(overlap))
        meta['groups'][g] = {
            'molecules': len(names), 'pairs': int(vals.size), 'union_points': int(p),
            'esd_min': round(float(off.min()), 4), 'esd_median': round(float(np.median(off)), 4),
            'esd_q1': round(float(np.percentile(off, 25)), 4), 'esd_q3': round(float(np.percentile(off, 75)), 4),
            'esd_max': round(float(off.max()), 4),
            'min_overlap_fraction': round(float((overlap / own[:, None]).min()), 4),
        }
        np.save(os.path.join(WORK, 'esd_%s_%s.npy' % (tag, g)), esd.astype(np.float32))
        with open(os.path.join(WORK, 'esd_%s_%s.names.json' % (tag, g)), 'w') as fh:
            json.dump(names, fh)
        log('group %-5s %5d molecules, %9d pairs, median ESD %.3f (IQR %.3f-%.3f), max %.3f'
            % (g, len(names), vals.size, np.median(off), np.percentile(off, 25), np.percentile(off, 75), off.max()))

    head = '/* GENERATED by tools/ems3d/build_ems3d.py - %s. Do not edit by hand. */\n'
    path = os.path.join(APP, 'hla_ems3d_meta.js')
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(head % 'EMS3D library: molecule names per comparison group and build settings')
        fh.write('window.HLA_EMS3D_DATA = ')
        json.dump({'meta': meta, 'families': {}, 'groups': names_out, 'unscored': unscored}, fh, separators=(',', ':'))
        fh.write(';\n')
    log('wrote %s (%.2f MB)' % (path, os.path.getsize(path) / 1e6))
    for fam, by_group in tables.items():
        path = os.path.join(APP, 'hla_ems3d_%s.js' % fam)
        with open(path, 'w', encoding='utf-8') as fh:
            fh.write(head % ('EMS3D electrostatic distances, family %s: upper triangle of each group, row-major, '
                             'uint16 little-endian, ESD x 1000, base64' % fam))
            fh.write('(function (E) {\n    if (!E) return;\n')
            for g, b64 in by_group.items():
                fh.write('    E.groups[%s].esd = %s;\n' % (json.dumps(g), json.dumps(b64)))
            fh.write('    E.families[%s] = true;\n})(window.HLA_EMS3D_DATA);\n' % json.dumps(fam))
        log('wrote %s (%.2f MB)' % (path, os.path.getsize(path) / 1e6))


FAMILY_OF_GROUP = {'I': 'I', 'DRB1': 'DR', 'DRB3': 'DR', 'DRB4': 'DR', 'DRB5': 'DR', 'DQ': 'DQ', 'DP': 'DP'}


def _b64(arr):
    import base64
    return base64.b64encode(arr.astype('<u2').tobytes()).decode('ascii')


def unsafe(stem, fam):
    """File stem back to the molecule name ('DQA1_03_01_DQB1_03_02' -> 'DQA1*03:01~DQB1*03:02')."""
    parts = re.findall(r'([A-Z]+[0-9]*)_(\d+)_(\d+)', stem)
    names = ['%s*%s:%s' % p for p in parts]
    return '~'.join(names)


# --------------------------------------------------------------------------- cli
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('stage', choices=['templates', 'run', 'export'])
    ap.add_argument('--set', default='core', help="'core', 'list:<file>' or comma-separated molecules")
    ap.add_argument('--workers', type=int, default=8)
    ap.add_argument('--dime', type=int, default=193, help='APBS grid points per side (c*2^(l+1)+1)')
    ap.add_argument('--tag', default=None, help='cache tag for skins (default d<dime>)')
    ap.add_argument('--apbs-slots', type=int, default=4, help='APBS runs allowed at once (memory)')
    ap.add_argument('--potentials-only', action='store_true',
                    help='only compute potentials, for molecules whose model already exists; with --follow, '
                         'keep going while a --models-only run is still producing models')
    ap.add_argument('--follow', action='store_true')
    ap.add_argument('--chunk', type=int, default=0,
                    help='process at most this many molecules, then exit (OpenMM/PDBFixer workers grow by a few '
                         'MB per model and max_tasks_per_child deadlocked the pool, so long runs are looped in chunks)')
    ap.add_argument('--models-only', action='store_true',
                    help='only build the structural models (CPU-bound); run the potentials afterwards '
                         'with fewer workers, because APBS needs about 1.5 GB per run at dime 193')
    ap.add_argument('--limit', type=int, default=0)
    args = ap.parse_args()
    tag = args.tag or 'd%d' % args.dime

    if args.stage == 'templates':
        for fam in FAMILIES:
            t = prepare_template(fam)
            log(fam, t['pdb'], 'center', t['center'], 'extent', t['extent'])
        return
    if args.stage == 'export':
        export(tag, args.dime)
        return

    for fam in FAMILIES:
        prepare_template(fam)
    mols = molecule_set(args.set)
    if args.limit:
        mols = mols[:args.limit]
    status_path = os.path.join(WORK, 'status_models.json' if args.models_only else 'status_%s.json' % tag)
    status = {}
    if os.path.exists(status_path):
        with open(status_path) as fh:
            status = json.load(fh)
    status.pop('_tried', None)
    # molecules that cannot be modelled (not in IMGT, indels) are final; errors are retried
    todo = [m for m in mols if not status.get(m, {}).get('ok') and not status.get(m, {}).get('skipped')]
    remaining_after = 0
    if args.chunk and len(todo) > args.chunk:
        remaining_after = len(todo) - args.chunk
        todo = todo[:args.chunk]
    log('%d molecules requested, %d to do, %d workers, dime %d' % (len(mols), len(todo), args.workers, args.dime))
    done = 0
    t0 = time.time()
    import multiprocessing as mp
    manager = mp.Manager()
    slots = manager.Semaphore(args.apbs_slots)
    done_marker = os.path.join(WORK, 'models_done')
    if args.models_only and os.path.exists(done_marker) and not args.chunk:
        os.remove(done_marker)
    if args.potentials_only:
        follow(mols, status, status_path, args, tag, slots, done_marker)
        return
    with cf.ProcessPoolExecutor(max_workers=args.workers, initializer=_init_worker, initargs=(slots,)) as pool:
        futures = {pool.submit(process, m, args.dime, tag, args.models_only): m for m in todo}
        for fut in cf.as_completed(futures):
            s = fut.result()
            status[s['mol']] = s
            done += 1
            if not s.get('ok'):
                log('  %-26s %s' % (s['mol'], s.get('skipped') or s.get('error')))
            if done % 25 == 0 or done == len(todo):
                rate = done / max(1e-9, time.time() - t0)
                log('%d/%d done (%.2f/s, eta %.0f min)' % (done, len(todo), rate, (len(todo) - done) / max(rate, 1e-9) / 60))
                with open(status_path, 'w') as fh:
                    json.dump(status, fh, indent=0)
    with open(status_path, 'w') as fh:
        json.dump(status, fh, indent=0)
    ok = sum(1 for m in mols if status.get(m, {}).get('ok'))
    log('finished: %d of %d molecules %s' % (ok, len(mols), 'modelled' if args.models_only else 'scored'))
    if args.models_only and not remaining_after and all(
            status.get(m, {}).get('ok') or status.get(m, {}).get('skipped') for m in mols):
        with open(done_marker, 'w') as fh:
            fh.write(time.strftime('%Y-%m-%d %H:%M:%S'))
    elif remaining_after:
        log('%d molecules left for the next chunk' % remaining_after)


def model_path(mol):
    fam, _ = molecule_chains(mol)
    return os.path.join(WORK, 'models', fam, safe(mol) + '.pdb')


def follow(mols, status, status_path, args, tag, slots, done_marker):
    """Score molecules as their models appear; stop when the models run has finished."""
    t0 = time.time()
    done = 0
    with cf.ProcessPoolExecutor(max_workers=args.workers, initializer=_init_worker, initargs=(slots,)) as pool:
        while True:
            finished_models = os.path.exists(done_marker)
            ready = [m for m in mols if not status.get(m, {}).get('ok') and m not in status.get('_tried', [])
                     and os.path.exists(model_path(m))]
            if not ready:
                if finished_models:
                    break
                time.sleep(20)
                continue
            futures = [pool.submit(process, m, args.dime, tag, False) for m in ready]
            for fut in cf.as_completed(futures):
                s = fut.result()
                status[s['mol']] = s
                if not s.get('ok'):
                    status.setdefault('_tried', []).append(s['mol'])
                    log('  %-26s %s' % (s['mol'], s.get('skipped') or s.get('error')))
                done += 1
                if done % 25 == 0:
                    log('%d scored (%.2f/s)' % (done, done / max(1e-9, time.time() - t0)))
                    with open(status_path, 'w') as fh:
                        json.dump(status, fh, indent=0)
            with open(status_path, 'w') as fh:
                json.dump(status, fh, indent=0)
    ok = sum(1 for m in mols if status.get(m, {}).get('ok'))
    log('finished: %d of %d molecules scored' % (ok, len(mols)))


if __name__ == '__main__':
    sys.exit(main())
