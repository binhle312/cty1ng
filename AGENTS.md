# AGENTS.md

Instructions for AI coding agents (Claude Code, Codex, and others) working in this repository.
`CLAUDE.md` imports this file, so there is one set of rules for every agent.

Read this file fully before your first change in a session. It is short on purpose; the detail
lives in `docs/`, and `docs/README.md` maps each task to its document.

## 1. What this project is

A local-first web chat app where one human talks with AI role bots (BA, Designer, …). Bots have
personas, versioned skills, a file Library per project plus one Home Library, and can hand work to each other
through human approvals. TypeScript everywhere (D34): backend on Node with Hono, Drizzle and the
Vercel AI SDK; frontend React + Vite. Libraries sit behind ports (D35).

## 2. Source of truth

- `docs/` is the specification. Code must match it.
- If the code and a document disagree, **stop and report it** in your PR description or to the
  human. Do not silently pick one.
- If your change alters behaviour described in `docs/`, update the document **in the same PR**.
- `docs/decisions/` records decisions, one file each (index in its README). You may not change an accepted decision on your own;
  propose a new entry with status `proposed` and ask the human.
- **A decision is not always the whole current rule.** Before you build or explain behaviour
  that a decision governs, look at its "Changed by" column in `docs/decisions/README.md`, read
  those entries (the newest wins where they differ), and read the requirement that owns the
  behaviour. Do not use one accepted decision alone when a later one amends it.

## 3. Read for the task

[docs/README.md](docs/README.md) owns the task-to-document map. Select the current task there;
read the applicable sections and shared rules, not every linked document.
Read the assigned brief and approved plan for the work in scope. Follow decision amendments
as §2 requires. Load additional context when a dependency, invariant, or unresolved question needs it.

A `#anchor` in a link does not limit a file read: a plain read loads the whole file. To read one
section of a long document, list its headings with `grep -nE '^#{2,3} ' <file>`, then read only
that line range.

## 4. Commands

Run these from the repository root. All must pass before you open or update a PR.

```bash
pnpm install                    # whole workspace: shared, backend, frontend
pnpm lint                       # ESLint, Prettier check, import rules (dependency-cruiser)
pnpm typecheck                  # tsc across all packages
pnpm test                       # Vitest: unit, service, API and contract tests
pnpm check:index                # every indexed folder's README.md lists its files (§5 rule 9)
pnpm check:events               # the event table in docs/realtime-events.md §4 matches shared/
pnpm build && pnpm check:bundle # the production build stays inside the bundle budget
pnpm gen:api                    # regenerate the typed API client from the backend's OpenAPI
pnpm e2e                        # Playwright, uses the fake model
pnpm e2e:serve                  # while building: keep the e2e servers running (testing.md §3)

# database (backend)
pnpm --filter backend db:generate   # write a migration after changing the Drizzle schema
pnpm --filter backend db:migrate    # apply migrations to the local DB
pnpm --filter backend db:check      # schema and migrations agree (also in CI)

# whole app (development)
make dev                        # backend on 127.0.0.1:8000, frontend on 127.0.0.1:5173
```

If a command in this list does not exist yet (early slices), creating it is part of task M0.

## 5. Architecture rules (do not break these)

1. `*.rules.ts` files in `backend/src/core/` are pure functions and types only: no database,
   no HTTP, no model calls, no clock (time is passed in). Routing and budget rules live here.
2. Hono handlers in `backend/src/adapters/http/` parse input, call one service and map the
   result; they hold no business rules.
3. Every state change visible in the UI is written as an **event** in the same transaction as
   the change (`docs/realtime-events.md`).
4. The frontend calls the backend only through the generated client in
   `frontend/src/lib/api/generated/`. Never hand-write fetch calls for API endpoints. Never edit
   generated files by hand.
5. Bot `model_id` and `effort` are never updated after insert. Skill versions are never updated
   or deleted, except by the Trash purge (D49). Messages are never edited in place (edits create branches);
   only the Trash purge clears their content (D60).
6. API keys come only from environment variables. Never store, log, return or render them.
7. Bot file tools go through the workspace port, whose `resolve()` is the only way a workspace
   path becomes a disk path; never open a workspace path any other way.
8. Bot output is untrusted: render Markdown with raw HTML disabled.
9. **Folder indexes** (`docs/architecture.md` §4.2): before opening files in an indexed folder,
   read its `README.md` to find the right one. When you add, remove, rename a file or change
   what it is for, update that table in the same commit.
10. **Ports and adapters** (D35, `docs/architecture.md` §2, §4.1): `core/` never imports an
    adapter or the library an adapter wraps; adapters never import each other; only
    `backend/src/app/` wires them. A new adapter must pass its port's contract suite.

