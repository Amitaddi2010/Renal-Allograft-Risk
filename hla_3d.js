/*
 * hla_3d.js — 3D view of mismatched eplets on the donor HLA molecule (pHLA3D-style).
 *
 * Structure sources, in order of preference:
 *   1. a local pHLA3D homology model of the exact allele (structures/phla3d/, listed in manifest.json; only
 *      reachable when the app is served over http, e.g. python -m http.server) or a PDB file the user loads;
 *   2. the offline bundle hla_structures_data.js (trimmed RCSB entries for 23 common alleles, loaded on demand);
 *   3. RCSB online download; otherwise a template of the same locus (clearly labelled).
 * Viewer: 3Dmol.js from vendor/3Dmol-min.js (offline), falling back to cdnjs.
 * Eplet patches: hla_eplet_residues.js gives, for every eplet, the residue positions derived from the
 * HLAMatchmaker sequence tables and template structures (tools/build_eplet_residues.py); the anchor residue is
 * drawn as a large sphere, the other residues of the patch as smaller spheres. Colours: pink = in the IE.xlsx
 * immunogenic catalogue, cyan = antibody-verified in HLAMatchmaker, grey = other mismatched eplet.
 * Numbering check: the residue found at each anchor position is compared with the residue letter in the eplet
 * name; disagreements are counted and reported, so a wrongly numbered structure is noticed immediately.
 */
