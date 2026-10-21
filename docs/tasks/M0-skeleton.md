# M0: Skeleton

Checkpoint: **plan** and merge.

## Goal

An empty but production-shaped app: backend and frontend start with one command, every check
in `AGENTS.md` §4 exists and passes in CI, the security middleware is in place, the event log
and SSE stream work end to end with a test event, and the app shell (header, rail, empty pages)
renders. Later slices only add features; they should never need to set up tooling.

## Read first

`AGENTS.md`; `docs/architecture.md` (all); `docs/realtime-events.md` §1–3, §5;
`docs/security.md` §2.1, §2.6, §2.8–2.11; `docs/testing.md` §1, §2, §4; `docs/porting-guide.md` §1; decisions D34, D35;
`docs/requirements/app-shell.md` (layout only); `docs/design/screens.md` §1 (sketch, not final);
`docs/design/themes.md` §2, §3, §5 (D30, proposed).

## In scope

- pnpm workspace with `shared/`, `backend/`, `frontend/` and the layout from `architecture.md`
  §4; Node 24 LTS pinned (`.nvmrc` and `engines`); root scripts for every command in
  `AGENTS.md` §4; `Makefile` with `dev`, `test`, `lint`, `seed` (seed can be a stub).
- Backend: Hono on `@hono/node-server`, `app/main.ts` (composition root), `app/config.ts` (env
  parsed with Zod), Pino logging, Drizzle on `better-sqlite3` (WAL, `foreign_keys=ON`),
  drizzle-kit with an initial migration containing **only** `events` and `settings`, and
  `db:generate`, `db:migrate`, `db:check` scripts.
- Ports and adapters (D35): `core/ports/` with the transport, repositories + unit of work,
  queue, model, prices, workspace, clock and ids interfaces (types only where the adapter comes
  in a later slice); adapters for transport (SSE), db, clock and ids (`uuidv7` + `typeid-js`, D22, D36), the Drizzle
  TypeID column type and the `ids decode` CLI command; the
  contract-suite runner in `backend/test/contracts/` with the transport and unit-of-work suites.
- Import rules: `.dependency-cruiser.cjs` with the rules in `architecture.md` §4.1, run by
  `pnpm lint`, plus one deliberately bad import in a test fixture proving the rule fires.
- Folder indexes (`architecture.md` §4.2): a `README.md` index in every folder marked † that
  exists after M0, and `pnpm check:index` (a small script in `scripts/`) that fails when a file
  or subfolder is missing from its folder's table or the table lists something that does not
  exist.
- `shared/`: the event envelope and the test event as Zod schemas, branded ids, error codes.
- Event layer: `appendEvent()` inside the unit of work, in-process hub, `GET /api/stream` with
  `Last-Event-ID` replay, `ready`, `reset`, heartbeat; `GET /api/health`.
- Security middleware in the HTTP adapter: loopback-only startup check, Host check, Origin
  check, `secureHeaders` with the CSP and other headers (`security.md` §2.1), `bodyLimit`, the
  generic error handler, Pino redaction of secrets.
- Fake model plumbing: `FAKE_MODEL=1` switch and the `fake:scripted` catalog entry, wiring
  `adapters/model/fake/` (no agent yet, just the switch and fixture loader).
- Frontend: Vite + React + TS strict, Tailwind, shadcn/ui on Base UI (D28), TanStack Query,
  TanStack Router with empty pages (Conversation, Bots, Bot detail, Create bot, Skills, Skill
  editor, Settings), app shell with header and rail placeholders, `lib/realtime/` with the SSE
  connection and the reducer skeleton.
  A shared `Skeleton` component (theme tokens, 200 ms delay, reduced-motion aware) used by the
  empty pages' loading state (`requirements/README.md`).
- The transport interface and the SSE adapter, backend and frontend (`realtime-events.md` §1a).
- Theme layer (D30, if accepted): semantic tokens as CSS variables, `frontend/src/themes/` with
  one theme in light and dark, the `data-theme`/`data-mode` attributes with the no-flash
  script, and the lint rule against raw colours (`design/themes.md` §2). The Appearance
  settings UI comes later with the Settings page.
- `tsconfig` and ESLint settings from `frontend-conventions.md` §3 for all three packages, the
  SQL rules from `security.md` §2.8, Prettier.
- API client generation (`pnpm gen:api`) from `/api/openapi.json` (produced by
  `@hono/zod-openapi`) into `frontend/src/lib/api/generated/`, with a CI freshness check. Pick a
  generator that emits TanStack Query hooks and Zod schemas; record the choice in the PR.
- CI workflow (GitHub Actions) running all gates in `testing.md` §4, Dependabot config,
  the automated security review workflow, request body limit and the error handler
  (`security.md` §2.7–2.11).
- `reference/discord-role-bots/` copied in with its README (`porting-guide.md` §1).
- `README.md` quickstart; `.env.example` with every variable in `architecture.md` §6.
- PR template from `workflow.md` §6 as `.github/pull_request_template.md`.

## Out of scope

Any domain table besides `events` and `settings`; real pages; the agent; the AI SDK, prices,
queue and workspace adapters (their slices add them); pg-boss (VPS phase).

## Acceptance criteria

1. `make dev` starts both servers; the browser shows the shell with the "+" button in the rail
   and an empty header.
2. Starting the backend with `HOST=0.0.0.0` exits with a clear error.
3. A POST with `Origin: https://evil.com` gets 403 `origin_rejected`; with a wrong `Host`
   header gets 403.
4. A test endpoint (enabled only when `APP_ENV=test`) appends an event; a connected SSE client
   receives it with the right `id`; reconnecting with `Last-Event-ID` replays missed events;
   an old cursor gets `reset`.
5. `pnpm gen:api` produces a client; CI fails if it is stale.
6. An import from `core/` into an adapter, or between two adapters, fails `pnpm lint`.
7. Adding a file to an indexed folder without listing it in that folder's `README.md` fails
   `pnpm check:index`; so does listing a file that does not exist.
8. The SSE adapter and the Drizzle unit of work pass their contract suites.
9. All CI gates run and pass on the PR.
10. `docs/` is unchanged except where this slice had to correct something (listed in the PR).

## Tests

API tests for 2–4; contract suites for 8; script tests for 6 and 7 (fixtures with a bad
import and an unlisted file); a Vitest test for the stream reducer applying an event
idempotently; a Playwright smoke test that loads the shell.

## Needs human review

The UI design in the plan (layout, components, states), approved before UI code is written
(`docs/workflow.md` §2; sketches in `docs/design/` are not specs).

Initial migration; security middleware; dependency list (all new); the port interfaces
(they shape every later slice).

## Open questions

- D30: accepted or changed, and which theme ships first (owner).
