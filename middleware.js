/*
 * middleware.js — the access gate, running on Vercel before any file is served.
 *
 * This is the only thing that actually protects the study data. A sign-in drawn inside
 * the page would not: on a static site anyone can request /hla_reference_data.js or
 * /reference_sources/IE.xlsx directly. Those requests come through here first.
 *
 *   public            landing page, its stylesheets, images and animation scripts
 *   admin only        app.js (the risk model), the HLA engine and reference tables,
 *                     the immunogenic eplet catalogue, validation and tools files
 *   /login            sign-in form, and the notice that user accounts are coming
 *   /auth/login       checks the shared password and the admin address
 *   /auth/logout      clears the session
 *
 * Fails closed: with the environment variables unset, every gated path returns 503 and
 * nothing is served. Configure in the Vercel project (never in this repository):
 *
 *   ADMIN_PASSWORD    the shared password
 *   ADMIN_EMAILS      comma-separated addresses allowed to use it
 *   SESSION_SECRET    long random string; signs the session cookie
 *   SESSION_HOURS     optional, default 12
 */

const ENC = new TextEncoder();

/* ---------------------------------------------------------------- base64url */
export function b64urlEncode(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(str) {
    let s = String(str).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

/* ---------------------------------------------------------------- primitives */
function getCrypto() {
    if (typeof crypto !== 'undefined' && crypto.subtle) return crypto;
    if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) return globalThis.crypto;
    return null;
}

async function hmac(secret, message) {
    const c = getCrypto();
    const key = await c.subtle.importKey('raw', ENC.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await c.subtle.sign('HMAC', key, ENC.encode(message)));
}

async function sha256(text) {
    const c = getCrypto();
    return new Uint8Array(await c.subtle.digest('SHA-256', ENC.encode(String(text))));
}

export function equalBytes(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
}

export async function passwordMatches(given, expected) {
    if (typeof given !== 'string' || typeof expected !== 'string' || !expected) return false;
    return equalBytes(await sha256(given), await sha256(expected));
}

/* ---------------------------------------------------------------- admin list */
export function parseAdmins(raw) {
    return String(raw || '')
        .split(/[,\s;]+/)
        .map(function (e) { return e.trim().toLowerCase(); })
        .filter(function (e) { return e.indexOf('@') > 0; });
}

export function isAdminEmail(email, admins) {
    const e = String(email || '').trim().toLowerCase();
    return !!e && admins.indexOf(e) >= 0;
}

/* ---------------------------------------------------------------- session cookie */
export async function createSession(email, secret, hours, nowMs) {
    const now = Math.floor((nowMs === undefined ? Date.now() : nowMs) / 1000);
    const payload = JSON.stringify({ e: String(email).toLowerCase(), x: now + Math.round((hours || 12) * 3600) });
    const body = b64urlEncode(ENC.encode(payload));
    return body + '.' + b64urlEncode(await hmac(secret, body));
}

export async function readSession(token, secret, nowMs) {
    if (typeof token !== 'string' || token.indexOf('.') < 0) return null;
    const cut = token.lastIndexOf('.');
    const body = token.slice(0, cut), sig = token.slice(cut + 1);
    if (!body || !sig) return null;
    let expected;
    try { expected = await hmac(secret, body); } catch (e) { return null; }
    let given;
    try { given = b64urlDecode(sig); } catch (e) { return null; }
    if (!equalBytes(given, expected)) return null;
    let claim;
    try { claim = JSON.parse(new TextDecoder().decode(b64urlDecode(body))); } catch (e) { return null; }
    if (!claim || typeof claim.e !== 'string' || typeof claim.x !== 'number') return null;
    const now = Math.floor((nowMs === undefined ? Date.now() : nowMs) / 1000);
    if (claim.x <= now) return null;
    return { email: claim.e, expires: claim.x };
}

/* ---------------------------------------------------------------- cookies */
export function parseCookies(header) {
    const out = {};
    String(header || '').split(';').forEach(function (part) {
        const i = part.indexOf('=');
        if (i < 0) return;
        const k = part.slice(0, i).trim();
        if (k) out[k] = decodeURIComponent(part.slice(i + 1).trim());
    });
    return out;
}

export function cookie(name, value, options) {
    const o = options || {};
    let s = name + '=' + encodeURIComponent(value) + '; Path=/; SameSite=Lax';
    if (o.httpOnly !== false) s += '; HttpOnly';
    if (o.secure !== false) s += '; Secure';
    s += '; Max-Age=' + (o.maxAge === undefined ? 0 : Math.max(0, Math.round(o.maxAge)));
    return s;
}

/* ---------------------------------------------------------------- paths */
export const PUBLIC_EXACT = [
    '/', '/index.html', '/robots.txt', '/favicon.ico', '/favicon.svg',
    '/dna_hero.js', '/motion.js', '/cinema.js', '/public_landing.js'
];
export const PUBLIC_PREFIX = ['/images/', '/fonts/'];
export const PUBLIC_SUFFIX = ['.css', '.woff', '.woff2', '.ttf', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.avif'];
export const AUTH_PREFIX = '/auth/';
export const LOGIN_PATH = '/login';

export function isPublicPath(pathname) {
    const p = String(pathname || '/').split('?')[0].toLowerCase();
    if (PUBLIC_EXACT.indexOf(p) >= 0) return true;
    for (let i = 0; i < PUBLIC_PREFIX.length; i++) if (p.indexOf(PUBLIC_PREFIX[i]) === 0) return true;
    for (let i = 0; i < PUBLIC_SUFFIX.length; i++) {
        const s = PUBLIC_SUFFIX[i];
        if (p.length > s.length && p.slice(-s.length) === s) return true;
    }
    return false;
}

export function safeNext(raw) {
    const v = String(raw || '');
    if (!v || v[0] !== '/' || v.indexOf('//') === 0 || v.indexOf('\\') >= 0) return '/';
    return v;
}

const SESSION_COOKIE = 'ramrt_session';
const WHO_COOKIE = 'ramrt_admin';

function env(name, fallback) {
    const v = typeof process !== 'undefined' && process.env ? process.env[name] : undefined;
    return v === undefined || v === '' ? fallback : v;
}

function html(body, status, extraHeaders) {
    const h = new Headers(extraHeaders || {});
    h.set('Content-Type', 'text/html; charset=utf-8');
    h.set('Cache-Control', 'no-store');
    h.set('X-Robots-Tag', 'noindex, nofollow');
    return new Response(body, { status: status || 200, headers: h });
}

function redirect(to, extraHeaders) {
    const h = new Headers(extraHeaders || {});
    h.set('Location', to);
    h.set('Cache-Control', 'no-store');
    return new Response(null, { status: 302, headers: h });
}

function vercelNext() {
    const h = new Headers();
    h.set('x-middleware-next', '1');
    return new Response(null, { headers: h });
}

function getHeader(req, name) {
    if (!req || !req.headers) return '';
    if (typeof req.headers.get === 'function') return req.headers.get(name) || '';
    return req.headers[name.toLowerCase()] || req.headers[name] || '';
}

/* ---------------------------------------------------------------- pages */
const STYLE = `
:root { --deep:#011d1c; --kelp:#052e2b; --line:#0d4a45; --aqua:#3fd0c9; --phos:#cbfffc;
        --silver:#9ec9c5; --text:#eafffd; }
* { box-sizing: border-box; }
body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
       background: radial-gradient(1200px 600px at 50% -10%, #08403b 0%, var(--deep) 60%);
       color: var(--text); font: 15px/1.6 "Segoe UI", system-ui, -apple-system, sans-serif; padding: 24px; }
.card { width:100%; max-width:420px; background:var(--kelp); border:1px solid var(--line);
        border-radius:16px; padding:28px 26px 24px; }
.kicker { font-size:10px; letter-spacing:.18em; text-transform:uppercase; color:var(--aqua); margin:0 0 6px; }
h1 { font-size:22px; font-weight:500; margin:0 0 4px; }
p.sub { color:var(--silver); font-size:13px; margin:0 0 22px; }
label { display:block; font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--silver); margin:0 0 6px; }
input { width:100%; padding:11px 13px; margin:0 0 16px; background:var(--deep); color:var(--text);
        border:1px solid var(--line); border-radius:8px; font:inherit; }
input:focus { outline:none; border-color:var(--aqua); }
button { width:100%; padding:12px; border:0; border-radius:8px; cursor:pointer; font:inherit; font-weight:600;
         letter-spacing:.06em; text-transform:uppercase; font-size:12px;
         background:linear-gradient(135deg,var(--phos),#fde9ff); color:#04302c; }
.err { background:rgba(255,90,90,.12); border:1px solid rgba(255,120,120,.45); color:#ffd9d9;
       border-radius:8px; padding:10px 12px; font-size:13px; margin:0 0 18px; }
.soon { border-top:1px solid var(--line); margin-top:22px; padding-top:16px; }
.soon h2 { font-size:13px; font-weight:600; margin:0 0 4px; }
.soon p { color:var(--silver); font-size:12.5px; margin:0; }
.foot { color:var(--silver); font-size:11.5px; margin:18px 0 0; text-align:center; }
a { color:var(--aqua); }
`;

function page(inner, title) {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title} · RAMRT</title><style>${STYLE}</style></head><body><div class="card">${inner}</div></body></html>`;
}

function loginPage(message, nextPath) {
    const err = message ? `<div class="err">${message}</div>` : '';
    return page(`
    <p class="kicker">RAMRT // Immunopathology</p>
    <h1>Admin sign-in</h1>
    <p class="sub">Renal allograft risk terminal · PGIMER Chandigarh</p>
    ${err}
    <form method="post" action="/auth/login">
      <input type="hidden" name="next" value="${(nextPath || '/').replace(/"/g, '&quot;')}">
      <label for="email">Admin e-mail</label>
      <input id="email" name="email" type="email" autocomplete="username" required autofocus>
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required>
      <button type="submit">Sign in</button>
    </form>
    <div class="soon">
      <h2>User accounts — coming soon</h2>
      <p>Access to the calculator dashboard is limited to the study administrators while
         user accounts are being set up.</p>
    </div>
    <p class="foot"><a href="/">← Back to the site</a></p>`, 'Admin sign-in');
}

function notConfiguredPage() {
    return page(`
    <p class="kicker">RAMRT // Immunopathology</p>
    <h1>Sign-in is not configured</h1>
    <p class="sub">The terminal is closed until ADMIN_PASSWORD, ADMIN_EMAILS and SESSION_SECRET
       are set in the Vercel project. Nothing is served in the meantime.</p>
    <p class="foot"><a href="/">← Back to the site</a></p>`, 'Not configured');
}

/* ---------------------------------------------------------------- request logic */
async function handleRequest(request) {
    const rawUrl = request?.url || '/';
    const host = getHeader(request, 'host') || 'localhost';
    let url;
    try {
        url = new URL(rawUrl, rawUrl.startsWith('http') ? undefined : `https://${host}`);
    } catch (_) {
        url = new URL('/', `https://${host}`);
    }
    const path = url.pathname;

    const secret = env('SESSION_SECRET');
    const password = env('ADMIN_PASSWORD');
    const admins = parseAdmins(env('ADMIN_EMAILS'));
    const hours = Number(env('SESSION_HOURS', '12')) || 12;
    const configured = !!(secret && password && admins.length);

    const cookies = parseCookies(getHeader(request, 'cookie'));
    const session = configured ? await readSession(cookies[SESSION_COOKIE], secret) : null;

    /* ---- sign out */
    if (path === AUTH_PREFIX + 'logout') {
        const h = new Headers();
        h.append('Set-Cookie', cookie(SESSION_COOKIE, '', { maxAge: 0 }));
        h.append('Set-Cookie', cookie(WHO_COOKIE, '', { maxAge: 0, httpOnly: false }));
        return redirect('/', h);
    }

    /* ---- sign in */
    if (path === AUTH_PREFIX + 'login') {
        if (!configured) return html(notConfiguredPage(), 503);
        if (request?.method !== 'POST') return redirect(LOGIN_PATH);
        let form;
        try {
            form = await request.formData();
        } catch (e) {
            return html(loginPage('Could not read that form.', '/'), 400);
        }
        const email = String(form.get('email') || '');
        const target = safeNext(form.get('next'));
        const ok = await passwordMatches(String(form.get('password') || ''), password);
        const listed = isAdminEmail(email, admins);

        if (!ok || !listed) {
            await new Promise(function (r) { setTimeout(r, 400); });
            return html(listed
                ? loginPage('That password is not correct.', target)
                : loginPage('That address is not an administrator. User accounts are coming soon.', target), 401);
        }
        const token = await createSession(email, secret, hours);
        const h = new Headers();
        h.append('Set-Cookie', cookie(SESSION_COOKIE, token, { maxAge: hours * 3600 }));
        h.append('Set-Cookie', cookie(WHO_COOKIE, email.trim().toLowerCase(), { maxAge: hours * 3600, httpOnly: false }));
        return redirect(target, h);
    }

    /* ---- the sign-in page itself */
    if (path === LOGIN_PATH) {
        if (!configured) return html(notConfiguredPage(), 503);
        if (session) return redirect(safeNext(url.searchParams.get('next')));
        return html(loginPage('', safeNext(url.searchParams.get('next'))));
    }

    /* ---- everything else */
    if (isPublicPath(path)) return vercelNext();
    if (!configured) return html(notConfiguredPage(), 503);
    if (session) return vercelNext();

    const acceptHeader = getHeader(request, 'accept') || '';
    const wantsHtml = acceptHeader.indexOf('text/html') >= 0;
    if (wantsHtml) return redirect(LOGIN_PATH + '?next=' + encodeURIComponent(path + url.search));
    return new Response('Sign in at /login to use the RAMRT terminal.', {
        status: 401,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
    });
}

/* ---------------------------------------------------------------- entrypoint */
export default async function proxy(request) {
    try {
        return await handleRequest(request);
    } catch (err) {
        console.error('Middleware execution error:', err);
        return new Response('Middleware Error: ' + (err?.stack || err?.message || String(err)), {
            status: 500,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }
}

export { proxy as middleware, proxy };
