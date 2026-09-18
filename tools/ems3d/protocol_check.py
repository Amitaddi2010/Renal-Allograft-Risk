"""protocol_check.py — which relaxation protocol gives the least arbitrary EMS3D?

The only stochastic step in model building is where new side chains and hydrogens start
before relaxation. Models of the SAME allele built from different starting points should
ideally give the same electrostatic surface, i.e. an ESD near 0; whatever ESD remains is a
noise floor that adds to every pair of different alleles.

For each protocol this builds 5 class I alleles x 3 random starts and reports the ESD within
an allele (noise) against the ESD between alleles (signal).

    python tools/ems3d/protocol_check.py [dime]

Protocols
    vacuum   amber14, 1 nm cutoff, no solvent      (what build_ems3d.build_model does)
    obc2     amber14 + OBC2 implicit solvent, 1.2 nm cutoff
    fixer    PDBFixer placement only, no relaxation
"""
import concurrent.futures as cf
import itertools
import os
import sys
import tempfile
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_ems3d as B  # noqa: E402

MOLS = ['A*02:01', 'A*01:01', 'B*07:02', 'B*08:01', 'C*07:01']
SEEDS = [1000, 1001, 1002]


def build(mol, tpl, out_pdb, protocol):
    import openmm as mm
    from openmm import app, unit
    from pdbfixer import PDBFixer
    import random

    fam, assign = B.molecule_chains(mol)
    residues, mutated = B.thread(tpl, assign)
    fd, tmp = tempfile.mkstemp(suffix='.pdb')
    os.close(fd)
    B.write_pdb(tmp, residues)
    fixer = PDBFixer(filename=tmp)
    fixer.findMissingResidues()
    fixer.missingResidues = {}
    fixer.findMissingAtoms()
    fixer.addMissingAtoms(seed=B.SEED)
    os.remove(tmp)
    if protocol == 'fixer':
        with open(out_pdb, 'w') as fh:
            app.PDBFile.writeFile(fixer.topology, fixer.positions, fh, keepIds=True)
        return
    random.seed(B.SEED)
    fixer.addMissingHydrogens(B.PH)
    if protocol == 'obc2':
        ff = app.ForceField('amber14-all.xml', 'implicit/obc2.xml')
        system = ff.createSystem(fixer.topology, nonbondedMethod=app.CutoffNonPeriodic,
                                 nonbondedCutoff=1.2 * unit.nanometer, constraints=app.HBonds)
    else:
        ff = app.ForceField('amber14-all.xml')
        system = ff.createSystem(fixer.topology, nonbondedMethod=app.CutoffNonPeriodic,
                                 nonbondedCutoff=1.0 * unit.nanometer, constraints=app.HBonds)
    restraint = mm.CustomExternalForce('0.5*k*((x-x0)^2+(y-y0)^2+(z-z0)^2)')
    restraint.addGlobalParameter('k', 5000.0 * unit.kilojoule_per_mole / unit.nanometer ** 2)
    for p in ('x0', 'y0', 'z0'):
        restraint.addPerParticleParameter(p)
    moved = {(c, n) for c, n in mutated}
    pos = fixer.positions
    for atom in fixer.topology.atoms():
        if atom.element is None or atom.element.symbol == 'H':
            continue
        key = (atom.residue.chain.id, int(atom.residue.id))
        if key in moved and atom.name not in B.BACKBONE and atom.residue.chain.id != 'C':
            continue
        restraint.addParticle(atom.index, pos[atom.index].value_in_unit(unit.nanometer))
    system.addForce(restraint)
    sim = app.Simulation(fixer.topology, system, mm.LangevinMiddleIntegrator(
        310 * unit.kelvin, 1 / unit.picosecond, 0.002 * unit.picoseconds),
        mm.Platform.getPlatformByName('CPU'), {'Threads': '1'})
    sim.context.setPositions(pos)
    sim.minimizeEnergy(maxIterations=300)
    state = sim.context.getState(getPositions=True)
    modeller = app.Modeller(fixer.topology, state.getPositions())
    modeller.delete([a for a in modeller.topology.atoms() if a.element is not None and a.element.symbol == 'H'])
    with open(out_pdb, 'w') as fh:
        app.PDBFile.writeFile(modeller.topology, modeller.positions, fh, keepIds=True)


def one(args):
    mol, seed, protocol, work, dime = args
    B.SEED = seed
    tpl = B.prepare_template('I')
    pdb = os.path.join(work, '%s_%s_%d.pdb' % (B.safe(mol), protocol, seed))
    t = time.time()
    build(mol, tpl, pdb, protocol)
    dt = time.time() - t
    npz = pdb[:-4] + '.npz'
    B.potentials(mol, tpl, pdb, npz, dime)
    return protocol, mol, npz, dt


def main():
    dime = int(sys.argv[1]) if len(sys.argv) > 1 else 193
    work = tempfile.mkdtemp(prefix='proto_')
    jobs = [(m, s, p, work, dime) for p in ('vacuum', 'obc2', 'fixer') for m in MOLS for s in SEEDS]
    with cf.ProcessPoolExecutor(max_workers=6) as pool:
        res = list(pool.map(one, jobs))
    for protocol in ('vacuum', 'obc2', 'fixer'):
        rows = [r for r in res if r[0] == protocol]
        esd, _, _ = B.compare_group([r[2] for r in rows])
        same, diff = [], []
        for i, j in itertools.combinations(range(len(rows)), 2):
            (same if rows[i][1] == rows[j][1] else diff).append(esd[i, j])
        print('%-7s model %5.1f s | same allele: median %.3f max %.3f | different alleles: median %.3f min %.3f'
              % (protocol, np.mean([r[3] for r in rows]), np.median(same), np.max(same),
                 np.median(diff), np.min(diff)), flush=True)


if __name__ == '__main__':
    main()
