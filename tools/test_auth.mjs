/*
 * test_auth.mjs — offline checks on the access gate's decisions (auth_core.mjs).
 *
 *     node tools/test_auth.mjs
 *
 * These run the same functions the edge runs, so signing, tampering, expiry, the admin
 * list and the public/gated split are all covered here. What they cannot cover is
 * Vercel actually invoking middleware.js before serving a file - that has to be proven
 * on a deployment. See validation/ACCESS_CONTROL.md.
 */
import {
    parseAdmins, isAdminEmail, passwordMatches, equalBytes,
    createSession, readSession, parseCookies, cookie, isPublicPath, safeNext,
    b64urlEncode, b64urlDecode
} from '../auth_core.mjs';

let pass = 0, fail = 0;
function ok(name, cond) {
    if (cond) { pass++; } else { fail++; console.log('  FAIL  ' + name); }
}
async function section(name, fn) { console.log('\n' + name); await fn(); }

const SECRET = 'test-secret-do-not-use-in-production-0123456789';
const ADMINS = parseAdmins('topquark200@example.test, amit.addi2010@example.test ,researchpgimer@example.test');

await section('admin list', async function () {
    ok('three addresses parsed', ADMINS.length === 3);
    ok('case and space insensitive', isAdminEmail('  TopQuark200@Example.TEST ', ADMINS));
    ok('unknown address rejected', !isAdminEmail('someone@example.test', ADMINS));
    ok('empty rejected', !isAdminEmail('', ADMINS));
    ok('substring is not a match', !isAdminEmail('xtopquark200@example.test', ADMINS));
    ok('blank env gives no admins', parseAdmins('').length === 0);
    ok('junk env gives no admins', parseAdmins('not-an-address, also-not').length === 0);
});

await section('password', async function () {
    ok('correct password matches', await passwordMatches('correct horse battery', 'correct horse battery'));
    ok('wrong password rejected', !await passwordMatches('Correct horse battery', 'correct horse battery'));
    ok('prefix rejected', !await passwordMatches('correct horse', 'correct horse battery'));
    ok('empty submission rejected', !await passwordMatches('', 'correct horse battery'));
    ok('unset expected password rejects everything', !await passwordMatches('anything', ''));
    ok('equalBytes: length mismatch is false', !equalBytes(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3])));
    ok('equalBytes: equal is true', equalBytes(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])));
});

await section('session cookie', async function () {
    const token = await createSession('topquark200@example.test', SECRET, 12);
    const read = await readSession(token, SECRET);
    ok('round trip returns the address', read && read.email === 'topquark200@example.test');

    ok('another secret does not verify', !await readSession(token, SECRET + 'x'));

    const [body, sig] = token.split('.');
    ok('flipped signature rejected', !await readSession(body + '.' + sig.slice(0, -1) + (sig.slice(-1) === 'A' ? 'B' : 'A'), SECRET));

    const forged = b64urlEncode(new TextEncoder().encode(JSON.stringify({ e: 'intruder@example.test', x: 2000000000 })));
    ok('payload swapped for another address rejected', !await readSession(forged + '.' + sig, SECRET));
    ok('unsigned payload rejected', !await readSession(forged, SECRET));
    ok('empty token rejected', !await readSession('', SECRET));
    ok('garbage token rejected', !await readSession('nonsense', SECRET));
    ok('null token rejected', !await readSession(null, SECRET));

    const expired = await createSession('topquark200@example.test', SECRET, 12, Date.now() - 13 * 3600 * 1000);
    ok('expired session rejected', !await readSession(expired, SECRET));
    const fresh = await createSession('topquark200@example.test', SECRET, 12, Date.now() - 11 * 3600 * 1000);
    ok('session still inside its window accepted', !!await readSession(fresh, SECRET));

    ok('base64url round trip', new TextDecoder().decode(b64urlDecode(b64urlEncode(new TextEncoder().encode('a+/b=c')))) === 'a+/b=c');
});

await section('cookies', async function () {
    const c = parseCookies('ramrt_session=abc.def; ramrt_admin=a%40b.test; other=1');
    ok('session read', c.ramrt_session === 'abc.def');
    ok('percent-encoding decoded', c.ramrt_admin === 'a@b.test');
    ok('missing header is empty', Object.keys(parseCookies(null)).length === 0);
    const set = cookie('ramrt_session', 'v', { maxAge: 3600 });
    ok('HttpOnly set', set.indexOf('HttpOnly') >= 0);
    ok('Secure set', set.indexOf('Secure') >= 0);
    ok('SameSite set', set.indexOf('SameSite=Lax') >= 0);
    ok('readable companion cookie is not HttpOnly', cookie('ramrt_admin', 'v', { maxAge: 10, httpOnly: false }).indexOf('HttpOnly') < 0);
});

await section('public vs gated', async function () {
    ['/', '/index.html', '/dashboard_theme.css', '/cinema.css', '/images/amit-raj-saraswat.jpg',
     '/dna_hero.js', '/motion.js', '/cinema.js', '/robots.txt', '/favicon.ico']
        .forEach(function (p) { ok('public: ' + p, isPublicPath(p)); });

    ['/app.js', '/hla_engine.js', '/hla_reference_data.js', '/hla_reference_v3.js', '/hla_molecular_data.js',
     '/hla_ui.js', '/dashboard_home.js', '/hla_validation_vectors.js', '/reference_sources/IE.xlsx',
     '/validation/HLAR_CROSSCHECK.md', '/tools/test_engine.js', '/vercel.json', '/package.json',
     '/auth_core.mjs', '/middleware.js']
        .forEach(function (p) { ok('gated: ' + p, !isPublicPath(p)); });

    ok('case does not open a gate', !isPublicPath('/HLA_Reference_Data.JS'));
    ok('a new unknown script is gated by default', !isPublicPath('/something_new.js'));
    ok('query string does not open a gate', !isPublicPath('/hla_reference_data.js?x=1'));
});

await section('redirect target', async function () {
    ok('relative path kept', safeNext('/dashboard') === '/dashboard');
    ok('empty becomes root', safeNext('') === '/');
    ok('absolute URL refused', safeNext('https://example.test/x') === '/');
    ok('protocol-relative refused', safeNext('//example.test/x') === '/');
    ok('backslash trick refused', safeNext('/\\example.test') === '/');
});

console.log('\nTOTAL: pass ' + pass + ', fail ' + fail);
process.exit(fail ? 1 : 0);
