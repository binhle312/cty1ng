# AGENTS.md

Instructions for AI coding agents (Claude Code, Codex, and others) working in this repository.
`CLAUDE.md` imports this file, so there is one set of rules for every agent.

Read this file fully before your first change in a session. It is short on purpose; the detail
lives in `docs/`, and this file tells you which document to open for which task.

## 1. What this project is

A local-first web chat app where one human talks with AI role bots (BA, Designer, …). Bots have
personas, versioned skills, a per-conversation file workspace, and can hand work to each other
through human approvals. Backend: Python (FastAPI). Frontend: React + TypeScript.

Start with `docs/README.md` for the reading order.

## 2. Source of truth

- `docs/` is the specification. Code must match it.
- If the code and a document disagree, **stop and report it** in your PR description or to the
  human. Do not silently pick one.
- If your change alters behaviour described in `docs/`, update the document **in the same PR**.
- `docs/decisions/` records decisions, one file each (index in its README). You may not change an accepted decision on your own;
  propose a new entry with status `proposed` and ask the human.

## 3. Which document to read for which task

| You are working on | Read first |
| --- | --- |
| Anything (first time) | `docs/README.md`, `docs/status.md`, `docs/requirements/product-brief.md`, `docs/architecture.md` |
| A task from the delivery plan | `docs/tasks/<slice>.md` (it lists everything else you need) |
| Database tables, migrations | `docs/domain-model.md` |
| Who replies, bot-to-bot, joining, editing messages | `docs/conversation-rules.md` |
| Streaming, SSE, events | `docs/realtime-events.md` |
| HTTP endpoints | `docs/api.md` |
| Pages and components | `docs/requirements/<area>.md` (behaviour); `docs/design/` (sketches, not final) |
| The Flow pane, animations, renderers | `docs/flow-view.md` |
| Styling, themes, design tokens | `docs/design/themes.md` (D30, proposed) |
| Uploads, file tools, rendering bot output, request checks | `docs/security.md` |
| Tests | `docs/testing.md` |
| Moving code from the old Discord project | `docs/porting-guide.md` |
| How to work, branch, review | `docs/workflow.md` |

## 4. Commands

Run these from the repository root. All must pass before you open or update a PR.

```bash
# backend
cd backend
uv sync                         # install
uv run ruff check . && uv run ruff format --check .
uv run pyright
uv run pytest
uv run alembic upgrade head     # apply migrations to the local DB

# frontend
cd frontend
pnpm install
pnpm gen:api                    # regenerate the typed API client from the backend's OpenAPI
pnpm lint && pnpm typecheck
pnpm test                       # Vitest
pnpm e2e                        # Playwright, uses the fake model

# whole app (development)
make dev                        # backend on 127.0.0.1:8000, frontend on 127.0.0.1:5173
```

If a command in this list does not exist yet (early slices), creating it is part of task M0.

## 5. Architecture rules (do not break these)

1. `backend/app/domain/` contains pure functions and types only: no database, no HTTP, no
   model calls, no clock (time is passed in). Routing and budget rules live here.
2. Routers in `backend/app/api/` do validation and call services; they hold no business rules.
3. Every state change visible in the UI is written as an **event** in the same transaction as
   the change (`docs/realtime-events.md`).
4. The frontend calls the backend only through the generated client in
   `frontend/src/api/generated/`. Never hand-write fetch calls for API endpoints. Never edit
   generated files by hand.
5. Bot `model_id` and `effort` are never updated after insert. Skill versions are never updated
   or deleted. Messages are never edited in place (edits create branches).
6. API keys come only from environment variables. Never store, log, return or render them.
7. Bot file tools go through `Workspace.resolve()`; never open a workspace path any other way.
8. Bot output is untrusted: render Markdown with raw HTML disabled.

## 6. What you may do without asking

- Implement work inside an approved task brief (`docs/tasks/`).
- Write and run tests; fix failing tests caused by your change.
- Refactor inside one module when it keeps behaviour and tests green.
- Update documentation to match your change.

## 7. What needs the human's approval (stop and ask, or flag it clearly in the PR)

- New or changed **database migrations**.
- Changes to **security-sensitive code**: `workspace/`, upload handling, origin/host checks,
  Markdown rendering, anything touching secrets.
- **New dependencies** (backend or frontend), including major version bumps.
- Changes to `docs/decisions/`, to this file, or to the public API shape.
- The **UI design** of any new or changed screen: propose it in the plan and wait for approval
  before writing UI code. Sketches and mockups in `docs/design/` are not specs.
- Anything outside the current task's scope.

Mark these in the PR description under a heading `Needs human review` with one line each.

## 8. Never

- Never disable, skip or delete a test to make CI pass.
- Never weaken a security check to make something work.
- Never commit `.env`, API keys, the `data/` folder, or real conversation data.
- Never call a real model provider in tests. Use the fake model (`docs/testing.md`).
- Never bind the server to `0.0.0.0`.
- Never build SQL from strings (f-strings, `%`, `+`); use bound parameters and allowlists
  (`docs/security.md` §2.8).
- Never return stack traces or internal errors to the client.

## 9. Definition of done (every PR)

- All commands in section 4 pass.
- Every acceptance criterion in the task brief is checked off in the PR description, with the
  test that proves it (or a screenshot for visual criteria).
- New behaviour has tests; bug fixes have a test that failed before the fix.
- Documentation updated where behaviour changed.
- `docs/status.md` updated: the slice's state, the PR link, anything now waiting on the owner.
- The PR description has: what changed, why, how it was verified, and `Needs human review`
  items (or "none").

## 10. Conventions

- Python: type hints everywhere, Pydantic models for API schemas, `async` for I/O,
  UUIDv7 ids (`app.ids.new_id()`, D22), UTC timestamps.
- TypeScript: `strict` mode, function components, TanStack Query for server state, no global
  state library unless a task says so.
- Names: the same concept has the same name in docs, database, API and UI (see the glossary in
  `docs/requirements/product-brief.md`).
- Commits: small, imperative subject line (`Add skill version pinning`), body explains why.
- One task slice per branch: `m1-skill-hub`, `m3-chat-one-bot`, …
