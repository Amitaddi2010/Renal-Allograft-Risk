/*
 * hla_molecular.js — molecular mismatch measures beyond eplets.
 *
 *   HLAMolecular.analyze(perLocus)      perLocus = HLAEngine result .allele.perLocus
 *
 * Three measures, all computed in the browser from IMGT/HLA residues
 * (hla_molecular_data.js) and published constants:
 *
 *   1. Amino-acid mismatch, in the style of HLA-EMMA (Kramer, HLA 2020):
 *      donor residues at polymorphic positions that the recipient carries on
 *      neither allele. Reported for all positions and, separately, restricted to
 *      solvent-accessible ones, which is the antibody-relevant subset.
 *   2. Physicochemical mismatch, in the style of the Kosmoliaptsis electrostatic
 *      and hydrophobic scores: summed charge and hydropathy differences at those
 *      mismatched positions, each donor residue compared with the chemically
 *      nearest recipient residue at the same position.
 *   3. HLA evolutionary divergence (HED, Pierini & Lenz 2018): mean Grantham
 *      distance between an individual's own two alleles across the
 *      peptide-binding domain. This describes one person's genotype, NOT the
 *      donor-recipient relationship, and is reported separately for that reason.
 *
 * These are our own implementations of published methods. They are not the
 * output of HLA-EMMA, PIRCHE-II or the Kosmoliaptsis tools, and the numbers are
 * not interchangeable with them. PIRCHE-II is deliberately absent: it needs a
 * licensed peptide-MHC binding predictor, so it cannot be reproduced honestly here.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.HLAMolecular = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    let REF = null;

    function setReference(data) { REF = data; return REF; }
    function reference() {
        if (REF) return REF;
        if (typeof window !== 'undefined' && window.HLA_MOLECULAR) REF = window.HLA_MOLECULAR;
        return REF;
    }

    /* ---------------- amino-acid property helpers ---------------- */
    function grantham(a, b) {
        const R = reference();
        if (!R || a === b) return a === b ? 0 : null;
        const G = R.grantham, C = G.constants;
        if (!(a in G.composition) || !(b in G.composition)) return null;
        const dc = G.composition[a] - G.composition[b];
        const dp = G.polarity[a] - G.polarity[b];
        const dv = G.volume[a] - G.volume[b];
        return C.rho * Math.sqrt(C.alpha * dc * dc + C.beta * dp * dp + C.gamma * dv * dv);
    }
    function charge(a) { const R = reference(); return (R && R.charge[a]) || 0; }
    function hydro(a) { const R = reference(); return (R && R.hydropathy[a] !== undefined) ? R.hydropathy[a] : 0; }
    function known(a) { return a && a !== '.' && a !== '*' && a !== 'X'; }

    function residuesOf(locus, allele) {
        const R = reference();
        const L = R && R.loci[locus];
        return (L && L.alleles[allele]) || null;
    }

    /* ---------------- 1 + 2: donor-vs-recipient at each position ---------------- */
    function locusMismatch(locus, recipient, donor) {
        const R = reference();
        const L = R && R.loci[locus];
        if (!L) return null;
        const cutoff = R.meta.exposed_cutoff;

        const recSeqs = recipient.map(function (a) { return residuesOf(locus, a); }).filter(Boolean);
        const donSeqs = donor.map(function (a) { return residuesOf(locus, a); }).filter(Boolean);
        if (!recSeqs.length || !donSeqs.length) return null;

        const detail = [];
        let aa = 0, aaExposed = 0, electro = 0, hydroSum = 0;

        for (let i = 0; i < L.positions.length; i++) {
            const pos = L.positions[i];
            const recSet = {};
            recSeqs.forEach(function (s) { if (known(s[i])) recSet[s[i]] = true; });
            if (!Object.keys(recSet).length) continue;

            const seen = {};
            donSeqs.forEach(function (s) {
                const d = s[i];
                if (!known(d) || recSet[d] || seen[d]) return;
                seen[d] = true;

                // compare with the chemically nearest recipient residue at this position
                let nearest = null, best = Infinity;
                Object.keys(recSet).forEach(function (r) {
                    const g = grantham(d, r);
                    if (g !== null && g < best) { best = g; nearest = r; }
                });
                const exposure = L.exposure[pos];
                const isExposed = exposure !== undefined && exposure >= cutoff;
                const dq = nearest ? Math.abs(charge(d) - charge(nearest)) : 0;
                const dh = nearest ? Math.abs(hydro(d) - hydro(nearest)) : 0;

                aa += 1;
                if (isExposed) { aaExposed += 1; electro += dq; hydroSum += dh; }
                detail.push({
                    position: pos, donor: d, recipient: Object.keys(recSet).sort(),
                    nearest: nearest, grantham: best === Infinity ? null : Math.round(best),
                    exposure: exposure === undefined ? null : exposure,
                    exposed: isExposed, dCharge: dq, dHydropathy: dh
                });
            });
        }
        detail.sort(function (a, b) { return a.position - b.position; });
        return {
            locus: locus, aa: aa, aaExposed: aaExposed,
            electrostatic: Math.round(electro * 100) / 100,
            hydrophobic: Math.round(hydroSum * 100) / 100,
            positionsTested: L.positions.length, detail: detail
        };
    }

    /* ---------------- 3: evolutionary divergence within one genotype ---------------- */
    function locusDivergence(locus, alleles) {
        const R = reference();
        const L = R && R.loci[locus];
        if (!L || alleles.length < 2) return null;
        const a = residuesOf(locus, alleles[0]);
        const b = residuesOf(locus, alleles[1]);
        if (!a || !b) return null;
        if (alleles[0] === alleles[1]) return { locus: locus, hed: 0, compared: 0, homozygous: true };

        const lo = L.pbd[0], hi = L.pbd[1];
        let sum = 0, n = 0;
        for (let i = 0; i < L.positions.length; i++) {
            const pos = L.positions[i];
            if (pos < lo || pos > hi) continue;
            if (!known(a[i]) || !known(b[i])) continue;
            const g = grantham(a[i], b[i]);
            if (g === null) continue;
            sum += g; n += 1;
        }
        // divergence is expressed per peptide-binding-domain residue, so loci of
        // different domain length stay comparable
        const span = hi - lo + 1;
        return n ? { locus: locus, hed: Math.round(sum / span * 1000) / 1000, compared: n,
                     homozygous: false } : null;
    }

    /* ---------------- public entry point ---------------- */
    function analyze(perLocus) {
        const R = reference();
        const out = {
            available: !!R, evaluated: [], perLocus: {},
            totals: { aa: 0, aaExposed: 0, electrostatic: 0, hydrophobic: 0 },
            hed: { recipient: {}, donor: {}, recipientMean: null, donorMean: null },
            skipped: [], warnings: []
        };
        if (!R) { out.warnings.push({ level: 'warn', message: 'Molecular reference not loaded.' }); return out; }
        if (!perLocus) return out;

        Object.keys(perLocus).forEach(function (locus) {
            const L = perLocus[locus];
            if (!R.loci[locus]) return;
            const rec = (L.recipient || []).slice();
            const don = (L.donor || []).slice();
            const missing = rec.concat(don).filter(function (a) { return !residuesOf(locus, a); });
            if (missing.length) {
                missing.forEach(function (a) { if (out.skipped.indexOf(a) === -1) out.skipped.push(a); });
            }
            const mm = locusMismatch(locus, rec, don);
            if (mm) {
                out.perLocus[locus] = mm;
                out.evaluated.push(locus);
                out.totals.aa += mm.aa;
                out.totals.aaExposed += mm.aaExposed;
                out.totals.electrostatic += mm.electrostatic;
                out.totals.hydrophobic += mm.hydrophobic;
            }
            const hr = locusDivergence(locus, rec);
            if (hr) out.hed.recipient[locus] = hr;
            const hd = locusDivergence(locus, don);
            if (hd) out.hed.donor[locus] = hd;
        });

        out.totals.electrostatic = Math.round(out.totals.electrostatic * 100) / 100;
        out.totals.hydrophobic = Math.round(out.totals.hydrophobic * 100) / 100;

        function mean(map) {
            const v = Object.keys(map).map(function (k) { return map[k].hed; });
            return v.length ? Math.round(v.reduce(function (a, b) { return a + b; }, 0) / v.length * 1000) / 1000 : null;
        }
        out.hed.recipientMean = mean(out.hed.recipient);
        out.hed.donorMean = mean(out.hed.donor);

        if (out.skipped.length) {
            out.warnings.push({
                level: 'warn',
                message: out.skipped.length + ' allele(s) have no IMGT residue record and were skipped: '
                    + out.skipped.slice(0, 6).join(', ') + (out.skipped.length > 6 ? ', ...' : '')
            });
        }
        return out;
    }

    return {
        setReference: setReference, analyze: analyze,
        grantham: grantham, locusMismatch: locusMismatch, locusDivergence: locusDivergence,
        VERSION: '1.0'
    };
}));
