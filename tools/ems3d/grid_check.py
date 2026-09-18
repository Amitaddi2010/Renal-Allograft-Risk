"""ESD between five class I molecules at three APBS grid densities (same models)."""
import sys, time, os, json
sys.path.insert(0, '/app/tools/ems3d')
import numpy as np
import build_ems3d as B
tpl = B.prepare_template('I')
mols = ['A*02:01', 'A*01:01', 'B*07:02', 'B*08:01', 'C*07:01']
os.makedirs('/tmp/m', exist_ok=True)
for m in mols:
    t = time.time(); B.build_model(m, tpl, '/tmp/m/%s.pdb' % B.safe(m)); print('model', m, round(time.time() - t, 1), flush=True)
res = {}
for dime in [int(a) for a in sys.argv[1:]]:
    files = []
    for m in mols:
        t = time.time()
        out = '/tmp/m/%s_%d.npz' % (B.safe(m), dime)
        n = B.potentials(m, tpl, '/tmp/m/%s.pdb' % B.safe(m), out, dime)
        files.append(out)
        print('dime', dime, m, n, round(time.time() - t, 1), flush=True)
    esd, overlap, p = B.compare_group(files)
    res[dime] = esd
    print(dime, '\n', np.round(esd, 4), flush=True)
ds = sorted(res)
for d in ds[:-1]:
    diff = np.abs(res[d] - res[ds[-1]])
    print('max |ESD(%d) - ESD(%d)| = %.4f' % (d, ds[-1], diff.max()))
