# M0a: Backend skeleton, tooling and CI

Part of M0 ([M0-skeleton.md](M0-skeleton.md)), split per `workflow.md` §8. Checkpoint: **plan**
(approved by the owner in PR #10) and merge. M0b (the frontend) follows on its own branch.

## Goal

Every repository-level check exists and passes in CI, the security middleware is in place, and
the event log and SSE stream work end to end with a test event. No frontend code: the UI design
is reviewed separately, before M0b.

## Read first

`AGENTS.md`; `M0-skeleton.md`; `docs/architecture.md` (all); `docs/realtime-events.md` §1–3, §5;
`docs/security.md` §2.1, §2.6, §2.8–2.11; `docs/testing.md` §1, §2, §4; `docs/porting-guide.md`
§1; decisions D34, D35.

## In scope

- pnpm workspace with `shared/` and `backend/` (the `frontend/` package comes in M0b), the layout
  from `architecture.md` §4; Node 24 LTS pinned (`.nvmrc`, `engines`, `engine-strict=true`,
  `packageManager` pinned to an exact pnpm); root scripts for every command in `AGENTS.md` §4
  except `gen:api` and `e2e` (M0b); `Makefile` with `dev` (backend only until M0b), `test`,
  `lint`, `seed` (a stub).
- Backend: Hono on `@hono/node-server`, `app/main.ts` (composition root), `app/config.ts` (env
  parsed with Zod, including `APP_ENV`, `FAKE_MODEL`, `LOG_LEVEL`, `architecture.md` §8), Pino
  logging, Drizzle on `better-sqlite3` (WAL, `foreign_keys=ON`, `busy_timeout`, write
  transactions with `BEGIN IMMEDIATE`, `architecture.md` §11), drizzle-kit with an initial
  migration containing **only** `events` and `settings`, and `db:generate`, `db:migrate`,
  `db:check` scripts.
- Ports and adapters (D35): `core/ports/` with the transport, repositories + unit of work,
  queue, model, prices, workspace, clock and ids interfaces (types only where the adapter comes
  in a later slice); adapters for transport (SSE), db, clock and ids (`uuidv7` + `typeid-js`,
  D22, D36), the Drizzle TypeID column type and the `ids decode` CLI command; the contract-suite
  runner in `backend/test/contracts/` with the transport and unit-of-work suites.
- Import rules: `.dependency-cruiser.cjs` with the rules in `architecture.md` §4.1 (frontend
  rules included, so M0b inherits them), run by `pnpm lint`, plus one deliberately bad import in
  a test fixture proving the rule fires.
- Folder indexes (`architecture.md` §4.2): a `README.md` index in every † folder that exists
  after M0a, and `pnpm check:index`.
- `shared/`: the event envelope, `ready`, `reset` and `test.ping` as Zod schemas, branded ids,
  error codes.
- Event layer: `appendEvent()` inside the unit of work, in-process hub, `GET /api/stream` with
  `Last-Event-ID` replay, `ready`, `reset`, heartbeat; `GET /api/health`
  (`worker: "not_started"`, `api.md` §7); `GET /api/openapi.json`.
- `scripts/check-events.ts` with the `PENDING` list (`realtime-events.md` §4).
- Test endpoint `POST /api/_test/events` (owner, PR #10): mounted only when `APP_ENV=test` (no
  runtime check inside a mounted handler), body `{note: string ≤ 200}` strict, through the same
  Host, Origin and body-limit middleware as every POST, one `warn` log line at startup when
  enabled, not in the OpenAPI schema. Startup refuses `APP_ENV=test` with
  `NODE_ENV=production`.
- Security middleware in the HTTP adapter, in this order: `secureHeaders` (CSP and the other
  headers, `security.md` §2.1) first, so rejections carry them too; then loopback-only startup
  check, Host check, Origin check, `bodyLimit`, the generic error handler, Pino redaction of
  secrets.
- Fake model plumbing: `FAKE_MODEL=1` switch and the `fake:scripted` catalog entry, wiring
  `adapters/model/fake/` (no agent yet, just the switch and fixture loader).
- `tsconfig` and ESLint settings from `frontend-conventions.md` §3 for `shared/` and `backend/`,
  the SQL rules from `security.md` §2.8, Prettier.
- CI workflow (GitHub Actions, `actions/setup-node` with `node-version-file: .nvmrc`) running
  every gate in `testing.md` §4 that exists after M0a; Dependabot config (npm and
  `github-actions`); `javascript-typescript` added to the CodeQL matrix; the automated security
  review workflow under the owner's conditions (below).
- `reference/discord-role-bots/` copied in with its README (`porting-guide.md` §1), excluded from
  ESLint, Prettier, Vitest and dependency-cruiser.
- `README.md` quickstart; `.env.example` with every variable in `architecture.md` §8.
- PR template from `workflow.md` §6 as `.github/pull_request_template.md`.

Security review workflow conditions (owner, PR #10): trigger `pull_request` only, never
`pull_request_target`; job guard
`github.event.pull_request.head.repo.full_name == github.repository` plus a path filter for the
`AGENTS.md` §7 paths; the action pinned to a full commit SHA; `permissions:` limited to
`contents: read`, `pull-requests: write`; no other secrets passed; skips cleanly when
`ANTHROPIC_API_KEY` is absent.

## Out of scope

Everything in M0b; any domain table besides `events` and `settings`; the agent; the AI SDK,
prices, queue and workspace adapters; pg-boss; the `db_lock_wait_seconds` metric (a follow-up).

## Acceptance criteria

Numbers are the original M0 numbers.

2. Starting the backend with `HOST=0.0.0.0` exits with a clear error.
3. A POST with `Origin: https://evil.com` gets 403 `origin_rejected`; with a wrong `Host`
   header gets 403. Rejected responses carry the security headers.
4. A test endpoint (enabled only when `APP_ENV=test`) appends an event; a connected SSE client
   receives it with the right `id`; reconnecting with `Last-Event-ID` replays missed events;
   an old cursor gets `reset`.
6. An import from `core/` into an adapter, or between two adapters, fails `pnpm lint`.
7. Adding a file to an indexed folder without listing it in that folder's `README.md` fails
   `pnpm check:index`; so does listing a file that does not exist.
8. The SSE adapter and the Drizzle unit of work pass their contract suites. The unit-of-work
   suite includes the concurrency cases from `architecture.md` §11 that M0's tables allow: two
   transactions racing a compare-and-set on the same row (exactly one wins), a rolled-back
   transaction leaving no event, and `seq` strictly increasing under parallel appends.
10. All CI gates that exist after M0a run and pass on the PR.
11. `docs/` is unchanged except where this slice had to correct something (listed in the PR).

## Tests

API tests for 2–4; contract suites for 8; script tests for 6 and 7 (fixtures with a bad import
and an unlisted file); the security tests in `security.md` §3 that M0a's code allows.

## Needs human review

Initial migration; security middleware; dependency list (approved in PR #10); the port
interfaces (they shape every later slice).
