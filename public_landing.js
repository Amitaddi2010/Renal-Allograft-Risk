/*
 * public_landing.js — keeps the landing page whole for a visitor who is not signed in.
 *
 * The gate in middleware.js serves the landing to everyone but withholds app.js, the
 * HLA engine and the reference tables. Those <script> tags then come back 401 and
 * simply define nothing, so this file, loaded last, fills the gaps:
 *
 *   - the navigation and anchor links keep working;
 *   - anything that opens the calculator sends the visitor to sign in instead;
 *   - the live sandbox says so rather than sitting on a figure it cannot recompute
 *     (calcSandboxRisk() returns early without the locked model, leaving the number
 *     in the markup looking like a result);
 *   - a signed-in admin gets a "signed in as … · sign out" line.
 *
 * When app.js has loaded, everything above is already defined and this file only adds
 * the sign-out line.
 */
(function () {
    'use strict';

    function signedInAs() {
        const m = /(?:^|;\s*)ramrt_admin=([^;]+)/.exec(document.cookie || '');
        try { return m ? decodeURIComponent(m[1]) : null; } catch (e) { return m ? m[1] : null; }
    }

    const locked = typeof window.switchView !== 'function';   // app.js was withheld

    function toSignIn() {
        window.location.href = '/login?next=' + encodeURIComponent('/index.html');
    }

    if (locked) {
        window.switchView = function (view) {
            if (view === 'calculator') { toSignIn(); return; }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };
        window.switchCalculatorTab = function () { toSignIn(); };
        window.calculateRisk = function () { /* the model is not on this page */ };
        window.scrollToSection = function (id) {
            const el = document.getElementById(id);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        window.closeNav = function () {
            const nav = document.getElementById('nav-links');
            if (nav) nav.classList.remove('open');
        };
    }

    function lockSandbox() {
        const card = document.querySelector('#landing-sandbox .sandbox-card');
        if (!card || card.dataset.locked) return;
        card.dataset.locked = '1';
        card.querySelectorAll('input, select, button').forEach(function (el) {
            el.disabled = true;
            el.setAttribute('aria-disabled', 'true');
        });
        const note = document.createElement('p');
        note.className = 'hla-na sandbox-locked-note';
        note.innerHTML = 'The sandbox runs on the study model, which loads only for signed-in ' +
            'administrators. <a href="/login?next=%2Findex.html">Sign in</a> to try it. ' +
            'User accounts are coming soon.';
        card.insertBefore(note, card.firstChild);
    }

    function addAccountLine() {
        const who = signedInAs();
        const host = document.querySelector('.landing-footer-links') || document.querySelector('.landing-footer');
        if (!host || host.dataset.acct) return;
        host.dataset.acct = '1';
        const wrap = document.createElement('div');
        wrap.className = 'landing-account-line';
        wrap.innerHTML = who
            ? 'Signed in as ' + who.replace(/[<>&]/g, '') + ' · <a href="/auth/logout">Sign out</a>'
            : '<a href="/login?next=%2Findex.html">Admin sign-in</a>';
        host.appendChild(wrap);
    }

    function init() {
        if (locked) lockSandbox();
        addAccountLine();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
