/*
 * ux.js — usability layer shared by both calculator tabs:
 *   - plain-language glossary (floating Help button)
 *   - background-motion toggle (respects prefers-reduced-motion, remembered per browser)
 *   - risk band gauge under the nomogram result
 */
(function () {
    'use strict';
    const $ = function (id) { return document.getElementById(id); };

    const GLOSSARY = [
        ['Allele (two-field)', 'An HLA variant named to two fields, for example A*02:01. Alleles that share the first field (A*02:01 and A*02:06) belong to the same antigen group.'],
        ['Antigen-level mismatch', 'The number of donor antigen groups (first field, e.g. A*02) that the recipient does not have: 0, 1 or 2 per locus. The PGIMER registers and the risk model count mismatches this way.'],
        ['Allele-level mismatch', 'The number of distinct donor alleles (two fields) that the recipient does not carry. It is always at least the antigen-level count.'],
        ['Eplet', 'A small patch of amino acids on the surface of an HLA molecule that an antibody can bind. HLAMatchmaker describes every allele as a set of eplets.'],
        ['Eplet (molecular) mismatch load', 'The number of different donor eplets that are absent from all of the recipient\'s HLA molecules of the same class. More mismatched eplets means more potential antibody targets.'],
        ['Immunogenic eplet', 'A mismatched eplet that appears in the PGIMER reference catalogue (IE.xlsx). The immunogenic load counts only these; the rest is the non-immunogenic load.'],
        ['Antibody-verified eplet', 'An eplet for which the HLAMatchmaker workbook records antibody-reactivity evidence. Shown separately from the IE catalogue so both views are available.'],
        ['ElliPro high / low', 'HLAMatchmaker\'s estimate of how exposed a non-verified class I eplet is on the molecule surface.'],
        ['Interlocus eplet', 'A class II eplet shared between DR, DQ and DP molecules. A donor interlocus eplet counts as matched when the recipient carries it on any class II molecule.'],
        ['Linkage inference', 'DRB3/4/5 and DQA1 are often not typed. When switched on, the calculator fills them in from the association tables in the HLAMatchmaker workbook, based on DRB1 and DQB1, and labels them "inferred". Type the real alleles to override.'],
        ['Flow crossmatch channel shift', 'How strongly recipient serum binds donor T or B cells in the flow cytometry crossmatch, in median channel shift units. Higher values mean more donor-reactive antibody.'],
        ['Risk band (quintile)', 'The 443 study patients were split into five equal groups by predicted risk. Each band shows how many patients in that group actually had a biopsy-proven rejection.'],
        ['Result ID', 'A code computed from the entered typing and options. The same inputs always give the same ID and the same results, so a result can be checked later.']
    ];

    function storedMotionOff() { try { return localStorage.getItem('ramrt-motion') === 'off'; } catch (e) { return false; } }
    function systemReduced() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    window.__ramrtStopAnim = storedMotionOff() || systemReduced();
    if (window.__ramrtStopAnim && document.body) document.body.classList.add('motion-off');

    function setMotion(on) {
        try { localStorage.setItem('ramrt-motion', on ? 'on' : 'off'); } catch (e) { /* ignore */ }
        window.__ramrtStopAnim = !on;
        document.body.classList.toggle('motion-off', !on);
        updateMotionBtn();
        if (typeof window.refreshDnaScenes === 'function') window.refreshDnaScenes();
    }
    function updateMotionBtn() {
        const b = $('ux-motion-btn');
        if (b) b.textContent = window.__ramrtStopAnim ? '▶ Turn background motion on' : '⏸ Turn background motion off';
    }

    /* ---- theme: "abyss" (dark teal terminal, default) or "glass" (light frosted look) ---- */
    function themeLink() { return $('theme-glass'); }
    function currentTheme() { const l = themeLink(); return (l && !l.disabled) ? 'glass' : 'abyss'; }
    function applyTheme(name) {
        name = name === 'glass' ? 'glass' : 'abyss';
        const l = themeLink();
        if (l) l.disabled = (name !== 'glass');
        document.documentElement.setAttribute('data-theme', name);
        try { localStorage.setItem('ramrt-theme', name); } catch (e) { /* ignore */ }
        const b = $('ux-theme-btn');
        if (b) b.textContent = name === 'glass' ? '◑ Abyss look' : '◐ Light glass look';
        if (typeof window.refreshDnaScenes === 'function') window.refreshDnaScenes();
    }
    (function initTheme() {
        let t = 'abyss';
        try { t = localStorage.getItem('ramrt-theme') === 'glass' ? 'glass' : 'abyss'; } catch (e) { /* ignore */ }
        const l = themeLink();
        if (l) l.disabled = (t !== 'glass');
        document.documentElement.setAttribute('data-theme', t);
    })();

    function buildDock() {
        if ($('ux-dock')) return;
        const dock = document.createElement('div');
        dock.id = 'ux-dock'; dock.className = 'ux-dock';
        dock.innerHTML = '<button type="button" id="ux-help-btn" title="Plain-language explanations of the terms used on this page">? Help &amp; glossary</button>' +
            '<button type="button" id="ux-theme-btn" title="Switch between the dark abyss look and the light glass look"></button>' +
            '<button type="button" id="ux-motion-btn" title="The animated background can be distracting or slow on some computers"></button>';
        document.body.appendChild(dock);
        $('ux-help-btn').addEventListener('click', openGlossary);
        $('ux-theme-btn').addEventListener('click', function () { applyTheme(currentTheme() === 'glass' ? 'abyss' : 'glass'); });
        $('ux-motion-btn').addEventListener('click', function () { setMotion(!!window.__ramrtStopAnim); });
        updateMotionBtn();
        applyTheme(currentTheme());
    }

    function buildGlossary() {
        if ($('ux-glossary-modal')) return;
        const m = document.createElement('div');
        m.id = 'ux-glossary-modal'; m.className = 'ux-modal';
        m.innerHTML = '<div class="ux-modal-card" role="dialog" aria-modal="true" aria-labelledby="ux-glossary-title">' +
            '<div class="ux-modal-head"><h3 id="ux-glossary-title">Help &amp; glossary</h3><button type="button" class="ux-modal-close" id="ux-glossary-close">Close ✕</button></div>' +
            '<p style="font-size:13.5px;color:#bbc7c6;line-height:1.55;margin:0 0 6px;"><strong style="color:#fff;">How to use the calculator.</strong> Tab 2: paste or type the recipient and donor HLA alleles; the mismatch tables update as you type. Press <em>Send to risk calculator</em> to copy the antigen mismatches and eplet loads into tab 1, where donor age, induction and crossmatch values complete the rejection-risk estimate.</p>' +
            '<dl class="ux-glossary">' + GLOSSARY.map(function (g) { return '<dt>' + g[0] + '</dt><dd>' + g[1] + '</dd>'; }).join('') + '</dl>' +
            '</div>';
        document.body.appendChild(m);
        $('ux-glossary-close').addEventListener('click', closeGlossary);
        m.addEventListener('click', function (e) { if (e.target === m) closeGlossary(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeGlossary(); });
    }
    function openGlossary() { const m = $('ux-glossary-modal'); if (m) { m.classList.add('open'); const c = $('ux-glossary-close'); if (c) c.focus(); } }
    function closeGlossary() { const m = $('ux-glossary-modal'); if (m) m.classList.remove('open'); }

    /* ---- nomogram gauge ---- */
    function buildGauge() {
        const hero = document.querySelector('#pane-nomogram .result-hero');
        if (!hero || $('ux-gauge')) return;
        const g = document.createElement('div');
        g.id = 'ux-gauge'; g.className = 'ux-gauge';
        g.innerHTML = '<div class="ux-gauge-track" id="ux-gauge-track"></div><div class="ux-gauge-labels" id="ux-gauge-labels"></div><div class="ux-gauge-caption" id="ux-gauge-caption"></div>';
        hero.insertAdjacentElement('afterend', g);
    }
    function afterRisk() {
        const track = $('ux-gauge-track');
        if (!track) return;
        const riskEl = $('risk-percent');
        const p = riskEl ? parseFloat(riskEl.textContent) / 100 : NaN;
        const bounds = (typeof QUINTILE_BOUNDS !== 'undefined') ? QUINTILE_BOUNDS : [0.0834, 0.1316, 0.1816, 0.2924];
        const edges = [0].concat(bounds).concat([0.6]);
        const observed = ['5.6%', '10.2%', '20.2%', '21.6%', '36.0%'];
        const colors = ['#6fc9c2', '#a5e3dd', '#cbfffc', '#f2d4f8', '#fde9ff'];   // teal -> phosphor-pink risk ramp
        let q = 5;
        for (let i = 0; i < bounds.length; i++) { if (p <= bounds[i]) { q = i + 1; break; } }
        track.innerHTML = colors.map(function (c, i) { return '<div class="ux-gauge-seg' + (i + 1 === q ? ' active' : '') + '" style="background:' + c + '">Q' + (i + 1) + '</div>'; }).join('');
        if (!isNaN(p)) {
            const lo = edges[q - 1], hi = edges[q];
            const frac = Math.max(0, Math.min(1, (p - lo) / (hi - lo)));
            const pct = ((q - 1) + frac) / 5 * 100;
            const marker = document.createElement('div');
            marker.className = 'ux-gauge-marker'; marker.style.left = pct + '%';
            track.appendChild(marker);
        }
        $('ux-gauge-labels').innerHTML = observed.map(function (o, i) { return '<div>' + o + ' observed</div>'; }).join('');
        $('ux-gauge-caption').textContent = isNaN(p) ? '' :
            'Predicted 1-year probability of biopsy-proven rejection: ' + (p * 100).toFixed(1) + '% (band Q' + q + ' of 5). ' +
            'Bands split the 443 study patients into five equal groups by predicted risk; the percentage under each band is how many of them actually had a rejection.';
        if (window.Motion && typeof Motion.updateSvgGauge === 'function') {
            Motion.updateSvgGauge('dashboard-risk-gauge', p, q);
        }
    }

    window.UX = { openGlossary: openGlossary, closeGlossary: closeGlossary, setMotion: setMotion, afterRisk: afterRisk, applyTheme: applyTheme, currentTheme: currentTheme, GLOSSARY: GLOSSARY };
    document.addEventListener('DOMContentLoaded', function () {
        buildDock();
        buildGlossary();
        buildGauge();
        afterRisk();
    });
})();
