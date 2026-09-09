/*
 * motion.js — animation and microinteraction layer.
 *   - splits the hero title into words for a staggered reveal
 *   - drifts the hero background with the pointer
 *   - counts statistics up when their value changes
 *   - toasts for actions that would otherwise give no feedback
 *   - collapses the help dock so it stops covering the page
 *   - adds a skip link and marks the pane that just became visible
 * Everything checks the OS reduced-motion setting and the app's motion toggle
 * (window.__ramrtStopAnim) before animating; the page stays fully usable without it.
 */
(function () {
    'use strict';

    function reduced() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) || !!window.__ramrtStopAnim;
    }
    function $(id) { return document.getElementById(id); }

    /* ---------------- hero title: one span per word, staggered ---------------- */
    function splitTitle() {
        const el = document.querySelector('.hero-3d-title');
        if (!el || el.classList.contains('is-split')) return;
        const words = (el.textContent || '').trim().split(/\s+/);
        if (words.length < 2) return;
        el.textContent = '';
        words.forEach(function (w, i) {
            const span = document.createElement('span');
            span.className = 'hero-word';
            span.textContent = w;
            span.style.animationDelay = (0.18 + i * 0.09).toFixed(2) + 's';
            el.appendChild(span);
            if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
        });
        el.classList.add('is-split');
    }

    /* ---------------- hero: background drifts with the pointer ---------------- */
    function heroParallax() {
        const hero = document.querySelector('.hero-3d');
        if (!hero) return;
        let raf = null, tx = 0, ty = 0;
        hero.addEventListener('mousemove', function (e) {
            if (reduced()) return;
            const r = hero.getBoundingClientRect();
            tx = ((e.clientX - r.left) / r.width - 0.5) * 2;      // -1 .. 1
            ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
            if (raf) return;
            raf = requestAnimationFrame(function () {
                hero.style.setProperty('--par-x', tx.toFixed(3));
                hero.style.setProperty('--par-y', ty.toFixed(3));
                raf = null;
            });
        });
        hero.addEventListener('mouseleave', function () {
            hero.style.setProperty('--par-x', '0');
            hero.style.setProperty('--par-y', '0');
        });
    }

    /* ---------------- statistics count up when their value changes ---------------- */
    const COUNT_SELECTOR = '#sum-mm, #sum-ep, #sum-ie, #sum-risk, .hla-head-value, .risk-display-num, .hla-batch-stat-v';
    const animating = new WeakSet();

    // "27.1%" -> {num: 27.1, decimals: 1, prefix: '', suffix: '%'}; returns null when there is no single number
    function parseNumeric(text) {
        const m = String(text).match(/^(\D*?)(-?\d+(?:\.\d+)?)(\D*)$/);
        if (!m) return null;
        const dec = (m[2].split('.')[1] || '').length;
        return { prefix: m[1], num: parseFloat(m[2]), decimals: dec, suffix: m[3] };
    }

    function countUp(el, from, to) {
        const dur = 480, t0 = performance.now();
        animating.add(el);
        function step(now) {
            const k = Math.min(1, (now - t0) / dur);
            const eased = 1 - Math.pow(1 - k, 3);
            const v = from.num + (to.num - from.num) * eased;
            el.textContent = to.prefix + v.toFixed(to.decimals) + to.suffix;
            if (k < 1) requestAnimationFrame(step);
            else { el.textContent = to.prefix + to.num.toFixed(to.decimals) + to.suffix; animating.delete(el); }
        }
        requestAnimationFrame(step);
    }

    function watchNumbers() {
        if (!window.MutationObserver) return;
        const last = new WeakMap();
        const obs = new MutationObserver(function (records) {
            if (reduced()) return;
            records.forEach(function (rec) {
                const el = rec.target.nodeType === 1 ? rec.target : rec.target.parentElement;
                if (!el || animating.has(el) || !el.matches || !el.matches(COUNT_SELECTOR)) return;
                // a value with markup inside (e.g. "3<small>/6</small>") is left alone
                if (el.children.length) { last.set(el, null); return; }
                const to = parseNumeric(el.textContent);
                if (!to) { last.set(el, null); return; }
                const from = last.get(el);
                last.set(el, to);
                if (from && from.num !== to.num && Math.abs(to.num - from.num) > 0.0001) countUp(el, from, to);
            });
        });
        obs.observe(document.body, { childList: true, characterData: true, subtree: true });
    }

    /* ---------------- toasts ---------------- */
    function stack() {
        let s = $('toast-stack');
        if (!s) {
            s = document.createElement('div');
            s.id = 'toast-stack'; s.className = 'toast-stack';
            s.setAttribute('role', 'status'); s.setAttribute('aria-live', 'polite');
            document.body.appendChild(s);
        }
        return s;
    }
    function toast(message, kind) {
        const el = document.createElement('div');
        el.className = 'toast' + (kind === 'warn' ? ' toast-warn' : '');
        el.innerHTML = '<span class="toast-mark">' + (kind === 'warn' ? '!' : '✓') + '</span><span></span>';
        el.lastChild.textContent = message;
        stack().appendChild(el);
        setTimeout(function () {
            el.classList.add('is-leaving');
            setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
        }, kind === 'warn' ? 4200 : 2600);
        return el;
    }

    /* ---------------- help dock: collapsed by default so it covers nothing ---------------- */
    function foldDock() {
        const dock = $('ux-dock');
        if (!dock || $('ux-dock-toggle')) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'ux-dock-toggle';
        btn.className = 'ux-dock-toggle';
        btn.textContent = '?';
        btn.title = 'Help, appearance and motion settings';
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-label', 'Open help and appearance settings');
        btn.addEventListener('click', function () {
            const collapsed = dock.classList.toggle('is-collapsed');
            btn.textContent = collapsed ? '?' : '✕';
            btn.setAttribute('aria-expanded', String(!collapsed));
            btn.setAttribute('aria-label', collapsed ? 'Open help and appearance settings' : 'Close help and appearance settings');
        });
        dock.insertBefore(btn, dock.firstChild);
        dock.classList.add('is-collapsed');
        // close when the pointer goes elsewhere
        document.addEventListener('click', function (e) {
            if (!dock.classList.contains('is-collapsed') && !dock.contains(e.target)) {
                dock.classList.add('is-collapsed');
                btn.textContent = '?'; btn.setAttribute('aria-expanded', 'false');
            }
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !dock.classList.contains('is-collapsed')) {
                dock.classList.add('is-collapsed');
                btn.textContent = '?'; btn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    /* ---------------- skip link ---------------- */
    function skipLink() {
        if ($('skip-to-main')) return;
        const a = document.createElement('a');
        a.id = 'skip-to-main'; a.className = 'skip-link'; a.href = '#calculator-view';
        a.textContent = 'Skip to content';
        document.body.insertBefore(a, document.body.firstChild);
    }

    /* ---------------- pane entrance ---------------- */
    function markPane(el) {
        if (!el || reduced()) return;
        el.classList.remove('pane-enter');
        void el.offsetWidth;                       // restart the animation
        el.classList.add('pane-enter');
    }

    /* ---------------- busy state helper ---------------- */
    function busy(el, on) {
        if (!el) return;
        el.classList.toggle('is-busy', !!on);
    }

    /* ---------------- 3D Card Hologram & Specular Tilt ---------------- */
    function init3DTilt() {
        if (reduced()) return;
        const cards = document.querySelectorAll('.tilt-card');
        cards.forEach(function (card) {
            let raf = null;
            function onMove(e) {
                const rect = card.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width;
                const y = (e.clientY - rect.top) / rect.height;
                const rotX = ((0.5 - y) * 14).toFixed(2);
                const rotY = ((x - 0.5) * 14).toFixed(2);
                if (raf) return;
                raf = requestAnimationFrame(function () {
                    card.style.setProperty('--mouse-x', (x * 100).toFixed(1) + '%');
                    card.style.setProperty('--mouse-y', (y * 100).toFixed(1) + '%');
                    card.style.transform = 'perspective(1000px) rotateX(' + rotX + 'deg) rotateY(' + rotY + 'deg) scale3d(1.02, 1.02, 1.02)';
                    raf = null;
                });
            }
            function onLeave() {
                if (raf) { cancelAnimationFrame(raf); raf = null; }
                card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
            }
            card.addEventListener('mousemove', onMove);
            card.addEventListener('mouseleave', onLeave);
        });
    }

    /* ---------------- SVG Speedometer Gauge Renderer & Animator ---------------- */
    function updateSvgGauge(gaugeId, predProb, quintile) {
        const wrap = typeof gaugeId === 'string' ? $(gaugeId) : gaugeId;
        if (!wrap) return;
        const needle = wrap.querySelector('.gauge-needle');
        const progArc = wrap.querySelector('.gauge-prog-arc');
        const pctEl = wrap.querySelector('.gauge-pct');
        const badgeEl = wrap.querySelector('.gauge-band-badge');

        const pct = Math.max(0, Math.min(1, predProb));
        // Map 0..0.5 (50% risk) to -90deg..+90deg angle
        const maxExpected = 0.50;
        const frac = Math.min(1, pct / maxExpected);
        const angle = -90 + (frac * 180);

        if (needle && !reduced()) {
            needle.style.transform = 'rotate(' + angle.toFixed(1) + 'deg)';
        }

        // Color ramp according to quintile (1: Very Low to 5: Extreme)
        const qColors = ['#00d2c4', '#44e5d8', '#cbfffc', '#fad1ff', '#ff88a5'];
        const qColor = qColors[(quintile || 3) - 1] || '#cbfffc';

        if (progArc) {
            // Arc length for r=78 semi-circle is ~245
            const totalLen = 245;
            const offset = Math.max(0, totalLen * (1 - frac));
            progArc.style.strokeDashoffset = offset.toFixed(1);
            progArc.style.stroke = qColor;
            progArc.style.filter = 'drop-shadow(0 0 8px ' + qColor + '88)';
        }

        if (pctEl) {
            pctEl.textContent = (pct * 100).toFixed(1) + '%';
        }
        if (badgeEl) {
            const qTitles = ['Q1 · Very Low Risk', 'Q2 · Low Risk', 'Q3 · Moderate Risk', 'Q4 · High Risk', 'Q5 · Extreme Risk'];
            badgeEl.textContent = qTitles[(quintile || 3) - 1] || 'Moderate Risk';
            badgeEl.style.color = qColor;
            badgeEl.style.borderColor = qColor + '55';
            badgeEl.style.background = qColor + '18';
        }
    }

    /* ---------------- Interactive Live Risk Sandbox (Landing Page) ---------------- */
    // Splits a total A+B+DR mismatch count into per-locus counts. The sandbox and the
    // "transfer to full terminal" button must use the same split, or the demo and the
    // calculator disagree about the same patient.
    function splitMismatches(total) {
        const dr = Math.min(2, Math.floor(total / 3) + (total % 3 > 0 ? 1 : 0));
        const a = Math.min(2, Math.floor((total - dr) / 2));
        const b = Math.min(2, total - dr - a);
        return { a: a, b: b, dr: dr };
    }

    function calcSandboxRisk() {
        const ageEl = $('sb-donor-age');
        const mmEl = $('sb-total-mm');
        const mcsEl = $('sb-mcs-t');
        const mcsBEl = $('sb-mcs-b');
        const sourceEl = $('sb-donor-source');
        if (!ageEl || !mmEl || !mcsEl) return;

        const age = parseFloat(ageEl.value) || 46;
        const totalMM = parseInt(mmEl.value, 10) || 0;
        const mcsT = parseFloat(mcsEl.value) || 0;
        const mcsB = mcsBEl ? parseFloat(mcsBEl.value) : 48;
        const sourceVal = sourceEl ? sourceEl.value : '0'; // 0 living non-sibling, 1 sibling, 2 deceased

        // Use the locked model from app.js rather than a second copy of the numbers,
        // so the sandbox cannot drift away from the calculator.
        const C = (typeof COEFFS !== 'undefined') ? COEFFS : null;
        const S = (typeof COHORT_STATS !== 'undefined') ? COHORT_STATS : null;
        if (!C || !S) return;
        const z = function (v, stat) { return (v - stat.mean) / stat.sd; };

        const mm = splitMismatches(totalMM);
        // DQB1 is not exposed as a slider; hold it at the calculator's own default so the
        // two agree after a transfer, which leaves that field untouched.
        const dqEl = $('mm-dqb1');
        const mmDQB1 = dqEl ? (parseInt(dqEl.value, 10) || 0) : 1;

        let logOdds = C.intercept
            + C.donorAge * z(age, S.donorAge)
            + C.totalMM * z(totalMM, S.totalMM)
            + C.mmA * z(mm.a, S.mmA)
            + C.mmB * z(mm.b, S.mmB)
            + C.mmDRB1 * z(mm.dr, S.mmDRB1)
            + C.mmDQB1 * z(mmDQB1, S.mmDQB1)
            + C.mcsT * z(mcsT, S.mcsT)
            + C.mcsB * z(mcsB, S.mcsB);

        if (sourceVal === '1') logOdds += C.siblingDonor;
        else if (sourceVal === '2') logOdds += C.deceasedDonor;
        logOdds += C.standardInduction;                 // standard basiliximab, the calculator's default

        const predProb = 1 / (1 + Math.exp(-logOdds));

        const bounds = (typeof QUINTILE_BOUNDS !== 'undefined') ? QUINTILE_BOUNDS : [0.0834, 0.1316, 0.1816, 0.2924];
        let quintile = bounds.length + 1;
        for (let i = 0; i < bounds.length; i++) { if (predProb <= bounds[i]) { quintile = i + 1; break; } }

        const ageVal = $('sb-val-age'); if (ageVal) ageVal.textContent = age + ' yrs';
        const mmVal = $('sb-val-mm'); if (mmVal) mmVal.textContent = totalMM + ' mismatches';
        const mcsVal = $('sb-val-mcs'); if (mcsVal) mcsVal.textContent = mcsT + ' shift';
        const mcsBVal = $('sb-val-mcs-b'); if (mcsBVal) mcsBVal.textContent = mcsB + ' shift';

        updateSvgGauge('sandbox-gauge', predProb, quintile);
    }

    function setSandboxPreset(name) {
        const presets = {
            sibling: { age: 32, mm: 0, mcs: 10, mcsB: 20, source: '1' },
            cohort: { age: 46, mm: 3, mcs: 19, mcsB: 48, source: '0' },
            highrisk: { age: 58, mm: 5, mcs: 55, mcsB: 180, source: '2' }
        };
        const p = presets[name];
        if (!p) return;
        const ageEl = $('sb-donor-age'); if (ageEl) ageEl.value = p.age;
        const mmEl = $('sb-total-mm'); if (mmEl) mmEl.value = p.mm;
        const mcsEl = $('sb-mcs-t'); if (mcsEl) mcsEl.value = p.mcs;
        const mcsBEl = $('sb-mcs-b'); if (mcsBEl) mcsBEl.value = p.mcsB;
        const sourceEl = $('sb-donor-source'); if (sourceEl) sourceEl.value = p.source;

        // Active preset pill state
        document.querySelectorAll('.preset-chip[data-preset]').forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-preset') === name);
        });

        calcSandboxRisk();
    }

    function transferSandboxToDashboard() {
        const ageEl = $('sb-donor-age');
        const mmEl = $('sb-total-mm');
        const mcsEl = $('sb-mcs-t');
        const mcsBEl = $('sb-mcs-b');
        const sourceEl = $('sb-donor-source');

        if (ageEl && $('donor-age')) $('donor-age').value = ageEl.value;
        if (mcsEl && $('mcs-t')) $('mcs-t').value = mcsEl.value;
        if (mcsBEl && $('mcs-b')) $('mcs-b').value = mcsBEl.value;

        if (sourceEl) {
            const v = sourceEl.value;
            if ($('sibling-donor')) $('sibling-donor').value = (v === '1') ? '1' : '0';
            if ($('donor-source')) $('donor-source').value = (v === '2') ? '1' : '0';
        }

        if (mmEl) {
            const mm = splitMismatches(parseInt(mmEl.value, 10) || 0);
            if ($('mm-a')) $('mm-a').value = mm.a;
            if ($('mm-b')) $('mm-b').value = mm.b;
            if ($('mm-drb1')) $('mm-drb1').value = mm.dr;
            if (typeof updateTotalMM === 'function') updateTotalMM();
        }

        if (typeof switchView === 'function') switchView('calculator');
        if (typeof switchCalculatorTab === 'function') switchCalculatorTab('nomogram');
        if (typeof calculateRisk === 'function') calculateRisk();
        toast('Sandbox values transferred to Rejection Risk Calculator');
    }

    /* ---------------- Dashboard Scenario Presets ---------------- */
    function applyDashboardScenario(type) {
        const presets = {
            ideal: { age: 32, source: 0, sibling: 1, induction: 1, mmA: 0, mmB: 0, mmDR: 0, mmDQ: 0, mcsT: 8, mcsB: 24, label: 'Ideal Living Sibling (Q1)' },
            typical: { age: 46, source: 0, sibling: 0, induction: 1, mmA: 1, mmB: 1, mmDR: 1, mmDQ: 1, mcsT: 19, mcsB: 72, label: 'PGIMER Cohort Average (Q3)' },
            sensitized: { age: 58, source: 1, sibling: 0, induction: 0, mmA: 2, mmB: 2, mmDR: 2, mmDQ: 1, mcsT: 65, mcsB: 140, label: 'Sensitized Deceased Donor (Q5)' }
        };
        const p = presets[type];
        if (!p) return;

        if ($('donor-age')) $('donor-age').value = p.age;
        if ($('donor-source')) $('donor-source').value = p.source;
        if ($('sibling-donor')) $('sibling-donor').value = p.sibling;
        if ($('standard-induction')) $('standard-induction').value = p.induction;
        if ($('mm-a')) $('mm-a').value = p.mmA;
        if ($('mm-b')) $('mm-b').value = p.mmB;
        if ($('mm-drb1')) $('mm-drb1').value = p.mmDR;
        if ($('mm-dqb1')) $('mm-dqb1').value = p.mmDQ;
        if ($('mcs-t')) $('mcs-t').value = p.mcsT;
        if ($('mcs-b')) $('mcs-b').value = p.mcsB;

        if (typeof updateTotalMM === 'function') updateTotalMM();
        if (typeof calculateRisk === 'function') calculateRisk();
        toast('Loaded scenario: ' + p.label);
    }

    /* ---------------- HLA & Eplets Preset Pairs ---------------- */
    function loadHlaPresetPair(index) {
        if (!window.HLAUI) return;
        const pairs = [
            {
                name: 'Sibling Near-Match (Low Eplet Burden)',
                rec: 'A*02:01, A*24:02, B*40:01, B*51:01, C*03:04, C*14:02, DRB1*15:01, DRB1*15:02, DQB1*06:01, DQB1*06:02',
                don: 'A*02:01, A*24:02, B*40:01, B*35:01, C*03:04, C*04:01, DRB1*15:01, DRB1*11:01, DQB1*06:01, DQB1*03:01'
            },
            {
                name: 'Heavy Molecular Load',
                rec: 'A*01:01, A*03:01, B*07:02, B*08:01, C*07:01, C*07:02, DRB1*03:01, DRB1*15:01, DQB1*02:01, DQB1*06:02',
                don: 'A*24:02, A*33:03, B*44:02, B*58:01, C*03:02, C*06:02, DRB1*04:01, DRB1*07:01, DQB1*03:02, DQB1*02:02'
            },
            {
                name: 'Dominant Targets (163LG & 130Q)',
                rec: 'A*02:01, A*11:01, B*15:01, B*35:03, C*04:01, C*07:02, DRB1*04:01, DRB1*13:01, DQB1*03:02, DQB1*06:03',
                don: 'A*01:01, A*24:02, B*57:01, B*58:01, C*06:02, C*12:03, DRB1*07:01, DRB1*15:01, DQB1*02:02, DQB1*06:01'
            }
        ];
        const p = pairs[index];
        if (!p) return;
        const recEl = $('hla-recipient');
        const donEl = $('hla-donor');
        if (recEl && donEl) {
            recEl.value = p.rec;
            donEl.value = p.don;
            if (typeof HLAUI.setMode === 'function') HLAUI.setMode('paste');
            if (typeof HLAUI.analyzeSingle === 'function') HLAUI.analyzeSingle();
            toast('Loaded HLA pair: ' + p.name);
        }
    }

    /* ---------------- Interactive Summary Strip Cues ---------------- */
    function initClickableSummary() {
        const mmCard = document.querySelector('.db-sum-item:nth-child(1)');
        const epCard = document.querySelector('.db-sum-item:nth-child(2)');
        const ieCard = document.querySelector('.db-sum-item:nth-child(3)');
        const riskCard = document.querySelector('.db-sum-item:nth-child(4)');

        [mmCard, epCard, ieCard].forEach(function (el) {
            if (!el) return;
            el.classList.add('is-clickable');
            el.title = 'Click to open HLA Mismatch & Eplet Analysis';
            el.addEventListener('click', function () {
                if (typeof switchCalculatorTab === 'function') switchCalculatorTab('eplet');
            });
        });
        if (riskCard) {
            riskCard.classList.add('is-clickable');
            riskCard.title = 'Click to open Rejection Risk Calculator';
            riskCard.addEventListener('click', function () {
                if (typeof switchCalculatorTab === 'function') switchCalculatorTab('nomogram');
            });
        }
    }

    /* ---------------- Keyboard Navigation Shortcuts ---------------- */
    function initKeyboardShortcuts() {
        document.addEventListener('keydown', function (e) {
            // Ignore when focused in input, textarea, or select
            const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
            if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.ctrlKey || e.metaKey) return;

            if (e.key === '1') {
                if (typeof switchView === 'function') switchView('calculator');
                if (typeof switchCalculatorTab === 'function') switchCalculatorTab('home');
            } else if (e.key === '2') {
                if (typeof switchView === 'function') switchView('calculator');
                if (typeof switchCalculatorTab === 'function') switchCalculatorTab('nomogram');
            } else if (e.key === '3') {
                if (typeof switchView === 'function') switchView('calculator');
                if (typeof switchCalculatorTab === 'function') switchCalculatorTab('eplet');
            } else if (e.key === '0' || e.key.toLowerCase() === 'h') {
                if (typeof switchView === 'function') switchView('landing');
            }
        });
    }

    function init() {
        skipLink();
        splitTitle();
        heroParallax();
        watchNumbers();
        foldDock();
        init3DTilt();
        initClickableSummary();
        initKeyboardShortcuts();

        // Initial live sandbox update if present
        if ($('sb-donor-age')) {
            calcSandboxRisk();
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    window.Motion = {
        toast: toast,
        markPane: markPane,
        busy: busy,
        splitTitle: splitTitle,
        reduced: reduced,
        updateSvgGauge: updateSvgGauge,
        calcSandboxRisk: calcSandboxRisk,
        setSandboxPreset: setSandboxPreset,
        transferSandboxToDashboard: transferSandboxToDashboard,
        applyDashboardScenario: applyDashboardScenario,
        loadHlaPresetPair: loadHlaPresetPair
    };
})();

