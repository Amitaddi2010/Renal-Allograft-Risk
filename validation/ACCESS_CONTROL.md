# Access control

How the terminal is closed to the public, what that does and does not prove, and how to
set it up. Status: **written and tested offline; never yet deployed.** Until the steps in
§4 are done, the production site is open to anyone with the URL.

## 1. Where the gate is

`middleware.js`, running on Vercel before any file is served. This is the only thing
that protects the study data. A sign-in drawn inside the page would not: the site is
static, so anyone could skip it and request `/hla_reference_data.js` or
`/reference_sources/IE.xlsx` directly. Those requests pass through the middleware first.

`auth_core.mjs` holds the decisions (what is public, signing and reading the session
cookie, the admin list, the password check) so they can be tested without a deployment.

## 2. What is public and what is gated

Deny by default: a path is served to a signed-out visitor only if `auth_core.mjs` names
it. A data file added later is gated until someone deliberately opens it up.

| | |
|---|---|
| **Public** | `/`, `/index.html`, every `.css`, everything under `/images/`, the animation scripts (`dna_hero.js`, `motion.js`, `cinema.js`), `public_landing.js`, `robots.txt`, favicons |
| **Admin only** | `app.js` (the locked risk model), the whole HLA engine and its reference tables, `hla_reference_data.js`, `reference_sources/IE.xlsx`, `dashboard_home.js`, `validation/`, `tools/`, `package.json`, `vercel.json`, and anything not listed as public |

A signed-out visitor therefore sees the landing page — hero, cohort figures, features,
evidence, About — but cannot obtain the model, the engine or the catalogue. Because
`app.js` is withheld, `public_landing.js` keeps the page working: navigation and anchors
still function, anything that opens the calculator goes to `/login`, and the live sandbox
says it needs a sign-in rather than displaying the figure sitting in the markup.

## 3. Who gets in

One shared password (`ADMIN_PASSWORD`), plus an address that must be on `ADMIN_EMAILS`.

**Be clear about what this proves.** The password is the credential. The address only
records which administrator is claiming the session — anyone holding the password can
type any of the listed addresses. It is not per-person authentication, and the audit
value of the address is therefore weak. Per-person proof needs either per-person secrets
or Google sign-in with the same allowlist, which is a straightforward change to
`middleware.js` if you want it later.

Session: a cookie signed with HMAC-SHA-256 over `{address, expiry}`, `HttpOnly`,
`Secure`, `SameSite=Lax`, default 12 hours. A tampered or expired cookie is refused. A
second cookie, `ramrt_admin`, holds only the address and is readable by the page so it
can show "signed in as … · sign out"; it is not a credential and forging it grants
nothing.

Known gaps, deliberately not solved yet:

- **No rate limiting.** A failed sign-in waits 400 ms, which is friction, not a defence.
  Real throttling needs shared state (Vercel KV or Edge Config). Choose a long random
  password and the exposure is small; a short one will eventually be guessed.
- **No per-person audit trail**, for the reason above.
- **No password rotation reminder.** Rotating means editing one environment variable and
  redeploying; every existing session survives unless `SESSION_SECRET` is rotated too.
- **The middleware runs on every request**, including public assets, and is billed as
  fluid compute. At this traffic level that is negligible, but it is not free.

## 4. Setting it up (Vercel project settings)

1. **Environment variables** → add for Production *and* Preview:

   | Name | Value |
   |---|---|
   | `ADMIN_PASSWORD` | a long random password, generated, not chosen |
   | `ADMIN_EMAILS` | the three administrator addresses, comma-separated |
   | `SESSION_SECRET` | 32+ random bytes, e.g. `openssl rand -base64 32` |
   | `SESSION_HOURS` | optional, default `12` |

   None of these belong in this repository. If a value ever lands in a commit, change it.

2. **Deploy the `private-integrations` branch** and check the preview URL, signed out:

   ```
   curl -I <preview>/                        # 200, the landing page
   curl -I <preview>/hla_reference_data.js   # 401
   curl -I <preview>/reference_sources/IE.xlsx  # 401
   curl -I <preview>/app.js                  # 401
   ```

   If any of those returns 200, the middleware is not running — stop and fix that before
   merging. See §5.

3. Sign in at `<preview>/login` with an administrator address and the password, then
   repeat the three requests in a browser: they must now return the files.

4. Only then merge to `main`.

## 5. If the middleware does not run

The project has no framework, so Vercel is told where the entrypoint is by `proxy` in
`vercel.json` pointing to `middleware.js`. If the gate does not fire, check in this order:

1. the build log shows `@vercel/functions` installed from `package.json`;
2. `vercel.json` still contains `"proxy": { "entrypoint": "middleware.js" }`;
3. the Functions tab lists a middleware invocation for a request;
4. the environment variables are set for the environment you are testing.

While the gate is not proven, **Deployment Protection → Vercel Authentication → All
Deployments** closes the site immediately and for free, and can be turned off once the
middleware is confirmed.

## 6. Tests

```
node tools/test_auth.mjs     # 65 checks: the decisions
node tools/test_gate.mjs     # 34 checks: the middleware itself, driven with real Requests
node tools/test_engine.js    # 248 checks: unchanged by any of this
```

`test_gate.mjs` calls the exported handler exactly as Vercel will and checks who is let
through, who is turned away, the sign-in form, the redirect target, cookie tampering,
expiry, sign-out, and that an unconfigured deployment serves nothing.

What no test here can prove: that Vercel actually invokes `middleware.js` before serving
a static file. Only the deployment checks in §4 show that.
