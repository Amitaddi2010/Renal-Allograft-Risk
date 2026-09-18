/*
 * hla_scores.js — HLA evolutionary divergence (HED), AAMS and EMS3D, computed in this app.
 *
 *   HLAScores.hedPair('A*02:01', 'A*31:01')            HLAdiv.net "Pair" mode
 *   HLAScores.hedGenotype({A: [..], B: [..], C: [..]})  HLAdiv.net "Loci & Mean" mode (+ DRB1/DQB1)
 *   HLAScores.hedBatch(tsvText)                         HLAdiv.net "Batch" mode (same TSV)
 *   HLAScores.score(recipientTyping, donorTyping)       AAMS and EMS3D per mismatched donor molecule
 *
 * Data: hla_scores_data.js (IPD-IMGT/HLA residues, tools/build_hla_scores_reference.py) and the
 * EMS3D distance tables hla_ems3d_*.js (tools/ems3d/build_ems3d.py), loaded on demand.
 *
 * HED — Pierini & Lenz, Mol Biol Evol 2018; Chowell et al., Nat Med 2019 (HLAdiv.net).
 *   Mean Grantham distance (integer 1974 table) between two alleles over mature residues 2-182
 *   (class I exons 2+3), or beta residues 6-94 for DRB1/DQB1 (the Lenz class II alignment).
 *   The loop is CalculatePairwiseDistances.pl line for line: a position is dropped from sum and
 *   length when either residue is not one of the 20 amino acids, and - as in the script - the
 *   loop bound shrinks with each dropped position. The HLAdiv "Mean_HED" is the plain mean of
 *   HED_A, HED_B and HED_C.
 * AAMS — Kosmoliaptsis et al., Transplantation 2009 and 2011; Am J Transplant 2016.
 *   Number of extracellular positions at which the donor residue is absent from every recipient
 *   molecule of the comparison set: HLA-A/B/C pooled for class I, DRB1/3/4/5 pooled for DR
 *   (interlocus); DQ and DP compared chain by chain within the locus (intralocus), the
 *   heterodimer score being alpha + beta. The extracellular range is the UniProt annotation
 *   (class I 1-284); the lab has not published its own range.
 * EMS3D — Mallon et al., J Immunol 2018.
 *   Electrostatic distance ESD = sqrt(2 - 2 x Hodgkin index) between donor and recipient
 *   molecules; EMS3D is the minimum ESD over the recipient's class I molecules (class I) or
 *   the recipient's molecules of the same locus (class II). Distances are precomputed offline
 *   (APBS on structural models), so, like the original web tool, rarer molecules may be
 *   unscored.
 *
 * These are our implementations of the published methods, not output of HLAdiv.net or the
 * Kosmoliaptsis Shiny app; see validation/HLA_SCORES_VALIDATION.md for what was checked.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.HLAScores = factory();
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const CLASS_I = ['A', 'B', 'C'];
    const DR_LOCI = ['DRB1', 'DRB3', 'DRB4', 'DRB5'];
    const LOCI = ['A', 'B', 'C', 'DRB1', 'DRB3', 'DRB4', 'DRB5', 'DQA1', 'DQB1', 'DPA1', 'DPB1'];
    const AA = 'ARNDCQEGHILKMFPSTWYV';
    const CLASS_I_END = 284;             // UniProt extracellular end of HLA-A and -C; B is annotated 285
    const EMS_FILES = { I: 'hla_ems3d_I.js', DR: 'hla_ems3d_DR.js', DQ: 'hla_ems3d_DQ.js', DP: 'hla_ems3d_DP.js' };
    const EMS_FAMILY = { I: 'I', DRB1: 'DR', DRB3: 'DR', DRB4: 'DR', DRB5: 'DR', DQ: 'DQ', DP: 'DP' };

    let SEQ = null;
    let EMS = null;
    let G = null;
    const decoded = {};
    const nameIndex = {};
    const emsIndex = {};
    const emsFailed = {};          // family -> true when its table file could not be loaded

    /* ---------------- data ---------------- */
    function setData(seqData, emsData) {
        SEQ = seqData || null;
        if (emsData !== undefined) { EMS = emsData; clearEmsIndex(); }
        G = null;
        Object.keys(decoded).forEach(function (k) { delete decoded[k]; });
        Object.keys(nameIndex).forEach(function (k) { delete nameIndex[k]; });
        return SEQ;
    }
    function clearEmsIndex() { Object.keys(emsIndex).forEach(function (k) { delete emsIndex[k]; }); }
    function seqData() {
        if (!SEQ && typeof window !== 'undefined' && window.HLA_SCORES_DATA) SEQ = window.HLA_SCORES_DATA;
        return SEQ;
    }
    function emsData() {
        if (typeof window !== 'undefined' && window.HLA_EMS3D_DATA && EMS !== window.HLA_EMS3D_DATA) {
            EMS = window.HLA_EMS3D_DATA;
            clearEmsIndex();
        }
        return EMS;
    }
    function available() { return !!seqData(); }

    function grantham() {
        if (G) return G;
        const R = seqData().grantham;
        G = {};
        for (let i = 0; i < R.order.length; i++) {
            for (let j = 0; j < R.order.length; j++) G[R.order[i] + R.order[j]] = R.rows[i][j];
        }
        return G;
    }

    /* ---------------- allele names ---------------- */
    const LOCUS_RE = /^(?:HLA-)?(DRB[1345]|DQA1|DQB1|DPA1|DPB1|DQA|DQB|DPA|DPB|CW|A|B|C)\*?(.*)$/;
    const LOCUS_ALIAS = { CW: 'C', DQA: 'DQA1', DQB: 'DQB1', DPA: 'DPA1', DPB: 'DPB1' };

    /** 'A*02:01:01:01', 'A*0201', 'A0201' (HLAdiv), 'DRB10101' (Lenz) -> 'A*02:01'; null if not two-field. */
    function normalize(raw) {
        const s = String(raw == null ? '' : raw).trim().toUpperCase().replace(/\s+/g, '');
        if (!s) return null;
        const m = s.match(LOCUS_RE);
        if (!m) return null;
        const locus = LOCUS_ALIAS[m[1]] || m[1];
        const rest = m[2];
        let f1, f2, suffix = '';
        if (rest.indexOf(':') !== -1) {
            const p = rest.split(':');
            f1 = p[0];
            const mm = p[1].match(/^(\d+)([A-Z]?)$/);
            if (!mm) return null;
            f2 = mm[1];
            // an expression suffix (A*01:04:01:01N) belongs to the whole name
            const tail = p[p.length - 1].match(/[A-Z]$/);
            suffix = tail ? tail[0] : '';
        } else {
            const mm = rest.match(/^(\d{4,5})([A-Z]?)$/);
            if (!mm) return null;
            f1 = mm[1].slice(0, 2);
            f2 = mm[1].slice(2);
            suffix = mm[2] || '';
        }
        if (!/^\d+$/.test(f1) || !/^\d+$/.test(f2)) return null;
        if (f1.length < 2) f1 = '0' + f1;
        if (f2.length < 2) f2 = '0' + f2;
        return locus + '*' + f1 + ':' + f2 + suffix;
    }
    function locusOf(name) { return name ? name.split('*')[0] : null; }

    /* ---------------- sequences ---------------- */
    function indexOf(locus, name) {
        const L = seqData() && seqData().loci[locus];
        if (!L) return -1;
        if (!nameIndex[locus]) {
            const idx = {};
            L.names.forEach(function (n, i) { idx[n] = i; });
            nameIndex[locus] = idx;
        }
        const i = nameIndex[locus][name];
        return i === undefined ? -1 : i;
    }

    function decodeOne(L, i, base) {
        const out = base.split('');
        const imp = L.imputed[i];
        if (imp) {
            imp.split(',').forEach(function (r) {
                const ab = r.split('-');
                const a = +ab[0], b = ab.length > 1 ? +ab[1] : a;
                for (let p = a; p <= b; p++) out[p - 1] = out[p - 1].toLowerCase();
            });
        }
        const re = /(\d+)([A-Z.*])/g;
        let m;
        while ((m = re.exec(L.diff[i])) !== null) out[+m[1] - 1] = m[2];
        return out.join('');
    }

    /** Extracellular residues of a two-field allele (lower case = filled from the closest complete allele). */
    function sequence(allele) {
        const name = normalize(allele);
        if (!name || !seqData()) return null;
        const locus = locusOf(name);
        const L = seqData().loci[locus];
        const i = indexOf(locus, name);
        if (i === -1) return null;
        const key = locus + '#' + i;
        if (decoded[key] === undefined) {
            // walk up to a decoded ancestor (or the reference), then decode back down
            const chain = [];
            let k = i;
            while (k !== -1 && decoded[locus + '#' + k] === undefined) { chain.push(k); k = L.parent[k]; }
            let base = k === -1 ? L.ref : decoded[locus + '#' + k];
            for (let c = chain.length - 1; c >= 0; c--) {
                const s = decodeOne(L, chain[c], base.toUpperCase());
                decoded[locus + '#' + chain[c]] = s;
                base = s;
            }
        }
        const s = decoded[key];
        let imputed = 0;
        for (let p = 0; p < s.length; p++) if (s[p] >= 'a' && s[p] <= 'z') imputed++;
        return { allele: name, locus: locus, seq: s, imputed: imputed };
    }

    function extracellularEnd(locus) {
        if (CLASS_I.indexOf(locus) !== -1) return CLASS_I_END;
        const m = seqData().meta.loci[locus];
        return m ? m.extracellular_end : 0;
    }

    /* ---------------- HED ---------------- */
    function hedRange(locus) {
        const r = seqData() && seqData().hedRanges[locus];
        return r || null;
    }

    function hedPair(a, b) {
        const out = { a: normalize(a) || String(a || ''), b: normalize(b) || String(b || ''), hed: null };
        if (!seqData()) { out.error = 'Sequence reference not loaded.'; return out; }
        const A = normalize(a), B = normalize(b);
        if (!A || !B) { out.error = 'Give two-field allele names (e.g. A*02:01 or A0201).'; return out; }
        const la = locusOf(A), lb = locusOf(B);
        const ra = hedRange(la), rb = hedRange(lb);
        if (!ra || !rb) {
            out.error = 'HED is defined for HLA-A, -B, -C (HLAdiv.net) and DRB1/DQB1 (Pierini & Lenz); not for ' +
                (ra ? lb : la) + '.';
            return out;
        }
        const bothI = CLASS_I.indexOf(la) !== -1 && CLASS_I.indexOf(lb) !== -1;
        if (la !== lb && !bothI) { out.error = 'Class II HED compares alleles of the same locus only.'; return out; }
        const sa = sequence(A), sb = sequence(B);
        if (!sa || !sb) { out.error = (sa ? B : A) + ' is not a two-field allele in IPD-IMGT/HLA ' + seqData().meta.imgt + '.'; return out; }

        const from = ra[0], to = ra[1];
        const s1 = sa.seq.slice(from - 1, to), s2 = sb.seq.slice(from - 1, to);
        const g = grantham();
        let length = s1.length, sum = 0, excluded = 0;
        if (A !== B) {
            // CalculatePairwiseDistances.pl: the bound and the divisor are the same variable
            for (let k = 0; k < length; k++) {
                const x = s1[k], y = s2[k];
                if (AA.indexOf(x) === -1 || AA.indexOf(y) === -1 || x === undefined || y === undefined) {
                    length -= 1;
                    excluded += 1;
                } else {
                    sum += g[x + y];
                }
            }
        }
        if (length <= 0) { out.error = 'No comparable positions.'; return out; }
        out.a = A; out.b = B;
        out.hed = sum / length;
        out.sum = sum;
        out.length = length;
        out.excluded = excluded;
        out.region = [from, to];
        out.classI = bothI;
        if (excluded) {
            out.note = excluded + ' position(s) without a determined residue in one allele were left out' +
                ' (as the Pierini & Lenz script does); HLAdiv.net lists only alleles with complete exons 2-3.';
        }
        return out;
    }

    function uniq(list) {
        const seen = {}, out = [];
        (list || []).forEach(function (x) { if (x && !seen[x]) { seen[x] = true; out.push(x); } });
        return out;
    }

    function normalizeTyping(typing) {
        const out = {}, bad = [];
        LOCI.forEach(function (l) { out[l] = []; });
        Object.keys(typing || {}).forEach(function (k) {
            (typing[k] || []).forEach(function (raw) {
                if (raw === null || raw === undefined || String(raw).trim() === '') return;
                const n = normalize(raw);
                if (!n) { bad.push(String(raw)); return; }
                const l = locusOf(n);
                if (out[l]) out[l].push(n); else bad.push(String(raw));
            });
        });
        return { typing: out, unparsed: bad };
    }

    /** Per-locus HED of one person; class I mean as HLAdiv.net. */
    function hedGenotype(typing) {
        const T = normalizeTyping(typing).typing;
        const res = { perLocus: {}, meanClassI: null, notes: [] };
        ['A', 'B', 'C', 'DRB1', 'DQB1'].forEach(function (l) {
            const al = T[l];
            if (!al.length) return;
            if (al.length > 2) { res.perLocus[l] = { locus: l, hed: null, error: 'More than two alleles typed.' }; return; }
            const pair = al.length === 1 ? [al[0], al[0]] : al;
            const r = hedPair(pair[0], pair[1]);
            r.locus = l;
            r.homozygous = pair[0] === pair[1];
            if (al.length === 1) r.assumedHomozygous = true;
            res.perLocus[l] = r;
        });
        const I = CLASS_I.map(function (l) { return res.perLocus[l]; });
        const ok = I.filter(function (r) { return r && r.hed !== null; });
        if (ok.length) {
            res.meanClassI = ok.reduce(function (s, r) { return s + r.hed; }, 0) / ok.length;
            if (ok.length < 3) res.notes.push('Class I mean over ' + ok.length + ' locus/loci; HLAdiv.net needs all of A, B and C.');
        }
        if (I.some(function (r) { return r && r.assumedHomozygous; })) {
            res.notes.push('A locus with one typed allele is treated as homozygous (HED 0).');
        }
        return res;
    }

    function fixed(x, d) { return x === null || x === undefined ? '' : x.toFixed(d); }

    /** HLAdiv.net batch TSV: "Sample<TAB>HLAI" with six comma-separated class I alleles (A,A,B,B,C,C). */
    function hedBatch(text) {
        const rows = [];
        String(text || '').split(/\r?\n/).forEach(function (line, n) {
            if (!line.trim()) return;
            let cells = line.split('\t');
            if (cells.length === 1) cells = line.split(/,(.+)/).filter(Boolean);
            const sample = cells[0].trim();
            if (n === 0 && /^sample$/i.test(sample)) return;
            const alleles = cells.slice(1).join(',').split(/[,;\s]+/).filter(Boolean);
            const row = { sample: sample, alleles: alleles, HED_A: null, HED_B: null, HED_C: null, Mean_HED: null, error: '' };
            if (alleles.length !== 6) {
                row.error = 'expected 6 alleles (A,A,B,B,C,C), found ' + alleles.length;
                rows.push(row);
                return;
            }
            const errs = [];
            ['A', 'B', 'C'].forEach(function (l, k) {
                const r = hedPair(alleles[2 * k], alleles[2 * k + 1]);
                const la = locusOf(normalize(alleles[2 * k])), lb = locusOf(normalize(alleles[2 * k + 1]));
                if (la !== l || lb !== l) errs.push('HED_' + l + ': alleles ' + (2 * k + 1) + '-' + (2 * k + 2) + ' must be HLA-' + l);
                else if (r.hed === null) errs.push('HED_' + l + ': ' + r.error);
                else row['HED_' + l] = r.hed;
            });
            if (row.HED_A !== null && row.HED_B !== null && row.HED_C !== null) {
                row.Mean_HED = (row.HED_A + row.HED_B + row.HED_C) / 3;
            }
            row.error = errs.join('; ');
            rows.push(row);
        });
        return rows;
    }

    function hedBatchTsv(rows) {
        const lines = ['Sample\tAlleles\tHED_A\tHED_B\tHED_C\tMean_HED\tNote'];
        rows.forEach(function (r) {
            lines.push([r.sample, r.alleles.join(','), fixed(r.HED_A, 5), fixed(r.HED_B, 5), fixed(r.HED_C, 5),
                        fixed(r.Mean_HED, 5), r.error].join('\t'));
        });
        return lines.join('\n') + '\n';
    }

    /* ---------------- AAMS ---------------- */
    function aamsChain(donorAllele, recipientAlleles, end) {
        const d = sequence(donorAllele);
        const recs = recipientAlleles.map(sequence).filter(Boolean);
        if (!d) return { value: null, reason: donorAllele + ' is not in IPD-IMGT/HLA' };
        if (!recs.length) return { value: null, reason: 'no recipient allele to compare with' };
        const positions = [];
        let imputedUsed = 0;
        for (let p = 1; p <= end; p++) {
            const dc = d.seq[p - 1];
            if (!dc) continue;
            const D = dc.toUpperCase();
            if (AA.indexOf(D) === -1) continue;                 // donor deletion at this position
            let present = false, imputedHere = dc !== D;
            const seen = [];
            for (let r = 0; r < recs.length; r++) {
                const rc = recs[r].seq[p - 1];
                if (!rc) continue;
                const R = rc.toUpperCase();
                if (seen.indexOf(R) === -1) seen.push(R);
                if (R === D) { present = true; if (rc !== R) imputedHere = true; break; }
                if (rc !== R) imputedHere = true;
            }
            if (!present) {
                positions.push({ position: p, donor: D, recipient: seen.sort(), imputed: imputedHere });
                if (imputedHere) imputedUsed++;
            }
        }
        return { value: positions.length, positions: positions, imputedUsed: imputedUsed,
                 imputedDonor: d.imputed, end: end };
    }

    /* ---------------- DQ / DP heterodimers ---------------- */
    function dqPermissive(a, b) {
        // DQA1*01 pairs with DQB1*05/*06; DQA1*02-*06 with DQB1*02/*03/*04 (Kwok et al. 1993)
        const a01 = /^DQA1\*01:/.test(a);
        const b56 = /^DQB1\*0[56]:/.test(b);
        return a01 === b56;
    }

    /** Pair alpha and beta chains into cis heterodimers; entry order unless the DQ rule decides. */
    function heterodimers(kind, alphas, betas, swap) {
        const A = uniq(alphas), B = uniq(betas);
        const out = { pairs: [], note: '' };
        if (!A.length || !B.length) return out;
        if (A.length === 1) { out.pairs = B.map(function (b) { return [A[0], b]; }); return out; }
        if (B.length === 1) { out.pairs = A.map(function (a) { return [a, B[0]]; }); return out; }
        const cis = [[A[0], B[0]], [A[1], B[1]]];
        const trans = [[A[0], B[1]], [A[1], B[0]]];
        let pick = swap ? trans : cis;
        if (kind === 'DQ') {
            const okCis = cis.every(function (p) { return dqPermissive(p[0], p[1]); });
            const okTrans = trans.every(function (p) { return dqPermissive(p[0], p[1]); });
            if (okCis !== okTrans) {
                pick = okCis ? cis : trans;
                out.note = 'DQ chains paired by the DQA1*01 / DQB1*05-06 rule.';
                out.ruled = true;
            } else {
                out.note = 'DQ phase not decided by the pairing rule; chains paired in the order typed.';
            }
        } else {
            out.note = 'DP chains paired in the order typed.';
        }
        out.pairs = pick;
        return out;
    }

    /* ---------------- EMS3D ---------------- */
    function b64ToU16(b64) {
        let bin;
        if (typeof atob === 'function') bin = atob(b64);
        else bin = Buffer.from(b64, 'base64').toString('binary');   // Node (tests)
        const n = bin.length >> 1;
        const out = new Uint16Array(n);
        for (let i = 0; i < n; i++) out[i] = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
        return out;
    }

    // hla_ems3d_meta.js carries the molecule names of every group (always loaded);
    // hla_ems3d_<family>.js adds the distances of that family when first needed.
    function emsGroup(group) {
        const E = emsData();
        const g = E && E.groups && E.groups[group];
        if (!g || !g.names) return null;
        let x = emsIndex[group];
        if (!x) {
            const idx = {};
            g.names.forEach(function (n, i) { idx[n] = i; });
            x = emsIndex[group] = { idx: idx, n: g.names.length, values: null, scale: (E.meta && E.meta.scale) || 1000 };
        }
        if (!x.values && g.esd) x.values = b64ToU16(g.esd);
        return x;
    }

    function esd(group, m1, m2) {
        const g = emsGroup(group);
        if (!g || !g.values) return null;
        let i = g.idx[m1], j = g.idx[m2];
        if (i === undefined || j === undefined) return null;
        if (i === j) return 0;
        if (i > j) { const t = i; i = j; j = t; }
        const k = i * g.n - (i * (i + 1)) / 2 + (j - i - 1);
        return g.values[k] / g.scale;
    }

    function emsLoaded(group) { const g = emsGroup(group); return !!(g && g.values); }
    function emsCovers(group, mol) { const g = emsGroup(group); return !!(g && g.idx[mol] !== undefined); }

    function ems3dMolecule(group, donorMol, recipientMols) {
        const g = emsGroup(group);
        if (!g) return { value: null, reason: 'no EMS3D library for this locus' };
        if (g.idx[donorMol] === undefined) return { value: null, reason: donorMol + ' has no EMS3D model (not scored)' };
        if (!g.values) {
            return emsFailed[EMS_FAMILY[group]] ? { value: null, reason: 'the EMS3D table could not be loaded' }
                                                : { value: null, pending: true, reason: 'EMS3D table loading' };
        }
        if (!recipientMols.length) return { value: null, reason: 'the recipient has no molecule at this locus to compare with' };
        let best = null, bestWith = null;
        const missing = [];
        recipientMols.forEach(function (r) {
            const v = esd(group, donorMol, r);
            if (v === null) { missing.push(r); return; }
            if (best === null || v < best) { best = v; bestWith = r; }
        });
        if (best === null) return { value: null, reason: 'no recipient molecule has an EMS3D model: ' + missing.join(', ') };
        return { value: best, closest: bestWith, partial: missing.length > 0, missing: missing };
    }

    /** Load the EMS3D tables a scoring call needs (browser only); callback when ready. */
    function ensureEms3d(groups, callback, base) {
        const need = uniq((groups || []).map(function (g) { return EMS_FAMILY[g]; })).filter(function (f) {
            return f && !emsFailed[f] && !(emsData() && emsData().families && emsData().families[f]);
        });
        if (typeof document === 'undefined' || !need.length) { if (callback) callback(); return; }
        let pending = need.length;
        need.forEach(function (f) {
            const id = 'hla-ems3d-' + f;
            const done = function () { if (--pending === 0 && callback) { clearEmsIndex(); callback(); } };
            const existing = document.getElementById(id);
            if (existing) {
                if (existing.getAttribute('data-state') === 'failed') emsFailed[f] = true;
                if (existing.getAttribute('data-state') === 'loaded' || existing.getAttribute('data-state') === 'failed') done();
                else { existing.addEventListener('load', done); existing.addEventListener('error', done); }
                return;
            }
            const s = document.createElement('script');
            s.id = id;
            s.src = (base || '') + EMS_FILES[f] + '?v=' + ((emsData() && emsData().meta && emsData().meta.built) || '1');
            s.async = true;
            s.addEventListener('load', function () { s.setAttribute('data-state', 'loaded'); done(); });
            s.addEventListener('error', function () { s.setAttribute('data-state', 'failed'); emsFailed[f] = true; done(); });
            document.head.appendChild(s);
        });
    }

    /* ---------------- donor vs recipient ---------------- */
    function missingFrom(list, pool) {
        return uniq(list).filter(function (a) { return pool.indexOf(a) === -1; });
    }

    /**
     * AAMS and EMS3D for every mismatched donor molecule.
     * recipient/donor: {A: [...], B: [...], ..., DPB1: [...]} in any accepted allele format.
     * opts.swapDQ / opts.swapDP: use the other cis/trans phase when both chains are heterozygous.
     */
    function score(recipient, donor, opts) {
        opts = opts || {};
        const R = normalizeTyping(recipient), D = normalizeTyping(donor);
        const r = R.typing, d = D.typing;
        const out = {
            molecules: [], warnings: [], groupsNeeded: [],
            unparsed: { recipient: R.unparsed, donor: D.unparsed },
            summary: {}, pairing: {}
        };
        if (!seqData()) { out.warnings.push('Sequence reference (hla_scores_data.js) not loaded.'); return out; }

        const unknown = [];
        LOCI.forEach(function (l) {
            r[l].concat(d[l]).forEach(function (a) { if (indexOf(l, a) === -1 && unknown.indexOf(a) === -1) unknown.push(a); });
        });
        if (unknown.length) out.warnings.push('Not two-field alleles in IPD-IMGT/HLA ' + seqData().meta.imgt + ': ' + unknown.join(', ') + '. They are left out.');
        LOCI.forEach(function (l) {
            r[l] = uniq(r[l].filter(function (a) { return indexOf(l, a) !== -1; }));
            d[l] = uniq(d[l].filter(function (a) { return indexOf(l, a) !== -1; }));
        });

        // class I: interlocus AAMS, interlocus EMS3D
        const recI = r.A.concat(r.B, r.C);
        CLASS_I.forEach(function (l) {
            missingFrom(d[l], r[l]).forEach(function (a) {
                const aams = recI.length ? aamsChain(a, recI, CLASS_I_END) : { value: null, reason: 'recipient class I not typed' };
                out.molecules.push({ klass: 'I', locus: l, group: 'I', molecule: a, chains: [a],
                                     aams: aams, ems3d: recI.length ? ems3dMolecule('I', a, recI)
                                                                     : { value: null, reason: 'recipient class I not typed' } });
            });
        });

        // DR: interlocus AAMS over DRB1/3/4/5, intralocus EMS3D
        const recDR = [].concat(r.DRB1, r.DRB3, r.DRB4, r.DRB5);
        DR_LOCI.forEach(function (l) {
            missingFrom(d[l], r[l]).forEach(function (a) {
                out.molecules.push({ klass: 'II', locus: l, group: l, molecule: a, chains: [a],
                                     aams: recDR.length ? aamsChain(a, recDR, extracellularEnd(l)) : { value: null, reason: 'recipient DR not typed' },
                                     ems3d: ems3dMolecule(l, a, r[l]) });
            });
        });

        // DQ / DP: heterodimers, intralocus per chain
        [['DQ', 'DQA1', 'DQB1', opts.swapDQ], ['DP', 'DPA1', 'DPB1', opts.swapDP]].forEach(function (spec) {
            const kind = spec[0], la = spec[1], lb = spec[2];
            if (!d[lb].length && !d[la].length) return;
            const hd = heterodimers(kind, d[la], d[lb], spec[3]);
            const hr = heterodimers(kind, r[la], r[lb], spec[3]);
            out.pairing[kind] = { donor: hd, recipient: hr };
            const recNames = hr.pairs.map(function (p) { return p[0] + '~' + p[1]; });
            if (!hd.pairs.length) {
                // alpha chain not typed on the donor: beta-chain AAMS only
                missingFrom(d[lb], r[lb]).forEach(function (b) {
                    const beta = r[lb].length ? aamsChain(b, r[lb], extracellularEnd(lb)) : { value: null, reason: 'recipient ' + lb + ' not typed' };
                    out.molecules.push({ klass: 'II', locus: kind, group: kind, molecule: b, chains: [null, b], betaOnly: true,
                                         aams: { value: beta.value, beta: beta, alpha: null, reason: beta.reason, note: la + ' not typed: beta chain only' },
                                         ems3d: { value: null, reason: la + ' not typed, so the heterodimer is unknown' } });
                });
                return;
            }
            hd.pairs.forEach(function (p) {
                const name = p[0] + '~' + p[1];
                if (recNames.indexOf(name) !== -1) return;           // same heterodimer on both sides
                const alpha = r[la].length ? aamsChain(p[0], r[la], extracellularEnd(la)) : { value: null, reason: 'recipient ' + la + ' not typed' };
                const beta = r[lb].length ? aamsChain(p[1], r[lb], extracellularEnd(lb)) : { value: null, reason: 'recipient ' + lb + ' not typed' };
                const both = alpha.value !== null && beta.value !== null;
                out.molecules.push({
                    klass: 'II', locus: kind, group: kind, molecule: name, chains: p,
                    permissive: kind === 'DQ' ? dqPermissive(p[0], p[1]) : null,
                    aams: { value: both ? alpha.value + beta.value : (beta.value !== null ? beta.value : null),
                            alpha: alpha, beta: beta,
                            note: both ? '' : (beta.value !== null ? 'alpha chain not comparable: beta chain only' : '') ,
                            reason: both ? '' : (alpha.reason || beta.reason) },
                    ems3d: recNames.length ? ems3dMolecule(kind, name, recNames)
                                           : { value: null, reason: 'recipient ' + kind + ' heterodimers unknown' }
                });
            });
        });

        out.groupsNeeded = uniq(out.molecules.map(function (m) { return m.group; }));

        // summaries: sum per class (Kosmoliaptsis 2016) and highest per locus (Kim et al. 2023)
        const byLocus = {};
        out.molecules.forEach(function (m) {
            const k = m.locus;
            byLocus[k] = byLocus[k] || { locus: k, klass: m.klass, n: 0, aamsMax: null, aamsSum: 0, emsMax: null, emsSum: 0, emsScored: 0, aamsScored: 0 };
            const s = byLocus[k];
            s.n++;
            if (m.aams.value !== null) { s.aamsScored++; s.aamsSum += m.aams.value; s.aamsMax = Math.max(s.aamsMax === null ? -1 : s.aamsMax, m.aams.value); }
            if (m.ems3d.value !== null) { s.emsScored++; s.emsSum += m.ems3d.value; s.emsMax = Math.max(s.emsMax === null ? -1 : s.emsMax, m.ems3d.value); }
        });
        function total(klass) {
            const t = { n: 0, aams: 0, aamsScored: 0, ems3d: 0, emsScored: 0 };
            out.molecules.forEach(function (m) {
                if (klass && m.klass !== klass) return;
                t.n++;
                if (m.aams.value !== null) { t.aams += m.aams.value; t.aamsScored++; }
                if (m.ems3d.value !== null) { t.ems3d += m.ems3d.value; t.emsScored++; }
            });
            return t;
        }
        out.summary = { byLocus: byLocus, classI: total('I'), classII: total('II'), all: total(null) };
        if (out.molecules.some(function (m) { return m.aams.imputedUsed; })) {
            out.warnings.push('Some AAMS positions rely on residues filled from the closest completely sequenced allele (IMGT has only exons 2-3 for that allele); they are marked in the position list.');
        }
        return out;
    }

    return {
        VERSION: '1.0', LOCI: LOCI, CLASS_I_END: CLASS_I_END, EMS_FILES: EMS_FILES,
        setData: setData, available: available, normalize: normalize, sequence: sequence,
        grantham: function (a, b) { return grantham()[String(a) + String(b)]; },
        hedPair: hedPair, hedGenotype: hedGenotype, hedBatch: hedBatch, hedBatchTsv: hedBatchTsv,
        aamsChain: aamsChain, heterodimers: heterodimers, dqPermissive: dqPermissive,
        esd: esd, ems3dMolecule: ems3dMolecule, ensureEms3d: ensureEms3d, emsLoaded: emsLoaded, emsCovers: emsCovers,
        emsMeta: function () { return emsData() ? emsData().meta : null; },
        score: score, extracellularEnd: extracellularEnd
    };
}));
