# M0: Skeleton

Checkpoint: **plan** and merge.

## Goal

An empty but production-shaped app: backend and frontend start with one command, every check
in `AGENTS.md` §4 exists and passes in CI, the security middleware is in place, the event log
and SSE stream work end to end with a test event, and the app shell (header, rail, empty pages)
renders. Later slices only add features; they should never need to set up tooling.

## Read first

`AGENTS.md`; `docs/architecture.md` (all); `docs/realtime-events.md` §1–3, §5;
`docs/security.md` §2.1, §2.6; `docs/testing.md` §1, §2, §4; `docs/porting-guide.md` §1;
`docs/requirements/app-shell.md` (layout only); `docs/design/screens.md` §1 (sketch, not final);
`docs/design/themes.md` §2, §3, §5 (D30, proposed).

## In scope

- Repository layout from `architecture.md` §3; `Makefile` with `dev`, `test`, `lint`, `seed`
  (seed can be a stub).
- Backend: uv project, FastAPI app factory, `settings.py`, `ids.py` (UUIDv7, D22), SQLAlchemy setup,
  Alembic with an initial migration containing **only** `events` and `settings`.
- Event layer: `append_event()`, in-process hub, `GET /api/stream` with `Last-Event-ID` replay,
  `ready`, `reset`, heartbeat; `GET /api/health`.
- Security middleware: loopback-only startup check, Host check, Origin check, CSP and other
  headers (`security.md` §2.1), secret-redacting log filter.
- Fake model plumbing: `FAKE_MODEL=1` switch and the `fake:scripted` catalog entry (no agent
  yet, just the switch and fixture loader).
- Frontend: Vite + React + TS strict, Tailwind, shadcn/ui on Base UI (D28), TanStack Query, TanStack Router with
  empty pages (Conversation, Bots, Bot detail, Create bot, Skills, Skill editor, Settings),
  app shell with header and rail placeholders, the SSE connection module and reducer skeleton.
- Theme layer (D30, if accepted): semantic tokens as CSS variables, `frontend/src/theme/` with
  one theme in light and dark, the `data-theme`/`data-mode` attributes with the no-flash
  script, and the lint rule against raw colours (`design/themes.md` §2). The Appearance
  settings UI comes later with the Settings page.
- `tsconfig` and ESLint settings from `frontend-conventions.md` §3; Zod (D33, if approved) and
  the stream event schemas for the test event.
- API client generation (`pnpm gen:api`) from `/api/openapi.json`, with a CI freshness check.
  Pick a generator that emits TanStack Query hooks and Zod schemas; record the choice in the PR.
- CI workflow (GitHub Actions) running all gates in `testing.md` §4, Dependabot config,
  the automated security review workflow, request body limit and the error handler
  (`security.md` §2.7–2.11).
- `reference/discord-role-bots/` copied in with its README (`porting-guide.md` §1).
- `README.md` quickstart; `.env.example` with every variable in `architecture.md` §6.
- PR template from `workflow.md` §6 as `.github/pull_request_template.md`.

## Out of scope

Any domain table besides `events` and `settings`; real pages; the agent.

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
6. All CI gates run and pass on the PR.
7. `docs/` is unchanged except where this slice had to correct something (listed in the PR).

## Tests

API tests for 2–4; a Vitest test for the stream reducer applying an event idempotently;
a Playwright smoke test that loads the shell.

## Needs human review

The UI design in the plan (layout, components, states), approved before UI code is written
(`docs/workflow.md` §2; sketches in `docs/design/` are not specs).

Initial migration; security middleware; dependency list (all new).

## Open questions

- D30: accepted or changed, and which theme ships first (owner).
