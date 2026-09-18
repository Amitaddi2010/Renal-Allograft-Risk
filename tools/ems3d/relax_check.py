"""relax_check.py — does the OpenMM relaxation after PDBFixer change EMS3D?

Builds five class I models two ways (PDBFixer placement only; PDBFixer + the restrained
OpenMM minimisation of build_ems3d.build_model), computes their skins at dime 193 and
compares (1) the ESD matrices and (2) each allele's two models with each other.
Run inside the ramrt-ems3d container: python tools/ems3d/relax_check.py
"""
import os
import sys
import tempfile
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_ems3d as B  # noqa: E402

MOLS = ['A*02:01', 'A*01:01', 'B*07:02', 'B*08:01', 'C*07:01']
DIME = 193


def fixer_only(mol, tpl, out_pdb):
    from openmm import app
    from pdbfixer import PDBFixer
    fam, assign = B.molecule_chains(mol)
    residues, mutated = B.thread(tpl, assign)
    fd, tmp = tempfile.mkstemp(suffix='.pdb')
    os.close(fd)
    B.write_pdb(tmp, residues)
    fixer = PDBFixer(filename=tmp)
    fixer.findMissingResidues()
    fixer.missingResidues = {}
    fixer.findMissingAtoms()
    fixer.addMissingAtoms()
    os.remove(tmp)
    with open(out_pdb, 'w') as fh:
        app.PDBFile.writeFile(fixer.topology, fixer.positions, fh, keepIds=True)


def main():
    tpl = B.prepare_template('I')
    work = tempfile.mkdtemp(prefix='relax_')
    files = {'relaxed': [], 'fixer': []}
    for m in MOLS:
        for kind in files:
            pdb = os.path.join(work, '%s_%s.pdb' % (B.safe(m), kind))
            t = time.time()
            if kind == 'relaxed':
                B.build_model(m, tpl, pdb)
            else:
                fixer_only(m, tpl, pdb)
            t_model = time.time() - t
            npz = pdb[:-4] + '.npz'
            B.potentials(m, tpl, pdb, npz, DIME)
            files[kind].append(npz)
            print('%-8s %-8s model %.1f s' % (m, kind, t_model), flush=True)
    ea, _, _ = B.compare_group(files['relaxed'])
    eb, _, _ = B.compare_group(files['fixer'])
    print('ESD, relaxed models:\n', np.round(ea, 4))
    print('ESD, PDBFixer-only models:\n', np.round(eb, 4))
    print('max |difference| = %.4f' % np.abs(ea - eb).max())
    both, _, _ = B.compare_group(files['relaxed'] + files['fixer'])
    n = len(MOLS)
    print('ESD between the two models of the same allele:',
          ', '.join('%s %.4f' % (m, both[i, n + i]) for i, m in enumerate(MOLS)))


if __name__ == '__main__':
    main()
