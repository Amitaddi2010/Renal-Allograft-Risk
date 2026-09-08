/*
 * hla_ui.js — binds the HLA mismatch / eplet engine (hla_engine.js) to the calculator pane.
 * All calculations run in the browser from window.HLA_REF (generated from the HLAMatchmaker v3.1
 * workbooks and IE.xlsx). Results update automatically as typing is entered.
 */
(function () {
    'use strict';
    const $ = function (id) { return document.getElementById(id); };
    let timer = null;
    let lastResult = null;
    let mode = 'paste';

    const EXAMPLE = {
        recipient: 'A*01:01, A*02:01, B*08:01, B*44:02, C*05:01, C*07:01, DRB1*03:01, DRB1*04:01, DQB1*02:01, DQB1*03:02',
        donor: 'A*02:01, A*24:02, B*35:01, B*44:02, C*04:01, C*05:01, DRB1*04:01, DRB1*11:01, DQB1*03:01, DQB1*03:02'
    };
    const LOCUS_ORDER = ['A', 'B', 'C', 'DRB1', 'DRB3', 'DRB4', 'DRB5', 'DQA1', 'DQB1', 'DPA1', 'DPB1'];
    const GRID_ROWS = [
        { key: 'A', label: 'HLA-A', loci: ['A'], ph: '02:01' },
        { key: 'B', label: 'HLA-B', loci: ['B'], ph: '35:01' },
        { key: 'C', label: 'HLA-C', loci: ['C'], ph: '04:01' },
        { key: 'DRB1', label: 'DRB1', loci: ['DRB1'], ph: '15:01' },
        { key: 'DRB345', label: 'DRB3/4/5', loci: ['DRB3', 'DRB4', 'DRB5'], ph: 'DRB3*01:01' },
        { key: 'DQA1', label: 'DQA1', loci: ['DQA1'], ph: '01:02' },
        { key: 'DQB1', label: 'DQB1', loci: ['DQB1'], ph: '06:02' },
        { key: 'DPA1', label: 'DPA1', loci: ['DPA1'], ph: '01:03' },
        { key: 'DPB1', label: 'DPB1', loci: ['DPB1'], ph: '04:01' }
    ];

    function esc(s) {
        return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function num(v) { return (v === null || v === undefined) ? '<span class="hla-na">n/a</span>' : String(v); }

    /* ------------------------------------------------------------------ */
    function init() {
        if (!$('hla-recipient')) return;
        if (!window.HLA_REF || !window.HLAEngine) {
            setStatus('err', 'The reference database (hla_reference_data.js) or the engine (hla_engine.js) did not load.');
            return;
        }
        HLAEngine.setReference(window.HLA_REF);
        buildGrid();
        buildDatalists();
        const m = window.HLA_REF.meta;
        const ie = window.HLA_REF.ie;
        const ieI = Object.keys(ie.mapI).filter(function (k) { return ie.mapI[k]; }).length;
        const ieII = Object.keys(ie.mapII).filter(function (k) { return ie.mapII[k]; }).length;
        $('hla-ref-info').innerHTML =
            '<strong>Reference database:</strong> ' + esc(m.sources.join('; ')) +
            '. Built ' + esc(m.built.replace('T', ' ')) +
            '. Class I alleles ' + m.classI_alleles + ', class II β alleles ' + m.classII_beta_alleles + ', class II α alleles ' + m.classII_alpha_alleles +
            '. IE catalogue: ' + ieI + ' of ' + ie.classI.length + ' class I and ' + ieII + ' of ' + ie.classII.length + ' class II names exist in the v3.1 tables' +
            (window.HLA_VALIDATION && window.HLA_VALIDATION.nodeRun ? '. Offline test run ' + esc(window.HLA_VALIDATION.nodeRun.date.slice(0, 10)) + ': ' + window.HLA_VALIDATION.nodeRun.pass + ' passed, ' + window.HLA_VALIDATION.nodeRun.fail + ' failed.' : '.');
        ['hla-recipient', 'hla-donor'].forEach(function (id) { $(id).addEventListener('input', schedule); });
        ['hla-infer', 'hla-pop', 'hla-rule'].forEach(function (id) { $(id).addEventListener('change', recalculate); });
        recalculate();
    }

    function schedule() { clearTimeout(timer); timer = setTimeout(recalculate, 180); }

    function options() {
        return { inferLinked: $('hla-infer').checked, population: $('hla-pop').value, alleleRule: $('hla-rule').value };
    }

    function recalculate() {
        if (!$('hla-recipient')) return;
        try {
            lastResult = HLAEngine.analyze($('hla-recipient').value, $('hla-donor').value, options());
            render(lastResult);
        } catch (e) {
            setStatus('err', 'Engine error: ' + e.message);
        }
    }

    /* ---------------- by-locus grid ---------------- */
    function buildGrid() {
        const body = $('hla-gridbody');
        if (!body) return;
        body.innerHTML = GRID_ROWS.map(function (r) {
            const cell = function (side, n) {
                const listId = 'hla-dl-' + r.key;
                return '<td class="' + (side === 'd' && n === 1 ? 'hla-gd' : '') + '"><input type="text" class="control-input hla-gi" id="hla-g-' + side + '-' + r.key + '-' + n + '" data-side="' + side + '" data-row="' + r.key + '" list="' + listId + '" placeholder="' + esc(r.ph) + '" autocomplete="off" spellcheck="false" aria-label="' + (side === 'r' ? 'Recipient ' : 'Donor ') + r.label + ' allele ' + n + '"></td>';
            };
            return '<tr><td class="hla-gl">' + r.label + '</td>' + cell('r', 1) + cell('r', 2) + cell('d', 1) + cell('d', 2) + '</tr>';
        }).join('');
        body.querySelectorAll('input').forEach(function (inp) { inp.addEventListener('input', onGridInput); inp.addEventListener('change', onGridInput); });
    }

    function buildDatalists() {
        if ($('hla-dl-A')) return;
        const groups = window.HLA_REF;
        const byLocus = {};
        ['classI', 'classIIB', 'classIIA'].forEach(function (k) {
            Object.keys(groups[k].alleles).forEach(function (a) { const l = a.split('*')[0]; (byLocus[l] = byLocus[l] || []).push(a); });
        });
        Object.keys(byLocus).forEach(function (l) { byLocus[l].sort(); });
        const frag = document.createDocumentFragment();
        GRID_ROWS.forEach(function (r) {
            const dl = document.createElement('datalist');
            dl.id = 'hla-dl-' + r.key;
            const items = [];
            r.loci.forEach(function (l) { (byLocus[l] || []).forEach(function (a) { items.push(a); }); });
            dl.innerHTML = items.map(function (a) { return '<option value="' + a + '"></option>'; }).join('');
            frag.appendChild(dl);
        });
        document.body.appendChild(frag);
    }

    function composeFromGrid(side) {
        const parts = [];
        GRID_ROWS.forEach(function (r) {
            [1, 2].forEach(function (n) {
                const el = $('hla-g-' + side + '-' + r.key + '-' + n);
                if (!el) return;
                let v = el.value.trim();
                el.classList.remove('hla-gi-bad', 'hla-gi-warn');
                if (!v) return;
                if (v.indexOf('*') === -1 && r.loci.length === 1) v = r.loci[0] + '*' + v;
                const t = HLAEngine.parseToken(v);
                if (t.status === 'invalid' || t.status === 'lowres') el.classList.add('hla-gi-bad');
                else if (t.status === 'unsupported') el.classList.add('hla-gi-warn');
                parts.push(v);
            });
        });
        return parts.join(', ');
    }

    function onGridInput() {
        $('hla-recipient').value = composeFromGrid('r');
        $('hla-donor').value = composeFromGrid('d');
        schedule();
    }

    function fillGridFromText() {
        ['r', 'd'].forEach(function (side) {
            const parsed = HLAEngine.parseTyping($(side === 'r' ? 'hla-recipient' : 'hla-donor').value);
            GRID_ROWS.forEach(function (r) {
                const names = [];
                r.loci.forEach(function (l) { (parsed.alleles[l] || []).forEach(function (a) { names.push(a.name); }); });
                [1, 2].forEach(function (n) {
                    const el = $('hla-g-' + side + '-' + r.key + '-' + n);
                    if (!el) return;
                    const v = names[n - 1] || '';
                    el.value = (v && r.loci.length === 1) ? v.split('*')[1] : v;
                });
            });
        });
    }

    function setMode(m) {
        mode = m;
        if (m === 'grid') fillGridFromText();
        $('hla-mode-paste').hidden = (m === 'grid');
        $('hla-mode-grid').hidden = (m !== 'grid');
        $('hla-mode-paste-btn').classList.toggle('active', m === 'paste');
        $('hla-mode-grid-btn').classList.toggle('active', m === 'grid');
        if (m === 'grid') composeFromGrid('r'), composeFromGrid('d');
    }

    /* ---------------- rendering helpers ---------------- */
    function chip(text, cls, title) {
        return '<span class="hla-chip ' + cls + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + esc(text) + '</span>';
    }
    function setStatus(kind, html) {
        const el = $('hla-status');
        if (!el) return;
        el.className = 'ux-status ux-status-' + kind;
        el.innerHTML = '<span class="ux-status-dot"></span><div>' + html + '</div>';
    }
    function setCount(id, n) { const el = $(id); if (el) el.textContent = String(n); }

    function renderTyping(parsed, containerId) {
        const el = $(containerId);
        const parts = [];
        LOCUS_ORDER.forEach(function (locus) {
            const list = parsed.alleles[locus];
            if (!list) return;
            const chips = list.map(function (a) {
                if (a.inferred) return chip(a.name + ' (inferred)', 'hla-chip-inferred', 'Filled in from the workbook linkage table');
                if (!a.inDb) return chip(a.name, 'hla-chip-warn', 'Not in the HLAMatchmaker 3.1 tables');
                return chip(a.name + (a.homozygous ? ' ×2' : ''), 'hla-chip-ok');
            }).join('');
            parts.push('<span class="hla-locus-row"><span class="hla-locus-label">' + locus + '</span>' + chips + '</span>');
        });
        parsed.tokens.forEach(function (t) {
            if (t.status === 'lowres' || t.status === 'invalid' || t.status === 'excess' || t.status === 'null')
                parts.push('<span class="hla-locus-row"><span class="hla-locus-label">' + esc(t.locus || '?') + '</span>' + chip(t.raw, 'hla-chip-err', t.message) + '</span>');
        });
        el.innerHTML = parts.length ? parts.join('') : '<span class="hla-na">Nothing recognised yet</span>';
    }

    function headTile(value, label, sub, cls) {
        return '<div class="hla-head ' + (cls || '') + '"><div class="hla-head-value">' + value + '</div><div class="hla-head-label">' + esc(label) + '</div><div class="hla-head-sub">' + sub + '</div></div>';
    }
    function smallTile(value, label) {
        return '<div class="hla-tile"><div class="hla-tile-value">' + value + '</div><div class="hla-tile-label">' + esc(label) + '</div></div>';
    }
    function epletChips(list) {
        const out = list.map(function (e) {
            const cls = e.ie ? 'hla-chip-ie' : (e.abver ? 'hla-chip-abv' : 'hla-chip-plain');
            const title = e.categoryLabel + (e.ie ? ' · in the IE.xlsx immunogenic catalogue' : '') + (e.donorAlleles ? ' · donor ' + e.donorAlleles.join(', ') : '');
            return chip(e.name + (e.ie ? ' ★' : (e.abver ? ' ✓' : '')), cls, title);
        });
        return out.length ? out.join('') : '<span class="hla-na">none</span>';
    }

    /* ---------------- main render ---------------- */
    function render(res) {
        renderTyping(res.recipient, 'hla-recipient-parsed');
        renderTyping(res.donor, 'hla-donor-parsed');

        // status + notes
        const errs = res.warnings.filter(function (w) { return w.level === 'error'; });
        const warns = res.warnings.filter(function (w) { return w.level === 'warn'; });
        const infos = res.warnings.filter(function (w) { return w.level === 'info'; });
        const typedR = Object.keys(res.recipient.alleles).length, typedD = Object.keys(res.donor.alleles).length;
        const A = res.allele, E = res.eplet;
        if (!typedR && !typedD) setStatus('idle', 'Enter typing for both people, or load the example, to see results.');
        else if (!typedR || !typedD) setStatus('warn', 'Typing entered for the ' + (typedR ? 'recipient' : 'donor') + ' only. Add the ' + (typedR ? 'donor' : 'recipient') + ' to compare.');
        else if (errs.length) setStatus('err', errs.length + ' entr' + (errs.length === 1 ? 'y needs' : 'ies need') + ' attention: ' + esc(errs[0].message) + (errs.length > 1 ? ' (see the notes below)' : ''));
        else if (warns.length) setStatus('warn', 'Results ready for ' + A.evaluated.length + ' loci. ' + warns.length + ' warning' + (warns.length > 1 ? 's' : '') + ': ' + esc(warns[0].message) + (warns.length > 1 ? ' (see the notes below)' : ''));
        else setStatus('ok', 'Results ready: ' + A.evaluated.join(', ') + ' compared on both sides' + (infos.length ? ' · ' + infos.length + ' note' + (infos.length > 1 ? 's' : '') + ' on inferred alleles and assumptions below' : '') + '.');
        const order = { error: 0, warn: 1, info: 2 };
        const ws = res.warnings.slice().sort(function (a, b) { return order[a.level] - order[b.level]; });
        $('hla-warnings').innerHTML = ws.length
            ? ws.map(function (w) { return '<div class="hla-warn hla-warn-' + w.level + '">' + esc(w.message) + '</div>'; }).join('')
            : '<div class="hla-warn hla-warn-ok">All entered alleles were recognised; nothing to note.</div>';
        setCount('hla-notes-count', ws.length);
        const notes = $('hla-notes');
        if (notes) notes.open = errs.length > 0 || warns.length > 0;
        $('hla-opt-summary').textContent = (res.options.inferLinked ? 'inference on (' + res.options.population + ')' : 'inference off') + ' · ' + (res.options.alleleRule === 'haplotype' ? 'haplotype counting' : 'distinct-allele counting');

        // headline
        const abdrA = A.totalABDRAntigen, abdr = A.totalABDR;
        $('hla-headline').innerHTML = [
            headTile(abdrA === null ? num(null) : abdrA + '<small> / 6</small>', 'HLA antigen mismatches (A + B + DR)', abdrA === null ? 'Type A, B and DRB1 for both people to get this count.' : 'Counted at the first field, as in the risk model.' + (abdr !== null && abdr !== abdrA ? ' At the allele level it is ' + abdr + '.' : '')),
            headTile(E.overall.evaluated ? String(E.overall.total) : num(null), 'Mismatched eplets', E.overall.evaluated ? 'Class I ' + (E.classI.evaluated ? E.classI.total : '–') + ' · class II ' + (E.classII.evaluated ? E.classII.total : '–') + '. Donor eplets absent from every recipient molecule of the class.' : 'Needs two-field alleles listed in the HLAMatchmaker tables on both sides.'),
            headTile(E.overall.evaluated ? String(E.overall.ie) : num(null), 'Immunogenic eplets (IE catalogue)', E.overall.evaluated ? 'Of the mismatched eplets, ' + E.overall.ie + ' are in the PGIMER IE.xlsx catalogue and ' + E.overall.abver + ' are antibody-verified in HLAMatchmaker.' : 'Shown once eplets can be compared.', 'hla-head-ie')
        ].join('');
        $('hla-tiles-sm').innerHTML = [
            smallTile(abdr === null ? num(null) : abdr + ' / 6', 'Allele-level mismatches (A + B + DR)'),
            smallTile(A.totalABDRDQ === null ? num(null) : A.totalABDRDQAntigen + ' / ' + A.totalABDRDQ, 'A + B + DR + DQ, antigen / allele level'),
            smallTile(A.evaluated.length ? A.totalAllAntigen + ' / ' + A.totalAll : num(null), 'All compared loci, antigen / allele level'),
            smallTile(E.overall.evaluated ? String(E.overall.nonIE) : num(null), 'Non-immunogenic mismatched eplets'),
            smallTile(E.overall.evaluated ? String(E.overall.abver) : num(null), 'Antibody-verified mismatched eplets'),
            smallTile(A.evaluated.length ? String(A.evaluated.length) : num(null), 'Loci compared on both sides')
        ].join('');

        // glance rows
        const glance = [];
        const epletByLocus = {};
        ['classI', 'classIIB', 'classIIA'].forEach(function (k) {
            const c = E[k];
            if (!c.evaluated) return;
            c.donorAlleles.forEach(function (d) { if (!epletByLocus[d.locus]) epletByLocus[d.locus] = { locus: d.locus, total: 0, abver: 0, ie: 0 }; });
            Object.keys(c.byLocus).forEach(function (l) { epletByLocus[l] = c.byLocus[l]; });
        });
        let maxE = 1;
        Object.keys(epletByLocus).forEach(function (l) { maxE = Math.max(maxE, epletByLocus[l].total); });
        const lociAll = LOCUS_ORDER.filter(function (l) { return A.perLocus[l] || epletByLocus[l]; });
        if (lociAll.length) {
            glance.push('<div class="hla-glance-row hla-glance-head"><div>Locus</div><div>Antigen MM</div><div>Mismatched eplets (pink = immunogenic)</div><div class="hla-glance-text">eplets · immunogenic</div></div>');
            lociAll.forEach(function (l) {
                const p = A.perLocus[l], ep = epletByLocus[l];
                const dots = p ? '<span class="hla-dots" title="' + p.countAntigen + ' antigen-level mismatch(es) at ' + l + '"><span class="hla-dot' + (p.countAntigen >= 1 ? ' on' : '') + '"></span><span class="hla-dot' + (p.countAntigen >= 2 ? ' on' : '') + '"></span></span>' : '<span class="hla-na">–</span>';
                const bar = ep ? '<div class="hla-bar" title="' + ep.total + ' mismatched eplets, ' + ep.ie + ' immunogenic"><div class="hla-bar-fill" style="width:' + Math.round(ep.total / maxE * 100) + '%"></div><div class="hla-bar-ie" style="width:' + Math.round(ep.ie / maxE * 100) + '%"></div></div>' : '<span class="hla-na">not evaluated</span>';
                const txt = ep ? ep.total + ' · ' + ep.ie : (p ? 'allele MM ' + p.countUnique : '');
                glance.push('<div class="hla-glance-row"><div class="hla-glance-locus">' + l + (p && p.inferred ? '<span class="hla-na"> inf.</span>' : '') + '</div><div>' + dots + '</div><div>' + bar + '</div><div class="hla-glance-text">' + txt + '</div></div>');
            });
        }
        $('hla-glance').innerHTML = glance.length ? glance.join('') : '<span class="hla-na">Nothing to compare yet.</span>';

        // explanation
        $('hla-explain').innerHTML = '<strong>What these numbers mean</strong><ul>' +
            '<li><strong>Antigen mismatches</strong> count donor antigen groups (first field) the recipient lacks: 0–2 per locus, 0–6 for A+B+DR. This is the count used by the risk calculator and in the thesis registers.</li>' +
            '<li><strong>Mismatched eplets</strong> are small surface patches on the donor\'s HLA that the recipient does not have on any molecule of the same class; more of them means more possible antibody targets.</li>' +
            '<li><strong>Immunogenic eplets</strong> are the mismatched eplets found in the PGIMER reference catalogue; the others make up the non-immunogenic load.</li></ul>' +
            '<button type="button" class="ux-link-btn" style="margin-left:0;margin-top:6px;" onclick="UX.openGlossary()">Open the glossary</button>';

        // allele table
        const rows = A.evaluated.map(function (l) {
            const p = A.perLocus[l];
            const mmCell = '<span class="hla-mm-big">' + p.countAntigen + '</span> <span class="hla-na">antigen</span><br>' +
                '<span class="hla-na">' + p.count + ' allele' + (p.countHaplotype !== p.countUnique ? ' (' + p.countHaplotype + ' by haplotype)' : '') +
                (p.countAntigen !== p.countUnique ? '<br>same antigen group, different allele' : '') + '</span>';
            const lacks = p.mismatched.length ? p.mismatched.map(function (a) { return chip(a, 'hla-chip-err'); }).join('') : chip('all matched', 'hla-chip-ok');
            return '<div class="hla-arow">' +
                '<div class="hla-arow-locus"><strong>' + l + '</strong>' + (p.inferred ? '<span class="hla-chip hla-chip-inferred">inferred</span>' : '') + '</div>' +
                '<div class="hla-arow-body">' +
                    '<div><span class="hla-na">Donor</span> ' + esc(p.donor.join(' / ')) + '</div>' +
                    '<div><span class="hla-na">Recipient</span> ' + esc(p.recipient.join(' / ')) + '</div>' +
                    '<div class="hla-arow-lacks"><span class="hla-na">Recipient lacks</span> ' + lacks +
                        (p.correspondingRecipient.length ? '<span class="hla-na hla-recip-only">recipient only: ' + esc(p.correspondingRecipient.join(', ')) + '</span>' : '') + '</div>' +
                '</div>' +
                '<div class="hla-arow-mm">' + mmCell + '</div></div>';
        });
        $('hla-allele-list').innerHTML = rows.length ? rows.join('') : '<div class="hla-na">Enter the same locus for recipient and donor to compare alleles.</div>';
        setCount('hla-count-allele', rows.length + (rows.length === 1 ? ' locus' : ' loci'));

        // eplet by donor allele
        const erows = [];
        let donorAllelesEvaluated = 0;
        ['classI', 'classIIB', 'classIIA'].forEach(function (k) {
            const c = E[k];
            if (!c.evaluated) return;
            c.donorAlleles.forEach(function (d) {
                donorAllelesEvaluated++;
                erows.push('<tr><td>' + esc(k === 'classI' ? 'I' : (k === 'classIIB' ? 'II β' : 'II α')) + '</td>' +
                    '<td><strong>' + esc(d.allele) + '</strong>' + (d.inferred ? ' <span class="hla-chip hla-chip-inferred">inferred</span>' : '') + '<div class="hla-na">' + d.epletCount + ' eplets on allele</div></td>' +
                    '<td>' + epletChips(d.mismatched) + '</td>' +
                    '<td class="hla-num">' + d.count + '</td><td class="hla-num">' + d.abver + '</td><td class="hla-num">' + d.ie + '</td></tr>');
            });
        });
        $('hla-eplet-table').innerHTML = erows.length ? erows.join('') : '<tr><td colspan="6" class="hla-na">No eplet comparison yet (needs two-field alleles listed in the HLAMatchmaker tables on both sides).</td></tr>';
        setCount('hla-count-eplet', E.overall.evaluated ? E.overall.total + ' eplets · ' + donorAllelesEvaluated + ' donor alleles' : '0');

        // locus-wise loads
        const lrows = [];
        ['classI', 'classIIB', 'classIIA'].forEach(function (k) {
            const c = E[k];
            if (!c.evaluated) return;
            LOCUS_ORDER.forEach(function (l) {
                const L = c.byLocus[l];
                if (!L) return;
                lrows.push('<tr><td><strong>' + l + '</strong></td><td class="hla-num">' + L.total + '</td><td class="hla-num">' + L.ie + '</td><td class="hla-num">' + (L.total - L.ie) + '</td><td class="hla-num">' + L.abver + '</td></tr>');
            });
        });
        if (E.overall.evaluated) {
            const tr = function (label, c) { return '<tr class="hla-total-row"><td><strong>' + label + '</strong></td><td class="hla-num">' + (c.evaluated ? c.total : '–') + '</td><td class="hla-num">' + (c.evaluated ? c.ie : '–') + '</td><td class="hla-num">' + (c.evaluated ? c.nonIE : '–') + '</td><td class="hla-num">' + (c.evaluated ? c.abver : '–') + '</td></tr>'; };
            lrows.push(tr('Class I (unique)', E.classI));
            lrows.push(tr('Class II (unique)', E.classII));
            lrows.push('<tr class="hla-total-row hla-grand"><td><strong>Total</strong></td><td class="hla-num">' + E.overall.total + '</td><td class="hla-num">' + E.overall.ie + '</td><td class="hla-num">' + E.overall.nonIE + '</td><td class="hla-num">' + E.overall.abver + '</td></tr>');
        }
        $('hla-locus-table').innerHTML = lrows.length ? lrows.join('') : '<tr><td colspan="5" class="hla-na">–</td></tr>';

        // immunogenic list & categories
        $('hla-ie-list').innerHTML = res.immunogenic.length
            ? res.immunogenic.map(function (e) { return chip(e.name, 'hla-chip-ie', e.classLabel + ' · ' + e.categoryLabel + ' · donor ' + e.donorAlleles.join(', ')); }).join('')
            : '<span class="hla-na">' + (E.overall.evaluated ? 'None of the mismatched eplets is listed in the IE.xlsx catalogue.' : 'n/a') + '</span>';
        setCount('hla-count-ie', res.immunogenic.length);
        const cats = [];
        ['classI', 'classIIB', 'classIIA'].forEach(function (k) {
            const c = E[k];
            if (!c.evaluated) return;
            Object.keys(c.byCategory).forEach(function (cat) { cats.push(chip((HLAEngine.CATEGORY_LABEL[cat] || cat) + ': ' + c.byCategory[cat], 'hla-chip-plain')); });
        });
        $('hla-cat-list').innerHTML = cats.length ? cats.join('') : '<span class="hla-na">n/a</span>';

        $('hla-result-id').textContent = res.evaluable ? 'Result ID ' + res.signature + ' — identical inputs and options always reproduce this result.' : 'Waiting for input.';
        $('hla-send-btn').disabled = !(A.evaluated.length);
        if (window.HLA3D) HLA3D.update(res);
    }

    /* ---------------- actions ---------------- */
    function loadExample() {
        $('hla-recipient').value = EXAMPLE.recipient;
        $('hla-donor').value = EXAMPLE.donor;
        if (mode === 'grid') fillGridFromText();
        recalculate();
    }
    function clearAll() {
        $('hla-recipient').value = '';
        $('hla-donor').value = '';
        if (mode === 'grid') fillGridFromText();
        recalculate();
    }
    function copyReport() {
        if (!lastResult) return;
        const text = HLAEngine.formatReport(lastResult);
        const done = function () { flash('Report copied to the clipboard'); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
        else { fallbackCopy(text); done(); }
    }
    function fallbackCopy(text) {
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); } catch (e) { /* ignore */ }
        document.body.removeChild(ta);
    }
    function downloadCsv() {
        if (!lastResult) return;
        const r = lastResult, A = r.allele, E = r.eplet;
        const q = function (v) { return '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"'; };
        const lines = [['section', 'locus_or_class', 'donor', 'recipient', 'item', 'value_1', 'value_2', 'value_3'].map(q).join(',')];
        lines.push(['meta', '', '', '', 'result_id', r.signature, r.reference.built, r.reference.sources.join(' | ')].map(q).join(','));
        A.evaluated.forEach(function (l) {
            const p = A.perLocus[l];
            lines.push(['allele_mismatch', l, p.donor.join('/'), p.recipient.join('/'), 'mismatched_donor_alleles=' + p.mismatched.join('/'), 'allele_MM=' + p.count, 'antigen_MM=' + p.countAntigen, p.inferred ? 'inferred_allele_involved' : ''].map(q).join(','));
        });
        lines.push(['allele_mismatch_totals', 'A+B+DRB1', '', '', 'antigen=' + A.totalABDRAntigen, 'allele=' + A.totalABDR, 'A+B+DRB1+DQB1 antigen=' + A.totalABDRDQAntigen, 'A+B+DRB1+DQB1 allele=' + A.totalABDRDQ].map(q).join(','));
        ['classI', 'classIIB', 'classIIA'].forEach(function (k) {
            const c = E[k];
            if (!c.evaluated) return;
            c.donorAlleles.forEach(function (d) {
                lines.push(['eplet_mismatch', c.classLabel, d.allele, c.recipientAlleles.join('/'), d.mismatched.map(function (e) { return e.name + (e.ie ? '*' : ''); }).join(' '), 'total=' + d.count, 'abver=' + d.abver, 'immunogenic=' + d.ie].map(q).join(','));
            });
        });
        lines.push(['eplet_totals', 'overall', '', '', 'total=' + E.overall.total, 'immunogenic=' + E.overall.ie, 'non_immunogenic=' + E.overall.nonIE, 'abver=' + E.overall.abver].map(q).join(','));
        lines.push(['immunogenic_eplets', '', '', '', r.immunogenic.map(function (e) { return e.name; }).join(' '), '', '', ''].map(q).join(','));
        r.warnings.forEach(function (w) { lines.push(['note', '', '', '', w.level, w.message, '', ''].map(q).join(',')); });
        const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ramrt_hla_mismatch_' + r.signature + '.csv';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
        flash('CSV file downloaded');
    }
    function flash(msg) {
        const el = $('hla-flash');
        if (!el) return;
        el.textContent = msg; el.classList.add('visible');
        setTimeout(function () { el.classList.remove('visible'); }, 2600);
    }

    function sendToNomogram() {
        if (!lastResult) return;
        const A = lastResult.allele;
        // the nomogram was trained on the thesis registers, which count mismatches at the antigen (first-field) level
        const set = function (id, locus) {
            const el = $(id);
            if (!el || !A.perLocus[locus]) return false;
            el.value = String(Math.min(2, A.perLocus[locus].countAntigen));
            return true;
        };
        const done = [set('mm-a', 'A'), set('mm-b', 'B'), set('mm-drb1', 'DRB1'), set('mm-dqb1', 'DQB1')].filter(Boolean).length;
        if (lastResult.eplet.classI.evaluated && $('eplet-class1')) $('eplet-class1').value = lastResult.eplet.classI.total;
        if (lastResult.eplet.classII.evaluated && $('eplet-class2')) $('eplet-class2').value = lastResult.eplet.classII.total;
        if (typeof updateTotalMM === 'function') updateTotalMM();
        if (typeof updateTotalEplets === 'function') updateTotalEplets();
        if (typeof switchCalculatorTab === 'function') switchCalculatorTab('nomogram');
        const note = $('nomogram-fill-note');
        if (note) { note.innerHTML = '<span class="ux-status-dot"></span><div>HLA values filled from the typing analysis (result ID ' + esc(lastResult.signature) + '): ' + done + ' antigen-level mismatch counts and the class I / II eplet loads.</div>'; note.hidden = false; }
        saveRecent(true);
        flash(done + ' antigen-level mismatch value(s) sent to the risk calculator');
    }

    /* ---------------- recent analyses (dashboard home) ---------------- */
    function saveRecent(silent) {
        if (!lastResult || !lastResult.evaluable || !window.DashboardHome) { if (!silent) flash('Nothing to save yet: enter typing for both people first'); return; }
        const r = lastResult;
        DashboardHome.addHla({
            id: r.signature, ts: Date.now(),
            recipient: $('hla-recipient').value, donor: $('hla-donor').value, options: r.options,
            summary: { antigenABDR: r.allele.totalABDRAntigen, eplets: r.eplet.overall.evaluated ? r.eplet.overall.total : null, immunogenic: r.eplet.overall.evaluated ? r.eplet.overall.ie : null }
        });
        if (!silent) flash('Saved to recent analyses (result ID ' + r.signature + ')');
    }
    function restore(entry) {
        $('hla-recipient').value = entry.recipient || '';
        $('hla-donor').value = entry.donor || '';
        if (entry.options) {
            if ($('hla-infer')) $('hla-infer').checked = !!entry.options.inferLinked;
            if ($('hla-pop') && entry.options.population) $('hla-pop').value = entry.options.population;
            if ($('hla-rule') && entry.options.alleleRule) $('hla-rule').value = entry.options.alleleRule;
        }
        if (mode === 'grid') fillGridFromText();
        recalculate();
    }

    function runSelfTest() {
        const el = $('hla-selftest');
        if (!window.HLA_VALIDATION) { el.innerHTML = '<div class="hla-warn hla-warn-error">Validation vectors (hla_validation_vectors.js) not loaded.</div>'; return; }
        const st = HLAEngine.selfTest(window.HLA_VALIDATION.vectors);
        const rows = st.results.map(function (r) {
            return '<tr class="' + (r.ok ? 'hla-pass' : 'hla-fail') + '"><td>' + (r.ok ? 'PASS' : 'FAIL') + '</td><td>' + esc(r.test) + '</td><td>' + esc(r.detail) + '</td></tr>';
        }).join('');
        el.innerHTML = '<details class="ux-details" open><summary>Self-test results <span class="ux-count">' + st.pass + ' passed · ' + st.fail + ' failed</span></summary><div class="ux-details-body">' +
            '<div class="hla-selftest-summary ' + (st.fail ? 'hla-fail' : 'hla-pass') + '">' + st.results.length + ' checks: per-allele eplet counts against the workbooks, antigen-level mismatch against thesis records, and repeat-run reproducibility.</div>' +
            '<div class="matrix-container"><table class="table-matrix hla-table"><thead><tr><th>Result</th><th>Check</th><th>Detail</th></tr></thead><tbody>' + rows + '</tbody></table></div></div></details>';
    }

    window.HLAUI = { init: init, recalculate: recalculate, setMode: setMode, loadExample: loadExample, clearAll: clearAll, copyReport: copyReport, downloadCsv: downloadCsv, sendToNomogram: sendToNomogram, runSelfTest: runSelfTest, saveRecent: function () { saveRecent(false); }, restore: restore, last: function () { return lastResult; } };
    document.addEventListener('DOMContentLoaded', init);
})();
