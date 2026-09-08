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

    function init() {
        skipLink();
        splitTitle();
        heroParallax();
        watchNumbers();
        foldDock();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    window.Motion = { toast: toast, markPane: markPane, busy: busy, splitTitle: splitTitle, reduced: reduced };
})();
