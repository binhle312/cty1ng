# M0: Skeleton

Checkpoint: **plan** and merge.

## Goal

An empty but production-shaped app: backend and frontend start with one command, every check
in `AGENTS.md` §4 exists and passes in CI, the security middleware is in place, the event log
and SSE stream work end to end with a test event, and the app shell (header, rail, empty pages)
renders. Later slices only add features; they should never need to set up tooling.

## Parts

M0 is built and merged in three parts, one PR each, in this order (owner, 2026-10-30). The split
follows risk, so each review is small: tooling first, so every later PR runs the gates; the
backend core next, where the security review matters most; the frontend last. Each part has
its own plan checkpoint.

| Part | Branch | Scope (items in "In scope" below) | Acceptance criteria |
| --- | --- | --- | --- |
| **M0a** Tooling and CI | `m0a-tooling` | pnpm workspace, Node and pnpm pins, root scripts that exist so far, `Makefile`; `tsconfig`, ESLint, Prettier and the SQL lint rules; `.dependency-cruiser.cjs`; `scripts/` (`check:index` with the docs checks, `check-events` with `PENDING`, the bundle budget check with its fixture); `shared/` (event envelope, `test.ping`, TypeID schemas, error codes); CI, Dependabot, CodeQL, the security review workflow, the PR template; `README.md` quickstart | 6, 7, 9 (fixture), 10 |
| **M0b** Backend core | `m0b-backend` | Everything under "Backend", ports and adapters, the event layer, the security middleware, the fake model plumbing, `db:*` scripts, `.env.example` | 2, 3, 4, 8, 10 |
| **M0c** Frontend shell | `m0c-frontend` | Everything under "Frontend", the theme layer, lazy routes and the bundle budget on the real build, `gen:api` and its freshness check, Playwright | 1, 5, 9 (real build), 10, 11 |

Owner answers that apply to every part (2026-10-30):

- Node 24 LTS (`.nvmrc` = `24`, `engines.node` = `>=24.15 <25`: jsdom 30 needs 24.15, PR #49
  review); pnpm pinned in `packageManager`
  and installed with npm in CI, not with corepack (newer Node versions drop corepack).
- Laptop screens only (14 inch and larger): no mobile layout.
- Command **dark** only in M0 (`design/themes.md` §2); light comes when its values are agreed.
- The rail's New project "+" tile shows turned off (40% opacity, tooltip "Projects are not
  available yet", `design/ui-rules.md` B5) until projects exist (M5b).

## Read first

`AGENTS.md`; `docs/architecture.md` (all); `docs/realtime-events.md` §1–3, §5;
`docs/security.md` §2.1, §2.6, §2.8–2.11; `docs/testing.md` §1, §2, §4; decisions D34, D35;
`docs/requirements/app-shell.md` (layout only); `docs/design/screens.md` §1 (sketch, not final);
`docs/design/themes.md` §2, §3, §5 (D30).

## In scope

- pnpm workspace with `shared/`, `backend/`, `frontend/` and the layout from `architecture.md`
  §4; Node 24 LTS pinned (`.nvmrc` and `engines`); root scripts for every command in
  `AGENTS.md` §4; `Makefile` with `dev`, `test`, `lint`, `seed` (seed can be a stub).
- Backend: Hono on `@hono/node-server`, `app/main.ts` (composition root), `app/config.ts` (env
  parsed with Zod), Pino logging, Drizzle on `better-sqlite3` (WAL, `foreign_keys=ON`, `busy_timeout`, write transactions
  with `BEGIN IMMEDIATE`, `architecture.md` §11),
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
  editor, Settings), app shell with header and rail placeholders and the user panel with its
  menu (UI-1.20, UI-1.21; the battery comes in M5), `lib/realtime/` with the SSE
  connection and the reducer skeleton.
  A shared `Skeleton` component (theme tokens, 200 ms delay, reduced-motion aware) used by the
  empty pages' loading state (`requirements/README.md`).
- The transport interface and the SSE adapter, backend and frontend (`realtime-events.md` §1a).
- Theme layer (D30): semantic tokens as CSS variables, `frontend/src/themes/` with the
  **Command** theme in dark (light when its values are agreed; Material comes in slice T2), the `data-theme`/`data-mode` attributes with the no-flash
  script, and the lint rule against raw colours (`design/themes.md` §2). The Appearance
  settings UI comes later with the Settings page.
- Lazy route setup and the first-load bundle budget check in CI (`frontend-conventions.md` §4);
  the empty pages that later hold Statistics and the skill editor are lazy routes already. (The
  Flow view is a pane in the conversation page, not a page: its lazy chunk comes with M8.)
- `tsconfig` and ESLint settings from `frontend-conventions.md` §3 for all three packages, the
  SQL rules from `security.md` §2.8, Prettier.
- API client generation (`pnpm gen:api`) from `/api/openapi.json` (produced by
  `@hono/zod-openapi`) into `frontend/src/lib/api/generated/`, with a CI freshness check. Pick a
  generator that emits TanStack Query hooks and Zod schemas; record the choice in the PR. (Chosen
  in M0c: Hey API. Its TanStack Query plugin emits query and mutation *options* that our code
  passes to TanStack's own hooks, `useQuery(getHealthOptions())`, not hooks; its Zod plugin
  emits the schemas that check every response.)
- CI workflow (GitHub Actions) running all gates in `testing.md` §4, Dependabot config
  (npm and `github-actions` ecosystems), `javascript-typescript` added to the CodeQL matrix
  in `.github/workflows/codeql.yml`,
  the automated security review workflow, request body limit and the error handler
  (`security.md` §2.7–2.11).
- `README.md` quickstart; `.env.example` with every variable in `architecture.md` §8.
- PR template from `workflow.md` §6 as `.github/pull_request_template.md`.

## Out of scope

Any domain table besides `events` and `settings`; real pages; the agent; the AI SDK, prices,
queue and workspace adapters (their slices add them); pg-boss (VPS phase).

## Acceptance criteria

1. `make dev` starts both servers; the browser shows the shell with the "+" button in the rail
   and an empty header. The header and the left bar stay in place while a long page scrolls (UI-2.11, UI-1.13).
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
8. The SSE adapter and the Drizzle unit of work pass their contract suites. The unit-of-work
   suite includes the concurrency cases from `architecture.md` §11 that M0's tables allow: two
   transactions racing a compare-and-set on the same row (exactly one wins), a rolled-back
   transaction leaving no event, and `seq` strictly increasing under parallel appends.
9. The bundle budget check runs in CI and fails a build that exceeds it (shown with a test
   fixture).
10. All CI gates run and pass on the PR.
11. The user panel menu opens with a click, Enter and a tap, lists only the pages that exist
    (Manage bots, Manage skills, Statistics, Settings; empty pages count), moves with the arrow
    keys and closes with Esc, focus back on the avatar. With the left bar collapsed (Ctrl+B),
    focus on the avatar shows "Sir · Menu" and the menu opens to the right (UI-1.20, UI-1.21;
    component and e2e test).
12. `docs/` is unchanged except where this slice had to correct something (listed in the PR).

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

- None from D30: accepted, Command first.
