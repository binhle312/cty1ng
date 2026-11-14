# P3 PR 11: security headers on refused requests and on the dev page

Brief: items 35 and 36 of the P3 list that the owner approved on 2026-11-12 (list PR 11, "Security headers")
Checkpoint: none (security-sensitive code: flagged under `Needs human review`, `AGENTS.md` §7)
Approval: chief agent, 2026-11-15, under the owner's order of 2026-11-14 (P3 questions to consultants); owner review pending. Revision 1. Dev policy: option A (a nonce for each start of the dev server).

## Items

| Item | Defect on `main` (`97221d3`) | How I know |
| --- | --- | --- |
| 35 | A request that the Host check or the Origin check refuses gets no CSP, no `X-Content-Type-Options` and no `Referrer-Policy`. `app.ts` runs the two checks before `securityHeaders`. `docs/security.md` §2.1 says nothing about refused responses; the M0b plan §4 names this order | read `backend/src/adapters/http/app.ts:61-63`; the red run of the new tests |
| 36 | The dev page (`make dev`, Vite) has no CSP and no `frame-ancestors` | read `frontend/vite.config.ts`: `server` has no `headers`; the red run of the new tests |

The M0b plan is a record (`docs/plans/README.md`), so the owning document `docs/security.md` gets
the rule. The plan stays as it is.

## Risk probe (scratch, outside the repository, on `97221d3`)

Vite 8.3.5 API on 127.0.0.1:5300, headless Chromium 1248, no backend:

- The production CSP unchanged on the dev page: the page stays blank (`#root` has 0 children).
  Chromium reports 1 inline script (the React refresh preamble of `@vitejs/plugin-react`) and 3
  inline styles (the `<style>` tags of the Vite client) as CSP violations.
- The production CSP plus `script-src 'self' 'nonce-N'; style-src 'self' 'nonce-N'`, with Vite's
  `html.cspNonce: N` (N = 16 random bytes, made at the start of the server): the page renders,
  the inline script and the 3 `<style>` tags have the nonce, and Chromium reports no CSP error.
- Node answers `400` to an HTTP/1.1 request with no `Host` before the app runs. That answer
  cannot get our headers.

## Change

1. `backend/src/adapters/http/app.ts`: the order becomes request id, access log,
   **security headers**, Host check, Origin check, CORS, body limit. A check throws
   `ApiFailure`; Hono runs the error handler at the level of that check, and the security
   headers middleware adds its headers to that answer after `await next()`. The logic of the
   two checks does not change: they refuse the same requests with the same status and code.
2. `frontend/vite.config.ts`, only for the dev server (`command === "serve"`): `html.cspNonce`
   with a nonce made at each start, and `server.headers` with the production CSP plus the nonce
   in `script-src` and `style-src`, `X-Content-Type-Options: nosniff` and
   `Referrer-Policy: no-referrer`. The build gets no nonce, and the production CSP does not change.
3. `docs/security.md` §2.1: refused answers carry the headers; the dev policy and its nonce.

## Test strategy

| Behaviour | Level | Cases |
| --- | --- | --- |
| A refused request carries the CSP, `nosniff` and `no-referrer`, with the same status and code as before | API (`backend/test/security/host-origin.test.ts`) | malformed Host 400; foreign Host 403; POST with a foreign Origin 403; POST with no Origin 403; GET with a foreign Origin 403; the stream with a foreign Origin 403; a CORS preflight from a foreign Origin 403 |
| The same on the wire | real socket, same file | two Host headers 400; HTTP/1.0 with no Host 400; an absolute URL with a foreign Host 403 |
| The dev page has the CSP with `frame-ancestors 'none'` and the two other headers | real Vite dev server (`scripts/dev-proxy.test.ts`) | `GET /` |
| Each inline script of the dev page has the nonce of the CSP, and the page has Vite's `csp-nonce` meta for the styles that the Vite client adds | real Vite dev server | `GET /` |
| The build has no nonce | config (`scripts/dev-proxy.test.ts`) | the config for `command: "build"` |

The status tests of the two checks stay unchanged: they prove that the checks refuse the same
requests. No order or timing case: the change is the order of middleware in one request, with
no state between requests.

Break list `scripts/breaks/pr-<n>.json` (security tests, `docs/testing.md` §5): the security
headers after the checks again; no `server.headers`; no `html.cspNonce`; a nonce in the build.

The dev probe (evidence in the PR, not a test): backend on 127.0.0.1:8300, Vite on
127.0.0.1:5300, the headers of `/`, one load in headless Chromium with no CSP violation.

## Not claimed

- Node's own `400` (HTTP/1.1 with no `Host`, a parse error) has no security headers: it comes
  before the app.
- After an upgrade of Vite or `@vitejs/plugin-react`, the dev-proxy test checks the served HTML
  only. The styles that the Vite client adds at run time were checked by the one probe.

## Files

`backend/src/adapters/http/app.ts`, a comment in `middleware.ts`,
`backend/test/security/host-origin.test.ts`, `frontend/vite.config.ts`,
`scripts/dev-proxy.test.ts`, `docs/security.md` §2.1, this file and its row in
`docs/plans/README.md`, `scripts/breaks/pr-<n>.json`.
