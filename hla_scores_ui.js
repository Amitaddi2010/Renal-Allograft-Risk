/*
 * hla_scores_ui.js — the "HED · AAMS · EMS3D" tab (pane-scores), on top of hla_scores.js.
 *
 * Replaces the iframe page that loaded hladiv.net and the Kosmoliaptsis Shiny app: every
 * number on this tab is computed here, from hla_scores_data.js and the EMS3D tables.
 */
(function () {
    'use strict';

    const $ = function (id) { return document.getElementById(id); };
    const STORE = 'ramrt-scores-pair';
    const EXAMPLE = {
        recipient: 'A*01:01, A*24:02, B*08:01, B*40:06, C*07:01, C*15:02, DRB1*03:01, DRB1*15:01, DRB3*01:01, DRB5*01:01, DQA1*05:01, DQA1*01:02, DQB1*02:01, DQB1*06:02',
        donor: 'A*02:01, A*11:01, B*35:01, B*52:01, C*04:01, C*12:02, DRB1*04:03, DRB1*15:02, DRB4*01:03, DRB5*01:02, DQA1*03:01, DQA1*01:03, DQB1*03:02, DQB1*06:01'
    };
    const BATCH_EXAMPLE = 'Sample\tHLAI\nPt01\tA3303,A3201,B4501,B4402,C0704,C1601\n' +
        'Pt02\tA0201,A3101,B4403,B4501,C1601,C0501\nPt03\tA6801,A3101,B1301,B3503,C0403,C0401\n';
    const LOCUS_ORDER = ['A', 'B', 'C', 'DRB1', 'DRB3', 'DRB4', 'DRB5', 'DQA1', 'DQB1', 'DPA1', 'DPB1'];

    let last = null;          // last HLAScores.score() result
    let lastHed = null;       // {recipient, donor}
    let lastBatch = null;
    let timer = null;

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function num(v, d) { return v === null || v === undefined ? '&ndash;' : Number(v).toFixed(d); }
    function chip(text, cls, title) {
        return '<span class="hla-chip ' + (cls || '') + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + esc(text) + '</span>';
    }
    function tile(value, label, sub) {
        return '<div class="hla-tile"><div class="hla-tile-value">' + value + '</div><div class="hla-tile-label">' + label +
            '</div>' + (sub ? '<div class="hla-tile-sub hla-na">' + sub + '</div>' : '') + '</div>';
    }
    function ready() { return window.HLAScores && HLAScores.available(); }

    /* ---------------- typing ---------------- */
    function parse(text) {
        const byLocus = {}, tokens = [];
        String(text || '').split(/[,;\s]+/).forEach(function (raw) {
            if (!raw) return;
            const name = HLAScores.normalize(raw);
            const known = name && HLAScores.sequence(name);
            tokens.push({ raw: raw, name: name, ok: !!known });
            if (!known) return;
            const l = name.split('*')[0];
            byLocus[l] = byLocus[l] || [];
            if (byLocus[l].length < 2) byLocus[l].push(name);
        });
        return { byLocus: byLocus, tokens: tokens };
    }

    function renderParsed(id, p) {
        const el = $(id);
        if (!el) return;
        el.innerHTML = p.tokens.map(function (t) {
            if (t.ok) return chip(t.name, 'hla-chip-ok');
            if (t.name) return chip(t.raw, 'hla-chip-err', t.name + ' is not a two-field allele in IPD-IMGT/HLA');
            return chip(t.raw, 'hla-chip-err', 'Not an allele name this tab can read (two fields needed)');
        }).join('');
    }

    function setStatus(kind, html) {
        const el = $('hs-status');
        if (!el) return;
        el.className = 'ux-status ux-status-' + kind;
        el.innerHTML = '<span class="ux-status-dot"></span><div>' + html + '</div>';
    }

    /* ---------------- main calculation ---------------- */
    function schedule() {
        clearTimeout(timer);
        timer = setTimeout(recalculate, 180);
    }

    function recalculate() {
        if (!$('hs-recipient')) return;
        if (!ready()) { setStatus('warn', 'The sequence reference (hla_scores_data.js) did not load.'); return; }
        const rText = $('hs-recipient').value, dText = $('hs-donor').value;
        store(rText, dText);
        const R = parse(rText), D = parse(dText);
        renderParsed('hs-recipient-parsed', R);
        renderParsed('hs-donor-parsed', D);
        renderHed(R.byLocus, D.byLocus);

        const haveR = Object.keys(R.byLocus).length, haveD = Object.keys(D.byLocus).length;
        if (!haveR || !haveD) {
            last = null;
            renderScores(null);
            setStatus('idle', 'Enter typing for both people, or load the example, to see AAMS and EMS3D. HED appears for whoever is typed.');
            return;
        }
        const opts = { swapDQ: $('hs-swap-dq') && $('hs-swap-dq').checked, swapDP: $('hs-swap-dp') && $('hs-swap-dp').checked };
        last = HLAScores.score(R.byLocus, D.byLocus, opts);
        renderScores(last);
        // fetch a distance table only when a molecule of that group is in the library
        const pending = last.molecules.filter(function (m) { return m.ems3d.pending; }).map(function (m) { return m.group; });
        if (pending.length) {
            HLAScores.ensureEms3d(pending, function () {
                last = HLAScores.score(R.byLocus, D.byLocus, opts);
                renderScores(last);
            });
        }
    }

    function renderScores(res) {
        const body = $('hs-mol-body');
        ['hs-csv-btn', 'hs-copy-btn'].forEach(function (id) { if ($(id)) $(id).disabled = !res || !res.molecules.length; });
        if (!res) {
            $('hs-tiles').innerHTML = '';
            body.innerHTML = '<tr><td colspan="7"><span class="hla-na">No donor–recipient pair yet.</span></td></tr>';
            $('hs-locus-body').innerHTML = '';
            $('hs-positions').innerHTML = '';
            $('hs-count-locus').textContent = '0';
            $('hs-count-pos').textContent = '0';
            $('hs-warnings').innerHTML = '';
            renderPairing(null);
            return;
        }
        const S = res.summary;
        const loading = res.molecules.some(function (m) { return m.ems3d.pending; });
        function maxEms(klass) {
            let v = null;
            res.molecules.forEach(function (m) { if (m.klass === klass && m.ems3d.value !== null) v = v === null ? m.ems3d.value : Math.max(v, m.ems3d.value); });
            return v;
        }
        const e1 = maxEms('I'), e2 = maxEms('II');
        const hedR = lastHed && lastHed.recipient && lastHed.recipient.meanClassI;
        $('hs-tiles').innerHTML =
            tile(String(S.all.n), 'Mismatched donor molecules', 'class I ' + S.classI.n + ' · class II ' + S.classII.n) +
            tile(S.classI.aamsScored ? String(S.classI.aams) : '&ndash;', 'AAMS, class I (sum)', 'Foreign amino acids, HLA-A/B/C pooled') +
            tile(S.classII.aamsScored ? String(S.classII.aams) : '&ndash;', 'AAMS, class II (sum)', 'DR pooled; DQ and DP chain by chain') +
            tile(loading ? '&hellip;' : num(e1, 3), 'EMS3D, class I (highest)', loading ? 'loading electrostatic table' : 'Minimum ESD to a recipient class I molecule') +
            tile(loading ? '&hellip;' : num(e2, 3), 'EMS3D, class II (highest)', 'Minimum ESD within the locus') +
            tile(hedR === null || hedR === undefined ? '&ndash;' : hedR.toFixed(2), 'Recipient HED, class I mean', 'As HLAdiv.net &ldquo;Mean_HED&rdquo;');

        if (!res.molecules.length) {
            body.innerHTML = '<tr><td colspan="7"><span class="hla-chip hla-chip-ok">No mismatched donor molecule at the typed loci</span></td></tr>';
        } else {
            body.innerHTML = res.molecules.map(function (m) {
                const notes = [];
                if (m.aams.note) notes.push(m.aams.note);
                if (m.aams.imputedUsed) notes.push(m.aams.imputedUsed + ' AAMS position(s) use filled-in residues');
                if (m.permissive === false) notes.push('non-canonical DQ pairing');
                if (m.ems3d.value === null && m.ems3d.reason && !m.ems3d.pending) notes.push('EMS3D: ' + m.ems3d.reason);
                if (m.ems3d.partial) notes.push('EMS3D over scored recipient molecules only (' + m.ems3d.missing.join(', ') + ' not scored), so the true value may be lower');
                const aams = m.aams.value === null ? '<span class="hla-na">' + esc(m.aams.reason || 'n/a') + '</span>'
                    : String(m.aams.value) + (m.aams.alpha && m.aams.alpha.value !== null && m.aams.beta ? ' <span class="hla-na">(&alpha;' + m.aams.alpha.value + ' + &beta;' + m.aams.beta.value + ')</span>' : '');
                const ems = m.ems3d.pending ? '&hellip;' : (m.ems3d.value === null ? '<span class="hla-na">not scored</span>'
                    : (m.ems3d.partial ? '&le; ' : '') + m.ems3d.value.toFixed(3));
                return '<tr><td>' + m.klass + '</td><td>' + esc(m.locus) + '</td><td><strong>' + esc(m.molecule.replace('~', ' / ')) +
                    '</strong></td><td class="hla-num">' + aams + '</td><td class="hla-num">' + ems + '</td><td>' +
                    (m.ems3d.closest ? esc(m.ems3d.closest.replace('~', ' / ')) : '<span class="hla-na">&ndash;</span>') +
                    '</td><td class="hs-notes">' + (notes.length ? esc(notes.join('; ')) : '<span class="hla-na">&ndash;</span>') + '</td></tr>';
            }).join('');
        }

        const loci = Object.keys(S.byLocus);
        $('hs-count-locus').textContent = String(loci.length);
        $('hs-locus-body').innerHTML = loci.map(function (k) {
            const s = S.byLocus[k];
            return '<tr><td>' + esc(k) + '</td><td class="hla-num">' + s.n + '</td><td class="hla-num">' +
                (s.aamsScored ? s.aamsMax : '&ndash;') + '</td><td class="hla-num">' + (s.aamsScored ? s.aamsSum : '&ndash;') +
                '</td><td class="hla-num">' + (s.emsScored ? s.emsMax.toFixed(3) : '&ndash;') + '</td><td class="hla-num">' +
                (s.emsScored ? s.emsSum.toFixed(3) : '&ndash;') + '</td></tr>';
        }).join('') || '<tr><td colspan="6"><span class="hla-na">No mismatched molecule.</span></td></tr>';

        let nPos = 0;
        $('hs-positions').innerHTML = res.molecules.map(function (m) {
            const parts = [];
            function chain(label, c) {
                if (!c || !c.positions) return;
                nPos += c.positions.length;
                parts.push('<div class="hs-pos-chain"><span class="hla-na">' + esc(label) + '</span> ' +
                    (c.positions.length ? c.positions.map(function (p) {
                        return chip(p.position + ' ' + p.donor, p.imputed ? 'hla-chip-inferred' : 'hla-chip-plain',
                            'Donor ' + p.donor + ' at ' + p.position + '; recipient carries ' + (p.recipient.join('/') || 'a deletion') +
                            (p.imputed ? ' (filled-in residue involved)' : ''));
                    }).join('') : '<span class="hla-na">none</span>') + '</div>');
            }
            if (m.aams.alpha || m.aams.beta) { chain('α ' + (m.chains[0] || ''), m.aams.alpha); chain('β ' + (m.chains[1] || ''), m.aams.beta); }
            else chain(m.molecule, m.aams);
            return '<div class="hs-pos-block"><div class="group-kicker">' + esc(m.molecule.replace('~', ' / ')) + '</div>' + parts.join('') + '</div>';
        }).join('') || '<span class="hla-na">No mismatched molecule.</span>';
        $('hs-count-pos').textContent = String(nPos);

        const warns = res.warnings.slice();
        if (res.unparsed.recipient.length) warns.push('Recipient entries not read: ' + res.unparsed.recipient.join(', '));
        if (res.unparsed.donor.length) warns.push('Donor entries not read: ' + res.unparsed.donor.join(', '));
        $('hs-warnings').innerHTML = warns.map(function (w) { return '<div class="hla-warn hla-warn-warn">' + esc(w) + '</div>'; }).join('');
        renderPairing(res);

        const scoredEms = res.molecules.filter(function (m) { return m.ems3d.value !== null; }).length;
        setStatus('ok',
            res.molecules.length
                ? res.molecules.length + ' mismatched donor molecule(s); AAMS for ' + res.summary.all.aamsScored + ', EMS3D for ' + (loading ? '&hellip;' : scoredEms) + '.'
                : 'The donor carries no molecule the recipient lacks at the typed loci.');
    }

    function renderPairing(res) {
        const el = $('hs-pairing');
        if (!el) return;
        if (!res || !Object.keys(res.pairing).length) { el.innerHTML = ''; return; }
        el.innerHTML = Object.keys(res.pairing).map(function (k) {
            const p = res.pairing[k];
            const show = function (x) { return x.pairs.length ? x.pairs.map(function (q) { return q.join(' / '); }).join(' · ') : 'alpha chain not typed'; };
            return '<div class="hla-warn hla-warn-info"><strong>' + k + ' heterodimers</strong> &mdash; recipient: ' + esc(show(p.recipient)) +
                '; donor: ' + esc(show(p.donor)) + '. ' + esc(p.donor.note || p.recipient.note || '') + '</div>';
        }).join('');
    }

    /* ---------------- HED ---------------- */
    function renderHed(rLoci, dLoci) {
        const hr = HLAScores.hedGenotype(rLoci), hd = HLAScores.hedGenotype(dLoci);
        lastHed = { recipient: hr, donor: hd };
        const rows = ['A', 'B', 'C', 'DRB1', 'DQB1'].map(function (l) {
            const a = hr.perLocus[l], b = hd.perLocus[l];
            if (!a && !b) return '';
            const cell = function (x, typed) {
                if (!x) return '<td><span class="hla-na">not typed</span></td><td class="hla-num">&ndash;</td>';
                const val = x.hed === null ? '<span class="hla-na">' + esc(x.error) + '</span>'
                    : x.hed.toFixed(5) + (x.homozygous ? ' <span class="hla-na">(hmz)</span>' : '') +
                      (x.excluded ? ' <span class="hla-na" title="' + esc(x.note) + '">*</span>' : '');
                return '<td>' + esc((typed || []).join(', ')) + '</td><td class="hla-num">' + val + '</td>';
            };
            return '<tr><td>' + l + (l === 'DRB1' || l === 'DQB1' ? ' <span class="hla-na">(Lenz)</span>' : '') + '</td>' +
                cell(a, rLoci[l]) + cell(b, dLoci[l]) + '</tr>';
        }).join('');
        const mean = '<tr class="hs-mean-row"><td><strong>Class I mean</strong></td><td></td><td class="hla-num"><strong>' +
            (hr.meanClassI === null ? '&ndash;' : hr.meanClassI.toFixed(5)) + '</strong></td><td></td><td class="hla-num"><strong>' +
            (hd.meanClassI === null ? '&ndash;' : hd.meanClassI.toFixed(5)) + '</strong></td></tr>';
        $('hs-hed-body').innerHTML = rows ? rows + mean : '<tr><td colspan="5"><span class="hla-na">Type HLA-A, -B, -C (and optionally DRB1, DQB1) above.</span></td></tr>';
        const notes = hr.notes.concat(hd.notes).filter(function (n, i, a) { return a.indexOf(n) === i; });
        $('hs-hed-notes').innerHTML = notes.map(function (n) { return '<div class="hla-warn hla-warn-info">' + esc(n) + '</div>'; }).join('');
    }

    function pair() {
        const a = $('hs-pair-a').value, b = $('hs-pair-b').value;
        const out = $('hs-pair-out');
        if (!a.trim() || !b.trim()) { out.innerHTML = '<span class="hla-na">Enter two alleles.</span>'; return; }
        const r = HLAScores.hedPair(a, b);
        if (r.hed === null) { out.innerHTML = '<div class="hla-warn hla-warn-warn">' + esc(r.error) + '</div>'; return; }
        out.innerHTML = 'The HED between <strong>' + esc(r.a) + '</strong> and <strong>' + esc(r.b) + '</strong> is <strong class="hs-big">' +
            r.hed.toFixed(5) + '</strong> <span class="hla-na">(Grantham sum ' + r.sum + ' over ' + r.length + ' positions, residues ' +
            r.region[0] + '&ndash;' + r.region[1] + ')</span>' + (r.note ? '<div class="hla-warn hla-warn-info" style="margin-top:6px;">' + esc(r.note) + '</div>' : '');
    }

    function runBatch() {
        const rows = HLAScores.hedBatch($('hs-batch').value);
        lastBatch = rows;
        $('hs-batch-dl').disabled = !rows.length;
        if (!rows.length) { $('hs-batch-out').innerHTML = '<span class="hla-na">No rows.</span>'; return; }
        const bad = rows.filter(function (r) { return r.error; }).length;
        $('hs-batch-out').innerHTML = '<p class="hla-ref-info">' + rows.length + ' sample(s)' + (bad ? ', ' + bad + ' with a problem (see Note)' : '') + '.</p>' +
            '<div class="matrix-container"><table class="table-matrix hla-table"><thead><tr><th>Sample</th><th>Alleles</th><th>HED_A</th><th>HED_B</th><th>HED_C</th><th>Mean_HED</th><th>Note</th></tr></thead><tbody>' +
            rows.slice(0, 500).map(function (r) {
                return '<tr><td>' + esc(r.sample) + '</td><td>' + esc(r.alleles.join(', ')) + '</td><td class="hla-num">' + num(r.HED_A, 5) +
                    '</td><td class="hla-num">' + num(r.HED_B, 5) + '</td><td class="hla-num">' + num(r.HED_C, 5) + '</td><td class="hla-num"><strong>' +
                    num(r.Mean_HED, 5) + '</strong></td><td class="hs-notes">' + esc(r.error) + '</td></tr>';
            }).join('') + '</tbody></table></div>' + (rows.length > 500 ? '<p class="hla-na">Showing the first 500 rows; the download has all.</p>' : '');
    }

    function uploadBatch(input) {
        const f = input.files && input.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = function () { $('hs-batch').value = String(reader.result || ''); runBatch(); input.value = ''; };
        reader.readAsText(f);
    }

    function download(name, text, type) {
        const blob = new Blob([text], { type: type || 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }

    function downloadBatch() {
        if (lastBatch) download('HED_results.tsv', HLAScores.hedBatchTsv(lastBatch), 'text/tab-separated-values');
    }

    /* ---------------- export ---------------- */
    function csvText() {
        if (!last) return '';
        const q = function (v) { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
        const lines = [['record', 'class', 'locus', 'donor_molecule', 'AAMS', 'AAMS_alpha', 'AAMS_beta', 'EMS3D', 'EMS3D_partial', 'closest_recipient_molecule', 'note'].join(',')];
        last.molecules.forEach(function (m) {
            lines.push(['molecule', m.klass, m.locus, m.molecule, m.aams.value,
                m.aams.alpha ? m.aams.alpha.value : '', m.aams.beta ? m.aams.beta.value : '',
                m.ems3d.value === null ? '' : m.ems3d.value.toFixed(3), m.ems3d.partial ? 'yes' : '',
                m.ems3d.closest || '', m.ems3d.value === null ? (m.ems3d.reason || '') : (m.aams.note || '')].map(q).join(','));
        });
        if (lastHed) {
            ['recipient', 'donor'].forEach(function (who) {
                const h = lastHed[who];
                Object.keys(h.perLocus).forEach(function (l) {
                    const x = h.perLocus[l];
                    lines.push(['HED', who, l, x.a + '/' + x.b, '', '', '', '', '', '', x.hed === null ? x.error : x.hed.toFixed(5)].map(q).join(','));
                });
                if (h.meanClassI !== null) lines.push(['HED', who, 'class I mean', '', '', '', '', '', '', '', h.meanClassI.toFixed(5)].map(q).join(','));
            });
        }
        lines.push(['typing', 'recipient', '', $('hs-recipient').value.replace(/\s+/g, ' ')].map(q).join(','));
        lines.push(['typing', 'donor', '', $('hs-donor').value.replace(/\s+/g, ' ')].map(q).join(','));
        return lines.join('\n') + '\n';
    }

    function reportText() {
        if (!last) return '';
        const out = ['HED / AAMS / EMS3D report', 'Recipient: ' + $('hs-recipient').value.replace(/\s+/g, ' '),
                     'Donor: ' + $('hs-donor').value.replace(/\s+/g, ' '), ''];
        out.push('Mismatched donor molecules (AAMS | EMS3D | closest recipient molecule)');
        last.molecules.forEach(function (m) {
            out.push('  ' + m.locus + ' ' + m.molecule + ': ' + (m.aams.value === null ? 'n/a' : m.aams.value) + ' | ' +
                (m.ems3d.value === null ? 'not scored' : (m.ems3d.partial ? '<= ' : '') + m.ems3d.value.toFixed(3)) + ' | ' + (m.ems3d.closest || '-'));
        });
        const S = last.summary;
        out.push('', 'AAMS sum: class I ' + S.classI.aams + ', class II ' + S.classII.aams);
        if (lastHed) {
            out.push('HED class I mean: recipient ' + (lastHed.recipient.meanClassI === null ? '-' : lastHed.recipient.meanClassI.toFixed(5)) +
                     ', donor ' + (lastHed.donor.meanClassI === null ? '-' : lastHed.donor.meanClassI.toFixed(5)));
        }
        out.push('', 'Computed in the RAMRT calculator from IPD-IMGT/HLA ' + window.HLA_SCORES_DATA.meta.imgt +
                 '; EMS3D values marked <= were taken over the scored recipient molecules only.');
        return out.join('\n');
    }

    function downloadCsv() { const t = csvText(); if (t) download('HED_AAMS_EMS3D.csv', t, 'text/csv'); }
    function copyReport() {
        const t = reportText();
        if (!t) return;
        if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { flash('Report copied.'); }, function () { flash('Copy failed.'); });
    }
    function flash(msg) {
        const el = $('hs-flash');
        if (!el) return;
        el.textContent = msg;
        el.classList.add('visible');
        setTimeout(function () { if (el.textContent === msg) el.classList.remove('visible'); }, 2800);
    }

    /* ---------------- inputs ---------------- */
    function store(r, d) {
        try { localStorage.setItem(STORE, JSON.stringify({ recipient: r, donor: d })); } catch (e) { /* storage unavailable */ }
    }
    function restore() {
        try {
            const v = JSON.parse(localStorage.getItem(STORE) || 'null');
            if (v && (v.recipient || v.donor)) { $('hs-recipient').value = v.recipient || ''; $('hs-donor').value = v.donor || ''; return true; }
        } catch (e) { /* storage unavailable */ }
        return false;
    }

    function typingFromEngine(person) {
        const out = [];
        LOCUS_ORDER.forEach(function (l) {
            ((person && person.alleles && person.alleles[l]) || []).forEach(function (a) {
                const name = a.name || a;
                if (out.indexOf(name) === -1) out.push(name);
            });
        });
        return out.join(', ');
    }

    function useEpletPair(silent) {
        const res = window.HLAUI && HLAUI.last && HLAUI.last();
        let r = '', d = '', inferred = false;
        if (res && res.recipient && res.donor) {
            r = typingFromEngine(res.recipient);
            d = typingFromEngine(res.donor);
            inferred = ['recipient', 'donor'].some(function (w) {
                const al = res[w].alleles || {};
                return Object.keys(al).some(function (l) { return (al[l] || []).some(function (a) { return a.inferred; }); });
            });
        }
        if (!r && $('hla-recipient')) r = $('hla-recipient').value;
        if (!d && $('hla-donor')) d = $('hla-donor').value;
        if (!r.trim() && !d.trim()) {
            if (!silent) flash('The HLA & eplets tab has no typing yet.');
            return false;
        }
        $('hs-recipient').value = r;
        $('hs-donor').value = d;
        recalculate();
        if (!silent) flash(inferred ? 'Pair copied, including DRB3/4/5 or DQA1 inferred there from linkage tables.' : 'Pair copied from HLA & eplets.');
        return true;
    }

    function loadExample() { $('hs-recipient').value = EXAMPLE.recipient; $('hs-donor').value = EXAMPLE.donor; recalculate(); }
    function batchExample() { $('hs-batch').value = BATCH_EXAMPLE; runBatch(); }
    function clear() { $('hs-recipient').value = ''; $('hs-donor').value = ''; recalculate(); }

    /** Called when the tab opens: take the eplet pair if this tab is still empty. */
    function onShow() {
        if (!$('hs-recipient')) return;
        if (!$('hs-recipient').value.trim() && !$('hs-donor').value.trim()) {
            if (!useEpletPair(true)) restore();
        }
        recalculate();
    }

    function renderMethods() {
        const el = $('hs-meta');
        if (!el || !ready()) return;
        const M = window.HLA_SCORES_DATA.meta;
        const E = HLAScores.emsMeta();
        let html = 'Sequences: IPD-IMGT/HLA ' + esc(M.imgt) + ' (built ' + esc(M.built) + '). ';
        if (E) {
            const g = E.groups || {};
            html += 'EMS3D library built ' + esc(E.built) + ': ' + Object.keys(g).map(function (k) {
                return esc(k) + ' ' + g[k].molecules + ' molecules';
            }).join(', ') + '; APBS grid ' + E.grid.dime + '&sup3; over ' + E.grid.box + ' &Aring;, skin ' + E.skin.delta + ' &Aring; thick at ' + E.skin.sigma + ' &Aring;.';
        } else {
            html += 'EMS3D library not built in this copy of the app.';
        }
        el.innerHTML = html;
    }

    function init() {
        if (!$('hs-recipient')) return;
        ['hs-recipient', 'hs-donor'].forEach(function (id) { $(id).addEventListener('input', schedule); });
        ['hs-pair-a', 'hs-pair-b'].forEach(function (id) { $(id).addEventListener('input', pair); });
        renderMethods();
        restore();
        recalculate();
    }

    window.HLAScoresUI = {
        recalculate: recalculate, onShow: onShow, useEpletPair: function () { useEpletPair(false); },
        loadExample: loadExample, clear: clear, runBatch: runBatch, uploadBatch: uploadBatch,
        downloadBatch: downloadBatch, batchExample: batchExample, downloadCsv: downloadCsv, copyReport: copyReport,
        last: function () { return last; }, hed: function () { return lastHed; }
    };
    document.addEventListener('DOMContentLoaded', init);
})();
