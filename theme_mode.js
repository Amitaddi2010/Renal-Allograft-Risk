/*
 * theme_mode.js — display settings for the dashboard: colour theme and interface scale.
 *
 * The theme is written to <html data-theme="light|dark"> by the inline bootstrap in
 * index.html (before first paint, so nothing flashes); this file draws the switch in
 * the top bar and tells the browser UI which colour to use.
 *
 * The choice lives in localStorage under ramrt-theme and is either 'light' or 'dark';
 * dark is the default. Older values are carried over: 'system' and the retired
 * 'abyss' become dark, 'glass' becomes light.
 *
 * Interface scale (ramrt-ui-scale, default 0.8) renders the desktop UI at the density
 * the browser's own 80% zoom gives, without anyone having to change browser zoom. It
 * sets --ui-scale, which ramrt_ui.css turns into `zoom` above 860px.
 */
(function () {
    'use strict';

    var KEY = 'ramrt-theme';
    var MODES = ['light', 'dark'];
    var DEFAULT = 'dark';
    var LEGACY = { system: 'dark', abyss: 'dark', glass: 'light' };

    var ICONS = {
        light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
        dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>'
    };
    var LABEL = { light: 'Light', dark: 'Dark' };

    function stored() {
        try {
            var v = localStorage.getItem(KEY);
            if (MODES.indexOf(v) !== -1) return v;
            return LEGACY[v] || DEFAULT;
        } catch (e) { return DEFAULT; }
    }

    function apply(theme) {
        if (MODES.indexOf(theme) === -1) theme = DEFAULT;
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.setAttribute('data-theme-mode', theme);
        var meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'theme-color';
            document.head.appendChild(meta);
        }
        meta.content = theme === 'dark' ? '#011314' : '#f4f8f7';
        render(theme);
        window.dispatchEvent(new CustomEvent('ramrt:themechange', { detail: { mode: theme, theme: theme } }));
    }

    function set(theme) {
        if (MODES.indexOf(theme) === -1) theme = DEFAULT;
        try { localStorage.setItem(KEY, theme); } catch (e) { /* storage unavailable */ }
        apply(theme);
    }

    function render(theme) {
        var wrap = document.getElementById('theme-switch');
        if (!wrap) return;
        if (!wrap.dataset.built) {
            wrap.className = 'theme-switch';
            wrap.setAttribute('role', 'group');
            wrap.setAttribute('aria-label', 'Colour theme');
            wrap.innerHTML = MODES.map(function (m) {
                return '<button type="button" data-mode="' + m + '" aria-pressed="false" title="' + LABEL[m] +
                    ' theme"><span class="ts-ico">' + ICONS[m] + '</span><span class="ts-label">' + LABEL[m] + '</span></button>';
            }).join('');
            wrap.addEventListener('click', function (e) {
                var btn = e.target.closest('button[data-mode]');
                if (btn) set(btn.getAttribute('data-mode'));
            });
            wrap.dataset.built = '1';
        }
        Array.prototype.forEach.call(wrap.querySelectorAll('button[data-mode]'), function (b) {
            b.setAttribute('aria-pressed', b.getAttribute('data-mode') === theme ? 'true' : 'false');
        });
    }

    /* ---------------- interface scale ---------------- */
    var SCALE_KEY = 'ramrt-ui-scale';
    var SCALES = [0.8, 0.9, 1];
    var SCALE_DEFAULT = 0.8;

    function storedScale() {
        try {
            var v = parseFloat(localStorage.getItem(SCALE_KEY));
            return SCALES.indexOf(v) === -1 ? SCALE_DEFAULT : v;
        } catch (e) { return SCALE_DEFAULT; }
    }

    function applyScale(scale) {
        if (SCALES.indexOf(scale) === -1) scale = SCALE_DEFAULT;
        document.documentElement.style.setProperty('--ui-scale', String(scale));
        renderScale(scale);
        window.dispatchEvent(new CustomEvent('ramrt:scalechange', { detail: { scale: scale } }));
    }

    function setScale(scale) {
        try { localStorage.setItem(SCALE_KEY, String(scale)); } catch (e) { /* storage unavailable */ }
        applyScale(scale);
    }

    function renderScale(scale) {
        var wrap = document.getElementById('ui-scale-switch');
        if (!wrap) return;
        if (!wrap.dataset.built) {
            wrap.className = 'scale-switch';
            wrap.setAttribute('role', 'group');
            wrap.setAttribute('aria-label', 'Interface scale');
            wrap.innerHTML = '<span class="ss-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
                'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5h8v2M7 5v14M5 19h4"/>' +
                '<path d="M13 13v-1.5h7V13M16.5 11.5V19M15 19h3"/></svg></span>' +
                SCALES.map(function (v) {
                    return '<button type="button" data-scale="' + v + '" aria-pressed="false" title="Interface scale ' +
                        Math.round(v * 100) + '%">' + Math.round(v * 100) + '%</button>';
                }).join('');
            wrap.addEventListener('click', function (e) {
                var btn = e.target.closest('button[data-scale]');
                if (btn) setScale(parseFloat(btn.getAttribute('data-scale')));
            });
            wrap.dataset.built = '1';
        }
        Array.prototype.forEach.call(wrap.querySelectorAll('button[data-scale]'), function (b) {
            b.setAttribute('aria-pressed', parseFloat(b.getAttribute('data-scale')) === scale ? 'true' : 'false');
        });
    }

    window.UIScale = { get: storedScale, set: setScale, OPTIONS: SCALES };

    window.ThemeMode = {
        get: stored,
        set: set,
        resolved: stored,
        toggle: function () { set(stored() === 'dark' ? 'light' : 'dark'); },
        init: function () { apply(stored()); }
    };

    function start() {
        applyScale(storedScale());
        var theme = stored();
        // rewrite a retired value ('system', 'abyss', 'glass') to what it maps to
        try { if (localStorage.getItem(KEY) !== theme) localStorage.setItem(KEY, theme); } catch (e) { /* storage unavailable */ }
        apply(theme);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