(function () {
    'use strict';
    const $ = function (id) { return document.getElementById(id); };
    const LIB_LOCAL = 'vendor/3Dmol-min.js';
    const LIB_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/3Dmol/2.5.5/3Dmol-min.js';
    const BUNDLE = 'hla_structures_data.js';
    const PHLA_MANIFEST = 'structures/phla3d/manifest.json';

    // Verified RCSB entries (titles checked 2026-09-08). chain: chain carrying the eplet-bearing polypeptide.
    const STRUCTURES = {
        'A*02:01': { pdb: '1AKJ', chain: 'A', label: 'HLA-A*02:01 heavy chain (RCSB 1AKJ)' },
        'A*24:02': { pdb: '2BCK', chain: 'A', label: 'HLA-A*24:02 (RCSB 2BCK)' },
        'A*11:01': { pdb: '1Q94', chain: 'A', label: 'HLA-A*11:01 (RCSB 1Q94)' },
        'B*35:01': { pdb: '1A1N', chain: 'A', label: 'HLA-B*35:01 (RCSB 1A1N)' },
        'B*44:02': { pdb: '1M6O', chain: 'A', label: 'HLA-B*44:02 (RCSB 1M6O)' },
        'B*57:01': { pdb: '2RFX', chain: 'A', label: 'HLA-B*57:01 (RCSB 2RFX)' },
        'B*27:05': { pdb: '1HSA', chain: 'A', label: 'HLA-B*27:05 (RCSB 1HSA)' },
        'B*08:01': { pdb: '1MI5', chain: 'A', label: 'HLA-B*08:01 (RCSB 1MI5)' },
        'B*07:02': { pdb: '5EO0', chain: 'A', label: 'HLA-B*07:02 (RCSB 5EO0)' },
        'C*04:01': { pdb: '1QQD', chain: 'A', label: 'HLA-C*04:01 (RCSB 1QQD)' },
        'C*06:02': { pdb: '5W67', chain: 'A', label: 'HLA-C*06:02 (RCSB 5W67)' },
        'DRB1*01:01': { pdb: '1DLH', chain: 'B', label: 'HLA-DR1 β chain DRB1*01:01 (RCSB 1DLH)' },
        'DRB1*15:01': { pdb: '1BX2', chain: 'B', label: 'HLA-DR2 β chain DRB1*15:01 (RCSB 1BX2)' },
        'DRB1*04:01': { pdb: '1J8H', chain: 'B', label: 'HLA-DR4 β chain DRB1*04:01 (RCSB 1J8H)' },
        'DRB1*03:01': { pdb: '1A6A', chain: 'B', label: 'HLA-DR3 β chain DRB1*03:01 (RCSB 1A6A)' },
        'DQB1*03:02': { pdb: '1JK8', chain: 'B', label: 'HLA-DQ8 β chain DQB1*03:02 (RCSB 1JK8)' },
        'DQA1*03:01': { pdb: '1JK8', chain: 'A', label: 'HLA-DQ8 α chain DQA1*03:01 (RCSB 1JK8)' },
        'DQB1*02:01': { pdb: '1S9V', chain: 'B', label: 'HLA-DQ2 β chain DQB1*02:01 (RCSB 1S9V)' },
        'DQA1*05:01': { pdb: '1S9V', chain: 'A', label: 'HLA-DQ2 α chain DQA1*05:01 (RCSB 1S9V)' },
        'DQB1*06:02': { pdb: '1UVQ', chain: 'B', label: 'HLA-DQ6 β chain DQB1*06:02 (RCSB 1UVQ)' },
        'DQA1*01:02': { pdb: '1UVQ', chain: 'A', label: 'HLA-DQ6 α chain DQA1*01:02 (RCSB 1UVQ)' },
        'DPB1*02:01': { pdb: '3LQZ', chain: 'B', label: 'HLA-DP2 β chain DPB1*02:01 (RCSB 3LQZ)' },
        'DPA1*01:03': { pdb: '3LQZ', chain: 'A', label: 'HLA-DP2 α chain DPA1*01:03 (RCSB 3LQZ)' }
    };
    const TEMPLATES = {
        A: 'A*02:01', B: 'B*35:01', C: 'C*04:01',
        DRB1: 'DRB1*01:01', DRB3: 'DRB1*01:01', DRB4: 'DRB1*01:01', DRB5: 'DRB1*01:01',
        DQB1: 'DQB1*03:02', DQA1: 'DQA1*03:01', DPB1: 'DPB1*02:01', DPA1: 'DPA1*01:03'
    };
    const COLORS = { ie: '#ff1475', abver: '#00e5ff', other: '#cbd5e1', chain: '#328b83', otherChains: '#122927' };
    const AA = { ALA: 'A', ARG: 'R', ASN: 'N', ASP: 'D', CYS: 'C', GLN: 'Q', GLU: 'E', GLY: 'G', HIS: 'H', ILE: 'I', LEU: 'L', LYS: 'K', MET: 'M', PHE: 'F', PRO: 'P', SER: 'S', THR: 'T', TRP: 'W', TYR: 'Y', VAL: 'V' };

    let viewer = null, libPromise = null, bundlePromise = null, manifestPromise = null;
    let current = null, localPdb = null, spinning = false, showLabels = true;

    function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function setMsg(html, kind) { const el = $('hla3d-msg'); if (el) { el.className = 'hla-warn hla-warn-' + (kind || 'info'); el.innerHTML = html; } }
    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            const s = document.createElement('script'); s.src = src; s.async = true;
            s.onload = function () { resolve(src); }; s.onerror = function () { reject(new Error('could not load ' + src)); };
            document.head.appendChild(s);
        });
    }
    function loadLibrary() {
        if (window.$3Dmol) return Promise.resolve();
        if (!libPromise) libPromise = loadScript(LIB_LOCAL).catch(function () { return loadScript(LIB_CDN); }).catch(function () { libPromise = null; throw new Error('The 3D viewer library could not be loaded (vendor/3Dmol-min.js missing and no internet connection to cdnjs).'); });
        return libPromise;
    }
    function loadBundle() {
        if (window.HLA_STRUCTURES) return Promise.resolve();
        if (!bundlePromise) bundlePromise = loadScript(BUNDLE).catch(function () { bundlePromise = null; });
        return bundlePromise;
    }
    function loadManifest() {
        if (!manifestPromise) {
            manifestPromise = (window.location.protocol.indexOf('http') === 0 && window.fetch)
                ? fetch(PHLA_MANIFEST, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })
                : Promise.resolve({});
        }
        return manifestPromise;
    }

    function positionsOf(name, classKey, locus) {
        const table = window.HLA_EPLET_RES && window.HLA_EPLET_RES[classKey];
        const rec = table && table[name];
        if (rec && rec.anchor) {
            let positions = rec.positions && rec.positions.length ? rec.positions.slice() : [rec.anchor];
            let anchor = positions[0];
            // interlocus eplets are named in DR/DQ-aligned numbering; DP chains lack two residues (aligned 23-24)
            if (rec.aligned && locus === 'DPB1') { positions = positions.map(function (q) { return q >= 25 ? q - 2 : q; }); anchor = positions[0]; }
            if (rec.aligned && locus === 'DPA1') { positions = positions.map(function (q) { return q >= 17 ? q - 3 : q - 2; }); anchor = positions[0]; }
            return { anchor: anchor, positions: positions, method: rec.method };
        }
        const m = String(name).match(/^[a-z]*(\d+)/);
        return m ? { anchor: parseInt(m[1], 10), positions: [parseInt(m[1], 10)], method: 'anchor-only' } : null;
    }
    function letterOf(name) { const m = String(name).match(/^[a-z]*\d+([A-Z])/); return m ? m[1] : null; }

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
        loadManifest().then(function (manifest) {
            const entries = donorEntries(res);
            // Sort entries so alleles with mismatched eplets appear first, prioritizing immunogenic burden
            entries.sort(function (a, b) {
                const countA = a.mismatched ? a.mismatched.length : 0;
                const countB = b.mismatched ? b.mismatched.length : 0;
                if (countB !== countA) return countB - countA;
                const ieA = a.mismatched ? a.mismatched.filter(function (e) { return e.ie; }).length : 0;
                const ieB = b.mismatched ? b.mismatched.filter(function (e) { return e.ie; }).length : 0;
                return ieB - ieA;
            });
            const prev = sel.value;
            sel.innerHTML = entries.length
                ? entries.map(function (e) {
                    const src = manifest[e.allele] ? 'pHLA3D model' : (STRUCTURES[e.allele] ? 'solved structure' : 'locus template');
                    const mmCount = e.mismatched ? e.mismatched.length : 0;
                    const mmLabel = mmCount === 0
                        ? '0 mismatched eplets (matched with recipient)'
                        : mmCount + ' mismatched eplet' + (mmCount === 1 ? '' : 's');
                    return '<option value="' + esc(e.allele) + '">' + esc(e.allele) + (e.inferred ? ' (inferred)' : '') + ' · ' + mmLabel + ' · ' + src + '</option>';
                }).join('')
                : '<option value="">No donor allele with an eplet comparison yet</option>';
            if (prev && entries.some(function (e) { return e.allele === prev; })) {
                sel.value = prev;
            } else if (entries.length) {
                const best = entries.find(function (e) { return e.mismatched && e.mismatched.length > 0; }) || entries[0];
                sel.value = best.allele;
            }
            const btn = $('hla3d-load'); if (btn) btn.disabled = !entries.length;
            const cnt = $('hla-count-3d'); if (cnt) cnt.textContent = entries.length ? entries.length + ' donor alleles' : '0';
            if (viewer && entries.length && sel.value) render(sel.value);
        });
    }

    /* returns a promise of {text, chain, label, template, source} */
    function resolveStructure(entry) {
        if (localPdb) return Promise.resolve({ text: localPdb.text, chain: null, label: 'local file ' + localPdb.name, template: false, source: 'local' });
        return loadManifest().then(function (manifest) {
            const rel = manifest[entry.allele];
            if (rel && window.fetch) {
                return fetch(rel).then(function (r) { if (!r.ok) throw new Error('missing'); return r.text(); })
                    .then(function (text) { return { text: text, chain: null, label: 'pHLA3D homology model of ' + entry.allele + ' (www.phla3d.com.br, research use; cite pHLA3D)', template: false, source: 'phla3d' }; })
                    .catch(function () { return fromBundleOrRcsb(entry); });
            }
            return fromBundleOrRcsb(entry);
        });
    }
    function fromBundleOrRcsb(entry) {
        const exact = STRUCTURES[entry.allele];
        const key = exact ? entry.allele : TEMPLATES[entry.locus];
        const s = STRUCTURES[key];
        const base = { chain: s.chain, label: s.label, template: !exact, templateAllele: key, pdb: s.pdb };
        return loadBundle().then(function () {
            if (window.HLA_STRUCTURES && window.HLA_STRUCTURES[s.pdb]) return Object.assign({ text: window.HLA_STRUCTURES[s.pdb].pdb, source: 'bundle' }, base);
            return Object.assign({ text: null, source: 'rcsb' }, base);   // fetched by 3Dmol from RCSB
        });
    }

    function chainInfo(model) {
        const counts = {}, resn = {};
        model.selectedAtoms({}).forEach(function (a) {
            if (a.atom !== 'CA') return;
            counts[a.chain] = (counts[a.chain] || 0) + 1;
            (resn[a.chain] = resn[a.chain] || {})[a.resi] = a.resn;
        });
        return { counts: counts, resn: resn };
    }

    function show() {
        const sel = $('hla3d-allele');
        if (!sel || !sel.value || !current) return;
        setMsg('Loading the 3D viewer and the structure…', 'info');
        loadLibrary().then(function () { return render(sel.value); }).catch(function (e) { setMsg(esc(e.message), 'error'); });
    }

    let canvasTheme = 'dark'; // 'dark' | 'light'
    function toggleCanvasTheme() {
        canvasTheme = canvasTheme === 'dark' ? 'light' : 'dark';
        const b = $('hla3d-canvas-theme');
        if (b) {
            b.textContent = canvasTheme === 'dark' ? '☀️ Light canvas' : '🌙 Dark canvas';
        }
        const host = $('hla3d-viewer');
        if (host) {
            host.style.background = canvasTheme === 'dark' ? '#0a0f1d' : '#f8fafc';
        }
        if (viewer && current) {
            const sel = $('hla3d-allele');
            if (sel && sel.value) render(sel.value);
        }
    }

    function render(allele) {
        const entry = donorEntries(current).filter(function (e) { return e.allele === allele; })[0];
        if (!entry) return Promise.resolve();
        const host = $('hla3d-viewer');
        host.hidden = false;
        const isLight = (window.UX && UX.currentTheme && UX.currentTheme() === 'glass') || (canvasTheme === 'light');
        const bgColor = isLight ? '#f8fafc' : '#0a0f1d';
        if (!viewer) viewer = $3Dmol.createViewer(host, { backgroundColor: bgColor, antialias: true });
        else viewer.setBackgroundColor(bgColor);

        if (isLight) {
            COLORS.chain = '#0d9488';          // Deep sea-teal for donor target chain
            COLORS.partnerChain = '#94a3b8';   // Clear cool slate silver for partner chain (DRA / beta-2m)
            COLORS.peptide = '#d97706';        // Radiant amber gold for bound peptide
            COLORS.ie = '#e11d48';             // Deep crimson-magenta for immunogenic
            COLORS.abver = '#0284c7';          // Deep vibrant cyan for ab-verified
            COLORS.other = '#475569';          // Slate charcoal for other mismatched
        } else {
            COLORS.chain = '#00c9b7';          // Luminous electric sea-teal
            COLORS.partnerChain = '#718096';   // Clean platinum slate (bright, completely visible, never black!)
            COLORS.peptide = '#fbbf24';        // Radiant warm gold
            COLORS.ie = '#ff007f';             // Luminous neon hot magenta
            COLORS.abver = '#00f0ff';          // Electric high-voltage cyan
            COLORS.other = '#f1f5f9';          // Bright polished pearl silver
        }

        return resolveStructure(entry).then(function (struct) {
            viewer.removeAllModels(); viewer.removeAllLabels(); viewer.removeAllSurfaces();
            const done = function (model) {
                if (!model) { setMsg('Structure could not be loaded (no internet connection to files.rcsb.org; load a local PDB file instead).', 'error'); return; }
                const info = chainInfo(model);
                let chain = struct.chain;
                if (!chain || !info.counts[chain] || info.counts[chain] < 100) {
                    if (['DRB1', 'DRB3', 'DRB4', 'DRB5', 'DQB1', 'DPB1'].indexOf(entry.locus) !== -1 && info.counts['B']) {
                        chain = 'B';
                    } else if (info.counts['A']) {
                        chain = 'A';
                    } else {
                        chain = Object.keys(info.counts).sort(function (a, b) { return info.counts[b] - info.counts[a]; })[0];
                    }
                }
                const byCat = { ie: { anchors: [], patch: [] }, abver: { anchors: [], patch: [] }, other: { anchors: [], patch: [] } };
                const labelled = {};
                let checked = 0, agree = 0, anchorOnly = 0;
                entry.mismatched.forEach(function (e) {
                    const p = positionsOf(e.name, entry.classKey, entry.locus);
                    if (!p) return;
                    const cat = e.ie ? 'ie' : (e.abver ? 'abver' : 'other');
                    byCat[cat].anchors.push(p.anchor);
                    p.positions.forEach(function (q) { if (q !== p.anchor) byCat[cat].patch.push(q); });
                    if (p.method === 'anchor-only' || p.method === 'incomplete') anchorOnly++;
                    (labelled[p.anchor] = labelled[p.anchor] || { names: [], cat: cat }).names.push(e.name);
                    const found = info.resn[chain] && info.resn[chain][p.anchor];
                    const want = letterOf(e.name);
                    if (found && want) { checked++; if (AA[found] === want) agree++; }
                });

                // Clear previous styles and style every polypeptide chain according to its biological role
                viewer.setStyle({}, {});
                Object.keys(info.counts).forEach(function (ch) {
                    const count = info.counts[ch];
                    if (ch === chain) {
                        // Primary donor allele chain carrying the eplet mismatches
                        viewer.setStyle({ chain: ch }, {
                            cartoon: {
                                color: COLORS.chain,
                                arrows: true,
                                thickness: 0.48,
                                opacity: 0.96
                            }
                        });
                    } else if (count < 35) {
                        // Antigenic peptide nestled in the binding cleft
                        viewer.setStyle({ chain: ch }, {
                            cartoon: {
                                color: COLORS.peptide,
                                thickness: 0.38,
                                opacity: 0.95
                            }
                        });
                    } else {
                        // Heterodimer partner chain (e.g. DRA alpha chain for DRB1, or beta-2m for Class I)
                        viewer.setStyle({ chain: ch }, {
                            cartoon: {
                                color: COLORS.partnerChain,
                                arrows: true,
                                thickness: 0.44,
                                opacity: 0.88
                            }
                        });
                    }
                });

                // Mismatched eplet patches on the target allele
                ['other', 'abver', 'ie'].forEach(function (cat) {
                    if (byCat[cat].patch.length) {
                        viewer.addStyle(
                            { chain: chain, resi: byCat[cat].patch },
                            { sphere: { radius: 1.35, color: COLORS[cat], opacity: 0.98 } }
                        );
                    }
                    if (byCat[cat].anchors.length) {
                        viewer.addStyle(
                            { chain: chain, resi: byCat[cat].anchors },
                            {
                                sphere: { radius: 2.1, color: COLORS[cat], opacity: 1.0 },
                                stick: { radius: 0.35, color: COLORS[cat] }
                            }
                        );
                    }
                });

                // High-visibility floating HUD labels with category color border
                if (showLabels) {
                    Object.keys(labelled).forEach(function (p) {
                        const item = labelled[p];
                        const cat = item.cat;
                        const names = item.names;
                        const labelText = names.length <= 2 ? names.join(' · ') : names[0] + ' (+' + (names.length - 1) + ')';
                        const isIE = cat === 'ie';
                        const isAbver = cat === 'abver';
                        const labelBg = isLight
                            ? (isIE ? 'rgba(255, 228, 239, 0.95)' : (isAbver ? 'rgba(224, 247, 250, 0.95)' : 'rgba(241, 245, 249, 0.95)'))
                            : (isIE ? 'rgba(38, 3, 20, 0.94)' : (isAbver ? 'rgba(2, 30, 36, 0.94)' : 'rgba(15, 23, 42, 0.94)'));
                        const labelBorder = COLORS[cat];
                        const labelColor = isLight
                            ? (isIE ? '#be123c' : (isAbver ? '#0e7490' : '#1e293b'))
                            : (isIE ? '#ff7bb3' : (isAbver ? '#80f2ff' : '#f8fafc'));
                        viewer.addLabel(labelText, {
                            fontSize: 11,
                            font: 'sans-serif',
                            fontColor: labelColor,
                            backgroundColor: labelBg,
                            backgroundOpacity: 0.95,
                            borderColor: labelBorder,
                            borderThickness: 1.5,
                            inFront: true
                        }, { chain: chain, resi: +p, atom: 'CA' });
                    });
                }

                viewer.zoomTo({ chain: chain });
                viewer.render();
                if (spinning) viewer.spin('y', 0.4);
                const total = entry.mismatched.length;
                const nIE = byCat.ie.anchors.length, nAb = byCat.abver.anchors.length, nOt = byCat.other.anchors.length;
                const numbering = checked ? (agree === checked ? 'Numbering check passed: the residue at every anchor position matches the eplet name (' + agree + '/' + checked + ').'
                    : '<strong>Numbering check: ' + agree + ' of ' + checked + ' anchor residues match the eplet names</strong>' + (agree < checked / 2 ? ' — this structure is probably numbered differently from HLAMatchmaker, or it is a template of another allele; positions may be shifted.' : ' (differences are expected on a template of another allele).')) : '';
                const kind = checked && agree < checked / 2 ? 'warn' : 'ok';
                const highlightText = total === 0
                    ? '<strong>0 mismatched eplets (matched with recipient).</strong> Select a donor allele with mismatched eplets from the dropdown to view highlighted eplet patches.'
                    : 'Highlighted ' + (nIE + nAb + nOt) + ' of ' + total + ' mismatched eplets — ' + nIE + ' immunogenic (pink), ' + nAb + ' antibody-verified (cyan), ' + nOt + ' other (grey); large spheres are anchor residues, small spheres the other residues of each eplet patch' + (anchorOnly ? ' (' + anchorOnly + ' shown as anchor only)' : '') + '.';
                
                const chainLegend = '<strong>Target allele:</strong> Chain ' + esc(chain) + ' (' + info.counts[chain] + ' residues, sea-teal).' +
                    (Object.keys(info.counts).length > 1 ? ' <strong>Complex:</strong> ' + Object.keys(info.counts).filter(function(c){return c !== chain;}).map(function(c){
                        return 'Chain ' + esc(c) + ' (' + info.counts[c] + ' residues, ' + (info.counts[c] < 35 ? 'peptide' : 'partner chain') + ')';
                    }).join(', ') + '.' : '');

                setMsg('<strong>' + esc(entry.allele) + '</strong> shown on ' + esc(struct.label) + (struct.template ? ' — <strong>template of the same locus</strong>, not the donor allele itself (download a pHLA3D model for the exact allele with tools/fetch_structures.py, or load a PDB file above).' : '.') +
                    '<br>' + chainLegend + '<br>' + highlightText + (numbering ? ' ' + numbering : ''), kind);
            };
            if (struct.text) done(viewer.addModel(struct.text, 'pdb'));
            else $3Dmol.download('pdb:' + struct.pdb, viewer, {}, function (m) { done(m); });
        });
    }

    /* deep-link helper: wait until the allele list is populated, pick the first donor allele with mismatches, show it */
    function showFirstWithMismatches() {
        if (!current) return;
        loadManifest().then(function () {
            const sel = $('hla3d-allele');
            const entries = donorEntries(current);
            const first = entries.filter(function (e) { return e.mismatched.length; })[0];
            if (!sel || !first) return;
            const sec = $('hla3d-section'); if (sec) sec.open = true;
            sel.value = first.allele;
            show();
        });
    }

    function toggleSpin() { spinning = !spinning; if (viewer) viewer.spin(spinning ? 'y' : false, 0.4); const b = $('hla3d-spin'); if (b) b.textContent = spinning ? 'Stop rotation' : 'Rotate'; }
    function resetView() { if (viewer) { viewer.zoomTo(); viewer.render(); } }
    function toggleLabels() {
        showLabels = !showLabels;
        const b = $('hla3d-labels');
        if (b) {
            b.dataset.on = showLabels ? '1' : '0';
            b.textContent = showLabels ? 'Hide labels' : 'Show labels';
        }
        if (viewer && current) {
            const sel = $('hla3d-allele');
            if (sel && sel.value) render(sel.value);
        }
    }
    function toggleSurface() {
        if (!viewer) return;
        const b = $('hla3d-surface');
        if (b.dataset.on === '1') {
            viewer.removeAllSurfaces();
            b.dataset.on = '0';
            b.textContent = 'Show surface';
        } else {
            const isLight = (window.UX && UX.currentTheme && UX.currentTheme() === 'glass') || (canvasTheme === 'light');
            const surfColor = isLight ? '#0d9488' : '#38bdf8';
            viewer.addSurface($3Dmol.SurfaceType.VDW, { opacity: 0.22, color: surfColor }, {});
            b.dataset.on = '1';
            b.textContent = 'Hide surface';
        }
        viewer.render();
    }
    function loadLocalFile(input) {
        const f = input.files && input.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = function () { localPdb = { name: f.name, text: String(r.result) }; setMsg('Local structure ' + esc(f.name) + ' will be used for the next 3D view (press Load 3D view).', 'info'); };
        r.readAsText(f);
    }
    function clearLocalFile() { localPdb = null; const i = $('hla3d-file'); if (i) i.value = ''; setMsg('Built-in structures will be used.', 'info'); }

    window.HLA3D = { update: update, show: show, showFirstWithMismatches: showFirstWithMismatches, toggleSpin: toggleSpin, resetView: resetView, toggleLabels: toggleLabels, toggleCanvasTheme: toggleCanvasTheme, toggleSurface: toggleSurface, loadLocalFile: loadLocalFile, clearLocalFile: clearLocalFile, STRUCTURES: STRUCTURES, TEMPLATES: TEMPLATES };
})();
