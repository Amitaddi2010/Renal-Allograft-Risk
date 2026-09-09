"""
build_molecular_reference.py — generate ../hla_molecular_data.js

    python tools/build_molecular_reference.py

Inputs
    tools/imgt_alignments.json     (tools/fetch_imgt_alignments.py)
    tools/hla_reference_data.json  (allele list the eplet engine supports)
    structures/rcsb/*.pdb          (representative structure per locus)

Output: the reference behind three molecular-mismatch measures that the eplet
engine cannot produce on its own, because HLAMatchmaker tables carry eplets, not
residues:

  1. Amino-acid mismatch, in the style of HLA-EMMA (Kramer et al., HLA 2020):
     donor residues at polymorphic positions that the recipient does not have at
     that position on either allele, restricted to solvent-accessible positions.
  2. Physicochemical mismatch, in the style of the Kosmoliaptsis electrostatic
     and hydrophobic scores: charge and hydropathy differences at those positions.
  3. HLA evolutionary divergence (HED), Grantham distance between an individual's
     own two alleles across the peptide-binding domain (Pierini & Lenz 2018).

None of these reuse code or data from those tools. They are built from IMGT/HLA
alignments and published constants, and are named as our own measures - the
numbers are not interchangeable with the originals.

Solvent accessibility is computed with Shrake-Rupley on the representative
complex (so chain interfaces read as buried) and normalised by the Tien et al.
2013 theoretical maxima. A position counts as exposed at >= 25% relative ASA,
the usual convention.
"""
import json
import math
import os
import sys

TOOLS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(TOOLS)
OUT = os.path.join(ROOT, 'hla_molecular_data.js')

# Representative structure per locus: (pdb id, chain carrying that locus product).
# Only chains A and B are kept when computing accessibility - for class I that is
# the heavy chain plus beta-2 microglobulin, for class II the alpha/beta pair.
# Peptide, CD8 (1AKJ carries it), TCR and duplicate copies in the asymmetric unit
# are dropped, because they bury surface that an alloantibody would still reach.
STRUCT = {
    'A': ('1AKJ', 'A'), 'B': ('1A1N', 'A'), 'C': ('1QQD', 'A'),
    'DRB1': ('1DLH', 'B'), 'DRB3': ('1DLH', 'B'), 'DRB4': ('1DLH', 'B'), 'DRB5': ('1DLH', 'B'),
    'DQA1': ('1JK8', 'A'), 'DQB1': ('1JK8', 'B'),
    'DPA1': ('3LQZ', 'A'), 'DPB1': ('3LQZ', 'B'),
}
KEEP_CHAINS = ('A', 'B')

# peptide-binding domain, used for HED (class I alpha1+alpha2, class II beta1/alpha1)
PBD = {'A': (1, 182), 'B': (1, 182), 'C': (1, 182)}
PBD_DEFAULT = (1, 95)

# Grantham 1974: composition, polarity, molecular volume
GRANTHAM = {
    'S': (1.42, 9.2, 32), 'R': (0.65, 10.5, 124), 'L': (0.0, 4.9, 111), 'P': (0.39, 8.0, 32.5),
    'T': (0.71, 8.6, 61), 'A': (0.0, 8.1, 31), 'V': (0.0, 5.9, 84), 'G': (0.74, 9.0, 3),
    'I': (0.0, 5.2, 111), 'F': (0.0, 5.2, 132), 'Y': (0.20, 6.2, 136), 'C': (2.75, 5.5, 55),
    'H': (0.58, 10.4, 96), 'Q': (0.89, 10.5, 85), 'N': (1.33, 11.6, 56), 'K': (0.33, 11.3, 119),
    'D': (1.38, 13.0, 54), 'E': (0.92, 12.3, 83), 'M': (0.0, 5.7, 105), 'W': (0.13, 5.4, 170),
}
G_ALPHA, G_BETA, G_GAMMA, G_RHO = 1.833, 0.1018, 0.000399, 50.723

# Kyte & Doolittle 1982 hydropathy; formal charge at pH 7.4
KD = {'A': 1.8, 'R': -4.5, 'N': -3.5, 'D': -3.5, 'C': 2.5, 'Q': -3.5, 'E': -3.5, 'G': -0.4,
      'H': -3.2, 'I': 4.5, 'L': 3.8, 'K': -3.9, 'M': 1.9, 'F': 2.8, 'P': -1.6, 'S': -0.8,
      'T': -0.7, 'W': -0.9, 'Y': -1.3, 'V': 4.2}
CHARGE = {'D': -1.0, 'E': -1.0, 'K': 1.0, 'R': 1.0, 'H': 0.1}

# Tien et al. 2013 (PLoS ONE 8:e80635) theoretical maximum ASA, A^2
MAXASA = {'A': 129, 'R': 274, 'N': 195, 'D': 193, 'C': 167, 'Q': 225, 'E': 223, 'G': 104,
          'H': 224, 'I': 197, 'L': 201, 'K': 236, 'M': 224, 'F': 240, 'P': 159, 'S': 155,
          'T': 172, 'W': 285, 'Y': 263, 'V': 174}
THREE_TO_ONE = {
    'ALA': 'A', 'ARG': 'R', 'ASN': 'N', 'ASP': 'D', 'CYS': 'C', 'GLN': 'Q', 'GLU': 'E',
    'GLY': 'G', 'HIS': 'H', 'ILE': 'I', 'LEU': 'L', 'LYS': 'K', 'MET': 'M', 'PHE': 'F',
    'PRO': 'P', 'SER': 'S', 'THR': 'T', 'TRP': 'W', 'TYR': 'Y', 'VAL': 'V',
}
EXPOSED_CUTOFF = 0.25


