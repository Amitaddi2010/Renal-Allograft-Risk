/*
 * hla_3d.js — 3D view of mismatched eplets on the donor HLA molecule (proof of concept, pHLA3D-style).
 *
 * How it works
 *   1. The mismatch engine already gives, per donor allele, the mismatched eplet names. An eplet name encodes its
 *      anchor residue position in the mature protein (62QE -> position 62; rq70RR/K -> position 70), so the
 *      positions can be highlighted on any structure of that molecule.
 *   2. A structure is fetched for the allele: an experimentally solved RCSB PDB entry when one exists for that
 *      allele, otherwise a template structure of the same locus (clearly labelled), or a PDB file supplied by the
 *      user (for example a homology model downloaded from pHLA3D, https://www.phla3d.com.br/, research-use licence).
 *   3. 3Dmol.js (loaded on demand from cdnjs) renders the molecule as a cartoon and marks the eplet anchor
 *      residues as spheres: pink = in the IE.xlsx immunogenic catalogue, cyan = antibody-verified in
 *      HLAMatchmaker, grey = other mismatched eplet. Residues within 3.5 A of an anchor are tinted, which is
 *      HLAMatchmaker's working definition of an eplet patch.
 *
 * Limitations of this prototype: residue numbering is assumed to follow the mature-protein numbering used by
 * HLAMatchmaker (true for the listed entries); a template of the same locus is not the donor allele itself;
 * internet access is required for the viewer library and RCSB structures unless a local PDB file is loaded.
 */