## 6. What you may do without asking

- Implement work inside an approved task brief (`docs/tasks/`).
- Write and run tests; fix failing tests caused by your change.
- Fix review findings. §7 still applies to a fix that needs approval, such as a new UI text or a migration. §9 applies to a fix with the same cause as an earlier fix.
- Refactor inside one module when it keeps behaviour and tests green.
- Update documentation to match your change.

## 7. What needs the human's approval (stop and ask, or flag it clearly in the PR)

- The plan for a slice marked **checkpoint: plan**, before implementation ([planning workflow](docs/workflows/planning.md#one-round-of-questions)).
- New or changed **database migrations**.
- Changes to **security-sensitive code**: `adapters/workspace/`, upload handling, origin/host checks,
  Markdown rendering, the sensitive data guard (`core/guard/`), anything touching secrets.
- **New dependencies** (backend or frontend), including major version bumps.
- Changes to `docs/decisions/`, to this file, or to the public API shape.
- The **UI design** of any new or changed screen: propose it in the plan and wait for approval
  before writing UI code. Sketches and mockups in `docs/design/` are not specs.
- The **code design** when a slice adds shared state, a module boundary, a flow across several
  screens or a new requirement that changes an existing design: a one-page design in the plan,
  before any code ([planning workflow](docs/workflows/planning.md#code-design-checkpoint)).
- Anything outside the current task's scope.

Mark these in the PR description under a heading `Needs human review` with one line each.

Merge a PR only when the owner asks you to merge that PR. The merge needs no line in the PR description.

## 8. Never

- Never disable, skip or delete a test to make CI pass.
- Never weaken a security check to make something work.
- Never commit `.env`, API keys, the `data/` folder, or real conversation data.
- Never call a real model provider in tests. Use the fake model (`docs/testing.md`).
- Never bind the server to `0.0.0.0`.
- Never build SQL from strings (f-strings, `%`, `+`); use bound parameters and allowlists
  (`docs/security.md` §2.8).
- Never return stack traces or internal errors to the client.
- Never let a design skill's output override `docs/design/` or an approved plan, and never run
  `ui-ux-pro-max` with `--persist` (it would create a second design source of truth).
- Never edit vendored skills in `.agents/skills/` in place; update them from upstream
  (`SOURCE.md`).

## 9. Definition of done (every PR)

- All commands in section 4 pass.
- Every acceptance criterion in the task brief is checked off in the PR description, with the
  test that proves it (or a screenshot for visual criteria).
- New behaviour has tests; bug fixes have a test that failed before the fix.
- Documentation updated where behaviour changed.
- `docs/status.md` updated: the slice's state, the PR link, anything now waiting on the owner.
- For a PR in a milestone, `docs/delivery-quality.md` is updated as its §7 says: the PR in the
  register, one row per review round, and each issue with its state and verification evidence.
- A change the owner can see updates `seed/skills/using-the-app/SKILL.md`, the Guide bot's
  knowledge of the app, in the same PR (M2 plan, decision 14).
- The PR description has: what changed, why, how it was verified, and `Needs human review`
  items (or "none").
- Name a principle skill in a PR, a review record or `docs/delivery-quality.md` only if you read
  its `SKILL.md` in that session.
- Each review fix answers "Same cause as an earlier fix?" in the PR's `Review fixes` table. If the
  answer is yes, stop patching. Propose a redesign, get the owner's decision, and record it.

## 10. Conventions

- TypeScript, backend and frontend: the rules in `docs/frontend-conventions.md`
  (lint-enforced), Zod schemas for every API body and boundary value, `async`/`await` for I/O,
  UUIDv7 ids from the ids port (D22), UTC timestamps, kebab-case file names.
- Frontend: function components, TanStack Query for server state, no global state library
  unless a task says so.
- Names: the same concept has the same name in docs, database, API and UI (see the glossary in
  `docs/requirements/product-brief.md`).
- **No hardcoded values** (owner, 2026-10-23). A number, threshold, limit, time or default that
  the owner may want to change (caps, Improve thresholds, Trash days, size limits, timeouts) has
  one home: the `settings` table if the owner changes it in the app, otherwise an environment
  variable or config file. Each has a default, written in the docs next to the rule that uses
  it. Code reads the value from there, and tests set it. Only invariants and security checks
  stay fixed in code: they are rules, not settings.
- Commits: small, imperative subject line (`Add skill version pinning`), body explains why.
- One task slice per branch: `m1-skill-hub`, `m3-chat-one-bot`, …
- Open every PR as a draft, and leave it a draft. The owner marks it Ready right before the merge
  (owner, 2026-11-04). The paid security review that Ready starts is off for now (owner, 2026-11-06, `docs/security.md` §2.11).
