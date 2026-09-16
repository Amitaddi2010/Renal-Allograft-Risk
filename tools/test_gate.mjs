/*
 * test_gate.mjs — drives middleware.mjs itself, the way Vercel will.
 *
 *     node tools/test_gate.mjs
 *
 * Builds real Request objects, calls the exported handler and checks what comes back:
 * who is let through, who is turned away, what the sign-in form accepts, and that an
 * unconfigured deployment serves nothing. The one thing it cannot prove is that Vercel
 * runs this file before serving a static file - that needs a deployment.
 */
process.env.ADMIN_PASSWORD = 'test-password-not-the-real-one';
process.env.ADMIN_EMAILS = 'topquark200@example.test, amit.addi2010@example.test, researchpgimer@example.test';
process.env.SESSION_SECRET = 'test-session-secret-0123456789abcdef';
process.env.SESSION_HOURS = '12';

const { default: middleware } = await import('../middleware.mjs');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
    if (cond) { pass++; } else { fail++; console.log('  FAIL  ' + name + (detail ? '  [' + detail + ']' : '')); }
}
function req(path, init) {
    const o = init || {};
    const headers = new Headers(o.headers || {});
    return new Request('https://renal-allograft-risk.vercel.app' + path, { method: o.method || 'GET', headers, body: o.body });
}
function form(fields) {
    const b = new URLSearchParams(fields);
    return { method: 'POST', body: b, headers: { 'content-type': 'application/x-www-form-urlencoded' } };
}
const HTML = { accept: 'text/html,application/xhtml+xml' };
// The pass-through @vercel/functions builds: a 200 carrying x-middleware-next.
function passedThrough(res) { return res.status === 200 && res.headers.get('x-middleware-next') === '1'; }
function sessionFrom(res) {
    const all = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')];
    const c = all.filter(Boolean).find(function (s) { return s.indexOf('ramrt_session=') === 0; });
    return c ? c.split(';')[0].split('=')[1] : null;
}

console.log('signed out');
{
    ok('landing passes through', passedThrough(await middleware(req('/', { headers: HTML }))));
    ok('stylesheet passes through', passedThrough(await middleware(req('/dashboard_theme.css'))));
    ok('portrait passes through', passedThrough(await middleware(req('/images/heera-singh.jpg'))));

    const engine = await middleware(req('/hla_reference_data.js'));
    ok('reference data refused', engine.status === 401, 'got ' + engine.status);
    const cat = await middleware(req('/reference_sources/IE.xlsx'));
    ok('eplet catalogue refused', cat.status === 401, 'got ' + cat.status);
    const app = await middleware(req('/app.js'));
    ok('risk model script refused', app.status === 401, 'got ' + app.status);
    ok('refusal is not cached', (app.headers.get('cache-control') || '').indexOf('no-store') >= 0);

    const page = await middleware(req('/validation/HLAR_CROSSCHECK.md', { headers: HTML }));
    ok('a page request is sent to sign-in', page.status === 302 &&
        page.headers.get('location').indexOf('/login?next=') === 0, page.headers.get('location'));

    const login = await middleware(req('/login', { headers: HTML }));
    ok('sign-in page served', login.status === 200);
    const body = await login.text();
    ok('sign-in page offers the form', body.indexOf('name="password"') > 0);
    ok('sign-in page says accounts are coming', body.indexOf('coming soon') > 0);
    ok('sign-in page is not indexable', body.indexOf('noindex') > 0);
}

console.log('signing in');
let token = null;
{
    const bad = await middleware(req('/auth/login', form({ email: 'topquark200@example.test', password: 'wrong', next: '/' })));
    ok('wrong password refused', bad.status === 401);
    ok('wrong password sets no cookie', !sessionFrom(bad));
    ok('wrong password does not say the address was fine', (await bad.text()).indexOf('password is not correct') > 0);

    const stranger = await middleware(req('/auth/login', form({ email: 'stranger@example.test', password: 'test-password-not-the-real-one', next: '/' })));
    ok('unlisted address refused even with the password', stranger.status === 401);
    ok('unlisted address sets no cookie', !sessionFrom(stranger));
    ok('unlisted address is told accounts are coming', (await stranger.text()).indexOf('coming soon') > 0);

    const good = await middleware(req('/auth/login', form({ email: 'TopQuark200@Example.test', password: 'test-password-not-the-real-one', next: '/index.html' })));
    ok('admin accepted', good.status === 302, 'got ' + good.status);
    ok('sent to the requested page', good.headers.get('location') === '/index.html');
    token = sessionFrom(good);
    ok('session cookie issued', !!token);

    const off = await middleware(req('/auth/login', { method: 'GET', headers: HTML }));
    ok('GET on the login endpoint just shows the form', off.status === 302 && off.headers.get('location') === '/login');

    const away = await middleware(req('/auth/login', form({ email: 'topquark200@example.test', password: 'test-password-not-the-real-one', next: 'https://elsewhere.test/x' })));
    ok('cannot be bounced to another site', away.headers.get('location') === '/');
}

console.log('signed in');
{
    const c = { cookie: 'ramrt_session=' + token };
    ok('reference data now served', passedThrough(await middleware(req('/hla_reference_data.js', { headers: c }))));
    ok('eplet catalogue now served', passedThrough(await middleware(req('/reference_sources/IE.xlsx', { headers: c }))));
    ok('risk model script now served', passedThrough(await middleware(req('/app.js', { headers: c }))));

    const back = await middleware(req('/login', { headers: Object.assign({}, c, HTML) }));
    ok('sign-in page redirects an admin away', back.status === 302);

    const tampered = { cookie: 'ramrt_session=' + token.slice(0, -2) + 'ZZ' };
    ok('tampered cookie refused', (await middleware(req('/app.js', { headers: tampered }))).status === 401);
    ok('no cookie still refused', (await middleware(req('/app.js'))).status === 401);

    const out = await middleware(req('/auth/logout', { headers: c }));
    const cleared = out.headers.getSetCookie().join(' | ');
    ok('sign out redirects home', out.status === 302 && out.headers.get('location') === '/');
    ok('sign out expires the session cookie', cleared.indexOf('ramrt_session=; Path=/') >= 0 && cleared.indexOf('Max-Age=0') >= 0);
}

console.log('not configured');
{
    delete process.env.ADMIN_PASSWORD;
    delete process.env.SESSION_SECRET;
    const shut = await middleware(req('/hla_reference_data.js'));
    ok('gated file refused when unconfigured', shut.status === 503, 'got ' + shut.status);
    const tryLogin = await middleware(req('/auth/login', form({ email: 'topquark200@example.test', password: '', next: '/' })));
    ok('empty password cannot sign in', tryLogin.status === 503 || tryLogin.status === 401);
    ok('landing still public when unconfigured', passedThrough(await middleware(req('/', { headers: HTML }))));
}

console.log('\nTOTAL: pass ' + pass + ', fail ' + fail);
process.exit(fail ? 1 : 0);
