/*
 * cinema.js — immersive landing page (see cinema.css for the look).
 *
 *   opening sequence ........ letterbox bars retract, once per browser session
 *   film grain, vignette .... texture and edge darkening
 *   scroll depth ............ helix pushes in, hero copy lifts away, progress line
 *   reveals ................. sections rise in; titles wipe; kickers decode;
 *                             figures count up; portraits unmask and settle
 *   view change ............. cut to black, then an iris opens from the click
 *   ticker band ............. outlined terms after the hero, skewed by scroll speed
 *   light leak .............. a coloured glow that shifts with the section in view
 *   pointer ................. soft light, trailing ring, magnetic buttons
 *
 * Only the landing view is affected; the dashboard is untouched. Everything
 * checks the OS reduced-motion setting and the app's motion toggle, and the
 * page is complete if this script never runs.
 */
(function () {
    'use strict';

    function reduced() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ||
            !!window.__ramrtStopAnim;
    }
    function finePointer() {
        return !!(window.matchMedia && window.matchMedia('(pointer: fine)').matches);
    }
    function landing() { return document.body.classList.contains('is-landing'); }

    function add(cls) {
        const el = document.createElement('div');
        el.className = cls;
        el.setAttribute('aria-hidden', 'true');
        document.body.appendChild(el);
        return el;
    }

    /* ---------------------------------------------------------------- opening */
    function curtain() {
        let seen = false;
        try { seen = sessionStorage.getItem('ramrt-cine-seen') === '1'; } catch (e) { /* ignore */ }
        if (seen || !landing()) return;
        try { sessionStorage.setItem('ramrt-cine-seen', '1'); } catch (e) { /* ignore */ }
        const c = add('cine-curtain');
        setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); }, 2200);
    }

    /* ---------------------------------------------------------------- kinetic text */
    // A section kicker "decodes" from random glyphs into its words, like a terminal
    // readout. The final text is set as the accessible name first, so a screen
    // reader never hears the scramble.
    const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/+*#';
    function decode(el) {
        if (!el || el.dataset.cineDecoded || el.children.length) return;
        el.dataset.cineDecoded = '1';
        const final = el.textContent;
        el.setAttribute('aria-label', final.trim());
        const steps = 20;
        let n = 0;
        (function tick() {
            n += 1;
            const shown = Math.floor(final.length * n / steps);
            el.textContent = final.split('').map(function (ch, i) {
                if (ch === ' ' || i < shown) return ch;
                return GLYPHS[(Math.random() * GLYPHS.length) | 0];
            }).join('');
            if (n < steps) setTimeout(tick, 34);
            else el.textContent = final;
        })();
    }

    // "443", "0.693", "100%": count up from zero, keeping prefix, suffix and decimals.
    function countUp(el) {
        if (!el || el.dataset.cineCounted) return;
        el.dataset.cineCounted = '1';
        const text = el.textContent.trim();
        const m = text.match(/^(\D*)(\d+(?:\.\d+)?)(\D*)$/);
        if (!m) return;
        const target = parseFloat(m[2]);
        const decimals = (m[2].split('.')[1] || '').length;
        const t0 = Date.now(), dur = 1500;
        (function tick() {
            const k = Math.min(1, (Date.now() - t0) / dur);
            const eased = 1 - Math.pow(1 - k, 4);
            el.textContent = m[1] + (target * eased).toFixed(decimals) + m[3];
            if (k < 1) setTimeout(tick, 16);
            else el.textContent = text;
        })();
    }

    /* ---------------------------------------------------------------- reveals */
    function markIn(el) {
        if (el.classList.contains('is-in')) return;
        el.classList.add('is-in');
        el.querySelectorAll('.group-kicker').forEach(decode);
        if (el.classList.contains('metric-card-val')) countUp(el);
        el.querySelectorAll('.metric-card-val').forEach(countUp);
    }

    function reveals() {
        const targets = [];
        document.querySelectorAll('#landing-view .landing-section').forEach(function (sec) {
            const header = sec.querySelector('.landing-section-header');
            if (header) targets.push({ el: header, i: 0 });
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
                if (e.isIntersecting) { markIn(e.target); io.unobserve(e.target); }
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
        targets.forEach(function (t) { io.observe(t.el); });
        // An observer reports every target once as soon as it starts. If nothing has
        // arrived after a few seconds the browser is not delivering callbacks, and
        // hidden content would stay hidden for good - so reveal everything instead.
        setTimeout(function () {
            if (!heard) targets.forEach(function (t) { markIn(t.el); });
        }, 2500);
    }

    /* ---------------------------------------------------------------- scroll */
    function scrollEffects(progress) {
        const hero = document.querySelector('.hero-3d');
        let lastY = window.scrollY || 0, lastT = Date.now(), settle = null;
        // Scroll events already arrive once per frame, so the handler sets custom
        // properties directly rather than scheduling a further frame.
        function update() {
            if (!landing()) return;
            const vh = window.innerHeight || 1;
            const y = window.scrollY || window.pageYOffset || 0;
            const heroH = hero ? hero.offsetHeight : vh;
            const p = Math.max(0, Math.min(1, y / (heroH * 0.9)));
            const body = document.body.style;
            body.setProperty('--cine-p', p.toFixed(4));
            const max = Math.max(1, document.documentElement.scrollHeight - vh);
            progress.style.setProperty('--cine-s', Math.max(0, Math.min(1, y / max)).toFixed(4));

            // scroll speed, in px per ms, clamped: drives the ticker's skew
            const now = Date.now(), dt = Math.max(1, now - lastT);
            const vel = Math.max(-8, Math.min(8, ((y - lastY) / dt) * 6));
            lastY = y; lastT = now;
            body.setProperty('--cine-vel', vel.toFixed(2));
            clearTimeout(settle);
            settle = setTimeout(function () { body.setProperty('--cine-vel', '0'); }, 140);
        }
        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        update();
        return update;
    }

    /* ---------------------------------------------------------------- scenes */
    // Which section fills the middle of the screen sets data-cine-scene, and the
    // light leak eases to that section's colour and position.
    function scenes() {
        const ids = ['hero', 'landing-metrics', 'landing-features', 'landing-sandbox',
                     'landing-evidence-section', 'landing-about'];
        const els = ids.map(function (id) { return document.getElementById(id); }).filter(Boolean);
        document.body.setAttribute('data-cine-scene', 'hero');
        if (!('IntersectionObserver' in window) || !els.length) return;
        const io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (e.isIntersecting) document.body.setAttribute('data-cine-scene', e.target.id);
            });
        }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
        els.forEach(function (el) { io.observe(el); });
    }

    /* ---------------------------------------------------------------- ticker band */
    const TERMS = ['HLA-A', 'HLA-B', 'HLA-DRB1', 'HLA-DQB1', 'Eplet mismatch', '163LG', '130Q',
                   'Flow crossmatch', 'Banff', 'PD-L1', '443 recipients', 'AUC 0.693',
                   'Antibody-verified', 'Donor–recipient'];
    function marquee() {
        const hero = document.getElementById('hero');
        if (!hero || document.querySelector('.cine-marquee')) return;
        const run = TERMS.map(function (t) {
            return '<span class="cine-marquee-item">' + t + '</span><span class="cine-marquee-sep">✦</span>';
        }).join('');
        const band = document.createElement('div');
        band.className = 'cine-marquee';
        band.setAttribute('aria-hidden', 'true');
        // two copies of the run, so the loop at -50% is seamless
        band.innerHTML = '<div class="cine-marquee-skew"><div class="cine-marquee-track">' + run + run + '</div></div>';
        hero.insertAdjacentElement('afterend', band);
    }

    /* ---------------------------------------------------------------- pointer */
    function pointerLight(light) {
        window.addEventListener('pointermove', function (e) {
            if (!landing() || e.pointerType === 'touch') return;
            light.style.setProperty('--mx', e.clientX + 'px');
            light.style.setProperty('--my', e.clientY + 'px');
        }, { passive: true });
    }

    // Buttons lean up to ~10px towards the pointer while it is over them.
    function magnetic() {
        if (!finePointer()) return;
        document.querySelectorAll('#landing-view .btn-aurora, #landing-view .btn-ghost, #landing-header .btn-aurora')
            .forEach(function (btn) {
                if (btn.classList.contains('cine-reveal')) return;   // its translate belongs to the reveal
                btn.classList.add('cine-mag');
                btn.addEventListener('pointermove', function (e) {
                    const r = btn.getBoundingClientRect();
                    const x = (e.clientX - (r.left + r.width / 2)) / r.width;
                    const y = (e.clientY - (r.top + r.height / 2)) / r.height;
                    btn.style.setProperty('--mag-x', (x * 12).toFixed(1) + 'px');
                    btn.style.setProperty('--mag-y', (y * 9).toFixed(1) + 'px');
                });
                btn.addEventListener('pointerleave', function () {
                    btn.style.setProperty('--mag-x', '0px');
                    btn.style.setProperty('--mag-y', '0px');
                });
            });
    }

    // A ring that trails the pointer and swells over anything clickable. It only
    // runs its animation loop while it is catching up, then stops.
    function cursorRing() {
        if (!finePointer()) return;
        const ring = add('cine-cursor');
        let x = -100, y = -100, tx = -100, ty = -100, running = false, idle = null;
        function loop() {
            x += (tx - x) * 0.2;
            y += (ty - y) * 0.2;
            ring.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
            if (Math.abs(tx - x) > 0.3 || Math.abs(ty - y) > 0.3) requestAnimationFrame(loop);
            else running = false;
        }
        window.addEventListener('pointermove', function (e) {
            if (!landing() || e.pointerType !== 'mouse') return;
            tx = e.clientX; ty = e.clientY;
            if (x < 0) { x = tx; y = ty; }
            const hot = e.target.closest && e.target.closest('a, button, input, select, textarea, [role="button"], .tilt-card');
            ring.classList.toggle('is-hot', !!hot);
            ring.classList.remove('is-idle');
            clearTimeout(idle);
            idle = setTimeout(function () { ring.classList.add('is-idle'); }, 2500);
            if (!running) { running = true; requestAnimationFrame(loop); }
        }, { passive: true });
        document.addEventListener('mouseleave', function () { ring.classList.add('is-idle'); });
    }

    /* ---------------------------------------------------------------- view change */
    // Landing <-> dashboard: cut to black and switch views at once, underneath the
    // overlay, then open an iris from the point the user clicked. The switch must
    // stay synchronous - buttons call switchView() and then switchCalculatorTab()
    // or scrollToSection() on the next line, and switchView rewrites the URL hash,
    // so deferring it (as the View Transitions API does) would run them out of order.
    function viewChange() {
        const original = window.switchView;
        if (typeof original !== 'function' || original.__cine) return;
        let px = window.innerWidth / 2, py = window.innerHeight / 2;
        document.addEventListener('pointerdown', function (e) { px = e.clientX; py = e.clientY; }, true);

        const wrapped = function (view) {
            const from = landing() ? 'landing' : 'calculator';
            const to = view === 'calculator' ? 'calculator' : 'landing';
            const result = original.apply(this, arguments);           // state first, always
            if (reduced() || from === to) return result;
            document.querySelectorAll('.cine-iris').forEach(function (old) { old.remove(); });
            const iris = add('cine-iris');
            iris.style.setProperty('--vt-x', px + 'px');
            iris.style.setProperty('--vt-y', py + 'px');
            setTimeout(function () { if (iris.parentNode) iris.parentNode.removeChild(iris); }, 1100);
            return result;
        };
        wrapped.__cine = true;
        window.switchView = wrapped;
    }

    /* ---------------------------------------------------------------- init */
    function init() {
        add('cine-grain');                        // static texture even with motion off
        const progress = add('cine-progress');
        marquee();                                // the band is content-neutral; it stays, still, without motion
        if (reduced()) {
            scrollEffects(progress);
            return;
        }
        document.body.classList.add('cine-on');
        curtain();
        reveals();
        scenes();
        scrollEffects(progress);
        pointerLight(add('cine-light'));
        add('cine-leak');
        magnetic();
        cursorRing();
        viewChange();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    window.Cinema = { reduced: reduced, decode: decode, countUp: countUp };
})();
