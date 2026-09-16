/*
 * admin_gate.js — Client-side password gate for RAMRT.
 *
 * On page load checks localStorage for a valid session. If absent or expired,
 * a full-screen login modal blocks interaction until the correct password is
 * entered. The password is compared via SHA-256 hash (Web Crypto API) — only
 * the hash is stored in source.
 *
 * NOTE: This is NOT cryptographic security. It is a simple deterrent/access
 * gate suitable for a research tool. Anyone who inspects the source can bypass
 * it. For real authentication use a backend service.
 */
(function () {
    'use strict';

    /* ---------- Configuration ---------- */
    // SHA-256 hash of the admin password "pgimer2024"
    // To change the password, run in browser console:
    //   crypto.subtle.digest('SHA-256', new TextEncoder().encode('YOUR_NEW_PASSWORD'))
    //     .then(b => console.log(Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2,'0')).join('')))
    var HASH = 'fb77314e5549f8a28b5380a04d755c88c2fa8c7e76e89c50cb25eed918283dd9';
    var SESSION_KEY = 'ramrt-admin-session';
    var SESSION_DAYS = 7;

    /* ---------- Helpers ---------- */
    function isSessionValid() {
        try {
            var raw = localStorage.getItem(SESSION_KEY);
            if (!raw) return false;
            var data = JSON.parse(raw);
            if (!data || !data.expires) return false;
            return Date.now() < data.expires;
        } catch (e) { return false; }
    }

    function setSession() {
        try {
            localStorage.setItem(SESSION_KEY, JSON.stringify({
                expires: Date.now() + SESSION_DAYS * 86400000
            }));
        } catch (e) { /* storage unavailable */ }
    }

    function clearSession() {
        try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
    }

    function sha256(text) {
        return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
            .then(function (buf) {
                return Array.from(new Uint8Array(buf))
                    .map(function (b) { return b.toString(16).padStart(2, '0'); })
                    .join('');
            });
    }

    /* ---------- Modal DOM ---------- */
    function showGate() {
        // Build overlay
        var overlay = document.createElement('div');
        overlay.id = 'admin-gate-overlay';
        overlay.innerHTML =
            '<div class="admin-gate-card">' +
                '<div class="admin-gate-brand">' +
                    '<div class="admin-gate-symbol"></div>' +
                    '<span>RAMRT // IMMUNOPATHOLOGY</span>' +
                '</div>' +
                '<h2 class="admin-gate-title">Restricted Access</h2>' +
                '<p class="admin-gate-desc">This tool is available to authorised research personnel only.<br>Enter the access code to continue.</p>' +
                '<form id="admin-gate-form" autocomplete="off">' +
                    '<div class="admin-gate-field">' +
                        '<input type="password" id="admin-gate-input" class="admin-gate-input" placeholder="Access code" autocomplete="off" autofocus />' +
                    '</div>' +
                    '<div id="admin-gate-error" class="admin-gate-error"></div>' +
                    '<button type="submit" class="admin-gate-btn">Authenticate</button>' +
                '</form>' +
                '<p class="admin-gate-footer">Department of Immunopathology · PGIMER Chandigarh</p>' +
            '</div>';
        document.body.appendChild(overlay);

        // Force focus after a tick (autofocus may not work on dynamic elements)
        setTimeout(function () {
            var inp = document.getElementById('admin-gate-input');
            if (inp) inp.focus();
        }, 100);

        // Handle submit
        var form = document.getElementById('admin-gate-form');
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var inp = document.getElementById('admin-gate-input');
            var errEl = document.getElementById('admin-gate-error');
            var val = (inp.value || '').trim();
            if (!val) { errEl.textContent = 'Please enter the access code.'; return; }

            sha256(val).then(function (h) {
                if (h === HASH) {
                    setSession();
                    overlay.classList.add('admin-gate-exit');
                    setTimeout(function () { overlay.remove(); }, 400);
                    injectLogout();
                } else {
                    errEl.textContent = 'Incorrect access code. Please try again.';
                    inp.value = '';
                    inp.focus();
                }
            });
        });
    }

    /* ---------- Logout button ---------- */
    function injectLogout() {
        // Don't double-inject
        if (document.getElementById('admin-logout-btn')) return;
        var wrap = document.querySelector('.nav-action-wrap');
        if (!wrap) return;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'admin-logout-btn';
        btn.className = 'btn-ghost btn-sm admin-logout-btn';
        btn.textContent = 'Logout';
        btn.title = 'Clear session and lock the terminal';
        btn.addEventListener('click', function () {
            clearSession();
            window.location.reload();
        });
        wrap.appendChild(btn);
    }

    /* ---------- Init ---------- */
    if (isSessionValid()) {
        // Already authed — just add logout button when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', injectLogout);
        } else {
            injectLogout();
        }
    } else {
        // Show gate immediately (runs before other scripts)
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', showGate);
        } else {
            showGate();
        }
    }

    // Expose for programmatic use
    window.AdminGate = {
        isAuthenticated: isSessionValid,
        logout: function () { clearSession(); window.location.reload(); }
    };
})();
