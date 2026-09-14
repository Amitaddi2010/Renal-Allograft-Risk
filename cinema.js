/*
 * cinema.js — immersive landing page (see cinema.css for the look).
 *   opening sequence, film grain, scroll depth on the hero, section reveals,
 *   progress line and pointer light. Everything checks the OS reduced-motion
 *   setting and the app's motion toggle, and only runs on the landing view.
 */
(function () {
    'use strict';

    function reduced() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ||
            !!window.__ramrtStopAnim;
    }
    function landing() { return document.body.classList.contains('is-landing'); }

    function add(cls) {
        const el = document.createElement('div');
        el.className = cls;
        el.setAttribute('aria-hidden', 'true');
        document.body.appendChild(el);
        return el;
    }

    /* ---- opening sequence: once per browser session, so returning is not slowed ---- */
    function curtain() {
        let seen = false;
        try { seen = sessionStorage.getItem('ramrt-cine-seen') === '1'; } catch (e) { /* ignore */ }
        if (seen || reduced() || !landing()) return;
        try { sessionStorage.setItem('ramrt-cine-seen', '1'); } catch (e) { /* ignore */ }
        const c = add('cine-curtain');
        setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); }, 2200);
    }

    /* ---- reveals ---- */
    function reveals() {
        const targets = [];
        document.querySelectorAll('#landing-view .landing-section').forEach(function (sec) {
            const header = sec.querySelector('.landing-section-header');
            if (header) targets.push({ el: header, i: 0 });
            // the grid or ribbon under each header: reveal its items one after another
            Array.prototype.forEach.call(sec.children, function (child) {
                if (child === header) return;
                const items = child.children.length > 1 && child.children.length <= 12 ? child.children : [child];
                Array.prototype.forEach.call(items, function (it, k) { targets.push({ el: it, i: k }); });
            });
        });
        if (!('IntersectionObserver' in window)) return;
        targets.forEach(function (t) {
            t.el.classList.add('cine-reveal');
            t.el.style.setProperty('--i', String(Math.min(t.i, 8)));
        });
        let heard = false;
        const io = new IntersectionObserver(function (entries) {
            heard = true;
            entries.forEach(function (e) {
                if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
        targets.forEach(function (t) { io.observe(t.el); });
        // An observer reports every target once as soon as it starts observing. If
        // nothing has arrived after a few seconds, the browser is not delivering
        // callbacks at all, and hidden content would stay hidden for good - so
        // reveal everything rather than lose it.
        setTimeout(function () {
            if (heard) return;
            targets.forEach(function (t) { t.el.classList.add('is-in'); });
        }, 2500);
    }

    /* ---- scroll depth + progress ---- */
    function scrollEffects(progress) {
        const hero = document.querySelector('.hero-3d');
        // Scroll events are already delivered once per frame, so the handler sets
        // two custom properties directly rather than scheduling a further frame.
        function update() {
            if (!landing()) return;
            const vh = window.innerHeight || 1;
            const y = window.scrollY || window.pageYOffset || 0;
            const heroH = hero ? hero.offsetHeight : vh;
            const p = Math.max(0, Math.min(1, y / (heroH * 0.9)));
            document.body.style.setProperty('--cine-p', p.toFixed(4));
            const max = Math.max(1, document.documentElement.scrollHeight - vh);
            progress.style.setProperty('--cine-s', Math.max(0, Math.min(1, y / max)).toFixed(4));
        }
        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        update();
        return update;
    }

    /* ---- pointer light ---- */
    function pointerLight(light) {
        window.addEventListener('pointermove', function (e) {
            if (!landing() || e.pointerType === 'touch') return;
            light.style.setProperty('--mx', e.clientX + 'px');
            light.style.setProperty('--my', e.clientY + 'px');
        }, { passive: true });
    }

    function init() {
        add('cine-grain');                       // static texture even with motion off
        const progress = add('cine-progress');
        if (reduced()) {                         // no moving parts: page shows fully, instantly
            scrollEffects(progress);
            return;
        }
        document.body.classList.add('cine-on');
        curtain();
        reveals();
        scrollEffects(progress);
        pointerLight(add('cine-light'));
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    window.Cinema = { reduced: reduced };
})();
