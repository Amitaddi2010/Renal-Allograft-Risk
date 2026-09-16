/*
 * auth_core.mjs — the decisions behind the access gate, kept apart from the request
 * handling in middleware.js so they can be tested offline (node tools/test_auth.mjs).
 *
 * Model: the landing page is public. Everything the calculator needs — the app script
 * with the risk model, the HLA engine, the reference tables, the immunogenic eplet
 * catalogue, validation files — is served only to a signed-in admin.
 *
 * Credential: one shared password held in a Vercel environment variable. The address
 * typed alongside it must be on the admin list. Be clear about what that does and does
 * not prove: the password is the credential, the address only records which of the
 * admins is claiming the session. Anyone holding the password can type any of the
 * listed addresses. Per-person proof needs per-person secrets or Google sign-in.
 *
 * Nothing here touches patient data: the session cookie carries an address and an
 * expiry, and no typing or result ever leaves the browser.
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
async function hmac(secret, message) {
    const key = await crypto.subtle.importKey('raw', ENC.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', key, ENC.encode(message)));
}

async function sha256(text) {
    return new Uint8Array(await crypto.subtle.digest('SHA-256', ENC.encode(String(text))));
}

// Compares in time that does not depend on where the first difference is.
export function equalBytes(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
}

// Both sides are hashed first, so the comparison is over two fixed-length digests and
// the length of the submitted password does not leak through timing.
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
// token = base64url({"e":<email>,"x":<expiry, epoch seconds>}) + "." + base64url(HMAC)
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
    if (!equalBytes(given, expected)) return null;                 // forged or tampered
    let claim;
    try { claim = JSON.parse(new TextDecoder().decode(b64urlDecode(body))); } catch (e) { return null; }
    if (!claim || typeof claim.e !== 'string' || typeof claim.x !== 'number') return null;
    const now = Math.floor((nowMs === undefined ? Date.now() : nowMs) / 1000);
    if (claim.x <= now) return null;                               // expired
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

/* ---------------------------------------------------------------- what is public
 * Deny by default: a path is served without a session only if it is named here, so a
 * new data file added later is gated until someone deliberately opens it up. CSS and
 * images carry no study data and the landing page needs them.
 */
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

// Where to send someone after signing in. Only a path on this site is accepted, so a
// crafted ?next= cannot bounce an admin to another origin.
export function safeNext(raw) {
    const v = String(raw || '');
    if (!v || v[0] !== '/' || v.indexOf('//') === 0 || v.indexOf('\\') >= 0) return '/';
    return v;
}