(function () {
    'use strict';
    const $ = function (id) { return document.getElementById(id); };
    const LIB_URL = 'https://cdnjs.cloudflare.com/ajax/libs/3Dmol/2.5.5/3Dmol-min.js';

    // Verified RCSB entries (titles checked 2026-09-08). chain: chain carrying the eplet-bearing polypeptide.
    const STRUCTURES = {
        'A*02:01': { pdb: '1AKJ', chain: 'A', label: 'HLA-A*02:01 heavy chain (with CD8, RCSB 1AKJ)' },
        'A*24:02': { pdb: '2BCK', chain: 'A', label: 'HLA-A*24:02 (RCSB 2BCK)' },
        'A*11:01': { pdb: '1Q94', chain: 'A', label: 'HLA-A*11:01 (RCSB 1Q94)' },
        'B*35:01': { pdb: '1A1N', chain: 'A', label: 'HLA-B*35:01 (RCSB 1A1N)' },
        'B*44:02': { pdb: '1M6O', chain: 'A', label: 'HLA-B*44:02 (RCSB 1M6O)' },
        'B*57:01': { pdb: '2RFX', chain: 'A', label: 'HLA-B*57:01 (RCSB 2RFX)' },
        'B*27:05': { pdb: '1HSA', chain: 'A', label: 'HLA-B*27:05 (RCSB 1HSA)' },
        'B*08:01': { pdb: '1MI5', chain: 'A', label: 'HLA-B*08:01 (with TCR, RCSB 1MI5)' },
        'B*07:02': { pdb: '5EO0', chain: 'A', label: 'HLA-B*07:02 (RCSB 5EO0)' },
        'C*04:01': { pdb: '1QQD', chain: 'A', label: 'HLA-C*04:01 (RCSB 1QQD)' },
        'C*06:02': { pdb: '5W67', chain: 'A', label: 'HLA-C*06:02 (RCSB 5W67)' },
        'DRB1*01:01': { pdb: '1DLH', chain: 'B', label: 'HLA-DR1 beta chain DRB1*01:01 (RCSB 1DLH)' },
        'DRB1*15:01': { pdb: '1BX2', chain: 'B', label: 'HLA-DR2 beta chain DRB1*15:01 (RCSB 1BX2)' },
        'DRB1*04:01': { pdb: '1J8H', chain: 'B', label: 'HLA-DR4 beta chain DRB1*04:01 (with TCR, RCSB 1J8H)' },
        'DRB1*03:01': { pdb: '1A6A', chain: 'B', label: 'HLA-DR3 beta chain DRB1*03:01 (RCSB 1A6A)' },
        'DQB1*03:02': { pdb: '1JK8', chain: 'B', label: 'HLA-DQ8 beta chain DQB1*03:02 (RCSB 1JK8)' },
        'DQA1*03:01': { pdb: '1JK8', chain: 'A', label: 'HLA-DQ8 alpha chain DQA1*03:01 (RCSB 1JK8)' },
        'DQB1*02:01': { pdb: '1S9V', chain: 'B', label: 'HLA-DQ2 beta chain DQB1*02:01 (RCSB 1S9V)' },
        'DQA1*05:01': { pdb: '1S9V', chain: 'A', label: 'HLA-DQ2 alpha chain DQA1*05:01 (RCSB 1S9V)' },
        'DQB1*06:02': { pdb: '1UVQ', chain: 'B', label: 'HLA-DQ6 beta chain DQB1*06:02 (RCSB 1UVQ)' },
        'DQA1*01:02': { pdb: '1UVQ', chain: 'A', label: 'HLA-DQ6 alpha chain DQA1*01:02 (RCSB 1UVQ)' },
        'DPB1*02:01': { pdb: '3LQZ', chain: 'B', label: 'HLA-DP2 beta chain DPB1*02:01 (RCSB 3LQZ)' },
        'DPA1*01:03': { pdb: '3LQZ', chain: 'A', label: 'HLA-DP2 alpha chain DPA1*01:03 (RCSB 3LQZ)' }
    };
    const TEMPLATES = {
        A: 'A*02:01', B: 'B*35:01', C: 'C*04:01',
        DRB1: 'DRB1*01:01', DRB3: 'DRB1*01:01', DRB4: 'DRB1*01:01', DRB5: 'DRB1*01:01',
        DQB1: 'DQB1*03:02', DQA1: 'DQA1*03:01', DPB1: 'DPB1*02:01', DPA1: 'DPA1*01:03'
    };
    const COLORS = { ie: '#fad1ff', abver: '#38bdf8', other: '#b8c4c3', neighbour: '#5b7f7b', chain: '#2f5f5a', otherChains: '#13302e' };

    let viewer = null;
    let libPromise = null;
    let current = null;          // last analysis result
    let localPdb = null;         // {name, text} supplied by the user
    let spinning = false;

    function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function setMsg(html, kind) { const el = $('hla3d-msg'); if (el) { el.className = 'hla-warn hla-warn-' + (kind || 'info'); el.innerHTML = html; } }

    function loadLibrary() {
        if (window.$3Dmol) return Promise.resolve();
        if (libPromise) return libPromise;
        libPromise = new Promise(function (resolve, reject) {
            const s = document.createElement('script');
            s.src = LIB_URL; s.async = true;
            s.onload = function () { resolve(); };
            s.onerror = function () { libPromise = null; reject(new Error('The 3D viewer library could not be loaded (internet connection needed for cdnjs.cloudflare.com).')); };
            document.head.appendChild(s);
        });
        return libPromise;
    }

    function positionOf(name) { const m = String(name).match(/^[a-z]*(\d+)/); return m ? parseInt(m[1], 10) : null; }

    /* donor alleles with mismatched eplets from the last analysis */
    function donorEntries(res) {
        const out = [];
        ['classI', 'classIIB', 'classIIA'].forEach(function (k) {
            const c = res.eplet[k];
            if (!c.evaluated) return;
            c.donorAlleles.forEach(function (d) { out.push({ allele: d.allele, locus: d.locus, inferred: d.inferred, classKey: k, mismatched: d.mismatched }); });
        });
        return out;
    }

    function update(res) {
        current = res;
        const sel = $('hla3d-allele');
        if (!sel) return;
        const entries = donorEntries(res);
        const prev = sel.value;
        sel.innerHTML = entries.length
            ? entries.map(function (e) { return '<option value="' + esc(e.allele) + '">' + esc(e.allele) + (e.inferred ? ' (inferred)' : '') + ' · ' + e.mismatched.length + ' mismatched eplet' + (e.mismatched.length === 1 ? '' : 's') + (STRUCTURES[e.allele] ? ' · solved structure' : ' · locus template') + '</option>'; }).join('')
            : '<option value="">No donor allele with an eplet comparison yet</option>';
        if (prev && entries.some(function (e) { return e.allele === prev; })) sel.value = prev;
        const btn = $('hla3d-load');
        if (btn) btn.disabled = !entries.length;
        const cnt = $('hla-count-3d');
        if (cnt) cnt.textContent = entries.length ? entries.length + ' donor alleles' : '0';
        if (viewer && entries.length && sel.value) render(sel.value);    // keep the open view in sync
    }

    function resolveStructure(entry) {
        if (localPdb) return { pdb: null, text: localPdb.text, chain: null, label: 'Local file ' + localPdb.name, template: false };
        const exact = STRUCTURES[entry.allele];
        if (exact) return Object.assign({ template: false }, exact);
        const t = TEMPLATES[entry.locus];
        const s = STRUCTURES[t];
        return Object.assign({ template: true, templateAllele: t }, s);
    }

    function chainCounts(model) {
        const counts = {};
        model.selectedAtoms({}).forEach(function (a) {
            if (a.atom !== 'CA') return;
            counts[a.chain] = (counts[a.chain] || 0) + 1;
        });
        return counts;
    }

    function show() {
        const sel = $('hla3d-allele');
        if (!sel || !sel.value || !current) return;
        setMsg('Loading the 3D viewer…', 'info');
        loadLibrary().then(function () { render(sel.value); }).catch(function (e) { setMsg(esc(e.message), 'error'); });
    }

    function render(allele) {
        const entry = donorEntries(current).filter(function (e) { return e.allele === allele; })[0];
        if (!entry) return;
        const struct = resolveStructure(entry);
        const host = $('hla3d-viewer');
        host.hidden = false;
        if (!viewer) viewer = $3Dmol.createViewer(host, { backgroundColor: '#011d1c' });
        viewer.removeAllModels(); viewer.removeAllLabels(); viewer.removeAllSurfaces();
        const done = function (model) {
            if (!model) { setMsg('Structure could not be loaded (internet connection needed for files.rcsb.org, or load a local PDB file).', 'error'); return; }
            const counts = chainCounts(model);
            let chain = struct.chain;
            if (!chain || !counts[chain] || counts[chain] < 150) {          // fall back to the longest chain
                chain = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
            }
            const byCat = { ie: [], abver: [], other: [] };
            const labelled = {};
            entry.mismatched.forEach(function (e) {
                const p = positionOf(e.name);
                if (p === null) return;
                const cat = e.ie ? 'ie' : (e.abver ? 'abver' : 'other');
                byCat[cat].push(p);
                (labelled[p] = labelled[p] || []).push(e.name);
            });
            const all = [].concat(byCat.ie, byCat.abver, byCat.other);
            viewer.setStyle({}, { cartoon: { color: COLORS.otherChains, opacity: 0.55 } });
            viewer.setStyle({ chain: chain }, { cartoon: { color: COLORS.chain } });
            if (all.length) {
                viewer.addStyle({ chain: chain, within: { distance: 3.5, sel: { chain: chain, resi: all } } }, { cartoon: { color: COLORS.neighbour } });
                ['other', 'abver', 'ie'].forEach(function (cat) {
                    if (!byCat[cat].length) return;
                    viewer.addStyle({ chain: chain, resi: byCat[cat] }, { sphere: { radius: 1.7, color: COLORS[cat] }, stick: { radius: 0.25, color: COLORS[cat] } });
                });
                Object.keys(labelled).forEach(function (p) {
                    const names = labelled[p];
                    const cat = byCat.ie.indexOf(+p) !== -1 ? 'ie' : (byCat.abver.indexOf(+p) !== -1 ? 'abver' : 'other');
                    viewer.addLabel(names.join(' / '), { fontSize: 11, fontColor: '#012624', backgroundColor: COLORS[cat], backgroundOpacity: 0.9, borderThickness: 0, inFront: true }, { chain: chain, resi: +p, atom: 'CA' });
                });
            }
            viewer.zoomTo({ chain: chain });
            viewer.render();
            if (spinning) viewer.spin('y', 0.4);
            const total = entry.mismatched.length, shown = all.length;
            setMsg('<strong>' + esc(entry.allele) + '</strong> shown on ' + esc(struct.label) + (struct.template ? ' — <strong>template of the same locus</strong>, not the donor allele itself (no solved structure in the built-in list; load a pHLA3D model for the exact allele).' : '.') +
                ' Chain ' + esc(chain) + ' (' + counts[chain] + ' residues). Highlighted: ' + shown + ' of ' + total + ' mismatched eplet positions — ' + byCat.ie.length + ' immunogenic (pink), ' + byCat.abver.length + ' antibody-verified (cyan), ' + byCat.other.length + ' other (grey); residues within 3.5 Å of an anchor are tinted green.', 'ok');
        };
        if (struct.text) {
            const m = viewer.addModel(struct.text, 'pdb');
            done(m);
        } else {
            $3Dmol.download('pdb:' + struct.pdb, viewer, {}, function (m) { done(m); });
        }
    }

    function toggleSpin() { spinning = !spinning; if (viewer) viewer.spin(spinning ? 'y' : false, 0.4); const b = $('hla3d-spin'); if (b) b.textContent = spinning ? 'Stop rotation' : 'Rotate'; }
    function resetView() { if (viewer) { viewer.zoomTo(); viewer.render(); } }
    function toggleSurface() {
        if (!viewer) return;
        const b = $('hla3d-surface');
        if (b.dataset.on === '1') { viewer.removeAllSurfaces(); b.dataset.on = '0'; b.textContent = 'Show surface'; }
        else { viewer.addSurface($3Dmol.SurfaceType.VDW, { opacity: 0.35, color: '#0d9488' }, {}); b.dataset.on = '1'; b.textContent = 'Hide surface'; }
        viewer.render();
    }
    function loadLocalFile(input) {
        const f = input.files && input.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = function () { localPdb = { name: f.name, text: String(r.result) }; setMsg('Local structure ' + esc(f.name) + ' will be used for the next 3D view (press Load 3D view).', 'info'); };
        r.readAsText(f);
    }
    function clearLocalFile() { localPdb = null; const i = $('hla3d-file'); if (i) i.value = ''; setMsg('Built-in RCSB structures will be used.', 'info'); }

    window.HLA3D = { update: update, show: show, toggleSpin: toggleSpin, resetView: resetView, toggleSurface: toggleSurface, loadLocalFile: loadLocalFile, clearLocalFile: clearLocalFile, STRUCTURES: STRUCTURES, TEMPLATES: TEMPLATES };
})();
