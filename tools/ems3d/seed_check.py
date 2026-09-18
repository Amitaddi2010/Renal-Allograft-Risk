"""seed_check.py — how much of an ESD is modelling noise?

Builds five class I alleles with three different random seeds (the only stochastic step is
the placement of new side chains and hydrogens before relaxation), computes their skins, and
compares the ESD between models of the SAME allele with the ESD between DIFFERENT alleles.
Run inside the ramrt-ems3d container:  python tools/ems3d/seed_check.py [n_models] [dime]
"""
import concurrent.futures as cf
import itertools
import os
import sys
import tempfile

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_ems3d as B  # noqa: E402

MOLS = ['A*02:01', 'A*01:01', 'B*07:02', 'B*08:01', 'C*07:01']


def one(args):
    mol, seed, n_models, work, dime = args
    B.SEED = seed
    tpl = B.prepare_template('I')
    pdb = os.path.join(work, '%s_%d.pdb' % (B.safe(mol), seed))
    B.build_model(mol, tpl, pdb)
    npz = pdb[:-4] + '.npz'
    B.potentials(mol, tpl, pdb, npz, dime)
    return mol, seed, npz


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    dime = int(sys.argv[2]) if len(sys.argv) > 2 else 193
    work = tempfile.mkdtemp(prefix='seed_')
    jobs = [(m, 1000 + k, n, work, dime) for m in MOLS for k in range(n)]
    with cf.ProcessPoolExecutor(max_workers=min(8, len(jobs))) as pool:
        res = list(pool.map(one, jobs))
    labels = [(m, s) for m, s, _ in res]
    esd, _, _ = B.compare_group([f for _, _, f in res])
    same, diff = [], []
    for i, j in itertools.combinations(range(len(res)), 2):
        (same if labels[i][0] == labels[j][0] else diff).append(esd[i, j])
    print('ESD between models of the same allele: median %.3f, max %.3f (%d pairs)'
          % (np.median(same), np.max(same), len(same)))
    print('ESD between different alleles:          median %.3f, min %.3f, max %.3f (%d pairs)'
          % (np.median(diff), np.min(diff), np.max(diff), len(diff)))
    # mean over models, per allele pair
    k = len(MOLS)
    mean = np.zeros((k, k))
    for a in range(k):
        for b in range(k):
            vals = [esd[i, j] for i in range(len(res)) for j in range(len(res))
                    if labels[i][0] == MOLS[a] and labels[j][0] == MOLS[b] and i != j]
            mean[a, b] = np.mean(vals) if vals else 0
    print('mean ESD by allele pair (diagonal = same allele, different seeds):')
    print('         ' + ' '.join('%9s' % m for m in MOLS))
    for a in range(k):
        print('%9s' % MOLS[a] + ' '.join('%9.3f' % mean[a, b] for b in range(k)))


if __name__ == '__main__':
    main()