def grantham(a, b):
    if a not in GRANTHAM or b not in GRANTHAM:
        return None
    ca, pa, va = GRANTHAM[a]
    cb, pb, vb = GRANTHAM[b]
    return G_RHO * math.sqrt(G_ALPHA * (ca - cb) ** 2 + G_BETA * (pa - pb) ** 2
                             + G_GAMMA * (va - vb) ** 2)


def relative_asa(pdb_id, chain_id):
    """Per-residue relative solvent accessibility for one chain of a complex."""
    from Bio.PDB import PDBParser
    from Bio.PDB.SASA import ShrakeRupley
    path = os.path.join(ROOT, 'structures', 'rcsb', '%s.pdb' % pdb_id)
    if not os.path.exists(path):
        return {}, 'structure missing'
    parser = PDBParser(QUIET=True)
    model = parser.get_structure(pdb_id, path)[0]
    # keep only the HLA molecule itself, then drop waters and heteroatoms
    for ch in list(model):
        if ch.id not in KEEP_CHAINS:
            model.detach_child(ch.id)
            continue
        for res in list(ch):
            if res.id[0] != ' ':
                ch.detach_child(res.id)
    ShrakeRupley().compute(model, level='R')          # HLA molecule only (see KEEP_CHAINS)
    if chain_id not in model:
        return {}, 'chain %s absent' % chain_id
    out = {}
    for res in model[chain_id]:
        aa = THREE_TO_ONE.get(res.get_resname())
        if not aa:
            continue
        num = res.id[1]
        rel = res.sasa / MAXASA[aa]
        out[num] = (round(rel, 3), aa)
    return out, None


def main():
    align = json.load(open(os.path.join(TOOLS, 'imgt_alignments.json')))
    ref = json.load(open(os.path.join(TOOLS, 'hla_reference_data.json'), encoding='utf-8'))
    engine = set()
    for key in ('classI', 'classIIB', 'classIIA'):
        engine |= set(ref[key]['alleles'].keys())

    loci_out, meta = {}, {}
    for locus, seqs in sorted(align['loci'].items()):
        info = align['meta'][locus]
        offset = info['codon1_offset']
        keep = sorted(a for a in seqs if a in engine)
        if not keep:
            continue
        ref_name = info['reference']
        ref_seq = seqs.get(ref_name) or seqs[keep[0]]

        # column -> mature residue number, from the reference
        col_num, n = {}, 0
        for i in range(offset, len(ref_seq)):
            if ref_seq[i] != '.':
                n += 1
            col_num[i] = n

        width = max(len(seqs[a]) for a in keep)
        cols = [i for i in range(offset, width) if i in col_num]
        # keep only columns that vary among the alleles we support
        poly = []
        for i in cols:
            residues = {seqs[a][i] for a in keep if i < len(seqs[a])}
            residues.discard('.')
            residues.discard('*')
            if len(residues) > 1:
                poly.append(i)

        # solvent accessibility for this locus
        pdb_id, chain = STRUCT.get(locus, (None, None))
        asa, err = relative_asa(pdb_id, chain) if pdb_id else ({}, 'no structure')
        exposure = {}
        for i in poly:
            num = col_num[i]
            hit = asa.get(num)
            if hit:
                exposure[num] = hit[0]

        packed = {a: ''.join(seqs[a][i] if i < len(seqs[a]) else '*' for i in poly) for a in keep}
        loci_out[locus] = {
            'positions': [col_num[i] for i in poly],
            'alleles': packed,
            'exposure': exposure,
            'pbd': list(PBD.get(locus, PBD_DEFAULT)),
        }
        n_exposed = sum(1 for v in exposure.values() if v >= EXPOSED_CUTOFF)
        meta[locus] = {'alleles': len(keep), 'polymorphic_positions': len(poly),
                       'with_structure': len(exposure), 'exposed': n_exposed,
                       'structure': '%s:%s' % (pdb_id, chain) if pdb_id else None,
                       'structure_note': err}
        print('  %-6s %5d alleles | %3d polymorphic | %3d mapped to %s | %3d exposed (>=25%%)%s'
              % (locus, len(keep), len(poly), len(exposure),
                 meta[locus]['structure'], n_exposed, '  [%s]' % err if err else ''))

    payload = {
        'meta': {
            'built': __import__('datetime').date.today().isoformat(),
            'imgt': 'IPD-IMGT/HLA protein alignments (ANHIG/IMGTHLA, Latest)',
            'exposed_cutoff': EXPOSED_CUTOFF,
            'loci': meta,
            'notes': 'Measures are our own implementations from published methods and '
                     'constants; they are not the output of HLA-EMMA, PIRCHE-II or the '
                     'Kosmoliaptsis tools and are not numerically interchangeable with them.',
        },
        'grantham': {'composition': {k: v[0] for k, v in GRANTHAM.items()},
                     'polarity': {k: v[1] for k, v in GRANTHAM.items()},
                     'volume': {k: v[2] for k, v in GRANTHAM.items()},
                     'constants': {'alpha': G_ALPHA, 'beta': G_BETA,
                                   'gamma': G_GAMMA, 'rho': G_RHO}},
        'hydropathy': KD,
        'charge': CHARGE,
        'loci': loci_out,
    }
    with open(OUT, 'w', encoding='utf-8') as fh:
        fh.write('/* GENERATED by tools/build_molecular_reference.py - '
                 'IMGT/HLA residues, solvent accessibility and amino-acid property '
                 'constants for the molecular mismatch measures. Do not edit by hand. */\n')
        fh.write('window.HLA_MOLECULAR = ')
        json.dump(payload, fh, separators=(',', ':'))
        fh.write(';\n')
    print('wrote %s (%.2f MB)' % (OUT, os.path.getsize(OUT) / 1e6))


if __name__ == '__main__':
    sys.exit(main())
