# M0 plan: Skeleton

> **Record, not spec.** Copied from [#10, first comment](https://github.com/binhle312/cty1ng/pull/10#issuecomment-6330668155) and its [scope note](https://github.com/binhle312/cty1ng/pull/10#issuecomment-6386522840) on 2026-11-04. The owning documents win where they differ ([index](README.md)).
>
> **Approval:** superseded. The owner closed #10 on 2026-10-29 to start again after requirement changes. The M0a, M0b and M0c plans replaced this plan.
>
> **Changed in the copy:** the old prototype's name is now "the earlier prototype" (owner, 2026-10-30).

Brief: `docs/tasks/M0-skeleton.md`. Checkpoint: **plan**. I stop here until the owner approves this plan, the UI design (§4) and the dependency list (§3), and answers the questions in §1.

## 1. Questions for the owner (blocking)

I found these gaps between the brief and the docs. Each one has a recommendation. When you answer, I will record the answer in the owning document in this PR (`workflow.md` §8).

| # | Gap | Recommendation |
| --- | --- | --- |
| Q1 | **Test event name.** The brief asks for "the test event" in `shared/`, but `realtime-events.md` §4 lists no such type. | Add `test.ping` to the §4 table: persisted, payload `{note: string}`, "test-only endpoint, `APP_ENV=test`". The endpoint is `POST /api/_test/events`. It is registered only when `APP_ENV=test`, and it is not in the OpenAPI schema, so the generated client never has it. |
| Q2 | **"The three lists match"** (`realtime-events.md` §4). §4 lists about 30 types. Payload schemas for most of them come in later slices. | M0 checks that `shared` types ⊆ the doc table, and that the reducer handles exactly the `shared` types (the exhaustive switch does this). Each slice adds its types to `shared`. At the end of M8 the check becomes strict equality. I add one line to §4 that says this. |
| Q3 | **The no-flash script conflicts with the CSP.** `themes.md` §2 rule 5 says an *inline* script goes in `index.html`. The CSP in `security.md` §2.1 (`default-src 'self'`) blocks inline scripts in the production build. | Use a small external, render-blocking `/theme-init.js` in `<head>`. It runs before the first paint, and the CSP stays as it is. I change "inline" to "blocking" in `themes.md`. Alternative: add a `script-src 'sha256-…'` hash to the CSP. That changes a security control, so I do not recommend it. |
| Q4 | **Fallback theme.** `themes.md` §2 rule 6 falls back to "Material + follow system", but Material comes only in T2. | Fall back to Command + follow system until T2. T2 then decides the default. Small edit to `themes.md`. |
| Q5 | **Config variables that are not in `architecture.md` §8.** The brief uses `APP_ENV` and `FAKE_MODEL`. `.env.example` must list every §8 variable. | Add `APP_ENV` (`dev`\|`test`\|`prod`, default `dev`), `FAKE_MODEL` (`0`\|`1`, default `0`) and `LOG_LEVEL` (default `info`) to §8. |
| Q6 | **`GET /api/health` in M0.** `api.md` §7 gives `{db, worker, catalog}`, but M0 has no worker and no catalog. | Keep the shape: `{db: "ok"\|"error", worker: "not_started", catalog: {models: 0\|1, available: 0\|1}}`. The catalog is 1/1 only with `FAKE_MODEL=1` (`fake:scripted`). I widen the `worker` enum in `api.md`. M3 makes it `ok`. |
| Q7 | **Prototype source.** `porting-guide.md` §1 asks me to copy `the earlier prototype`. I found the owner's local copy (not a git repository: `rolebots/`, `tests/`, `bots/`, `README.md`, `pyproject.toml`, `.env.example` with empty values). | Copy those files into `reference/the earlier prototype/`, leaving out caches. Add `reference/README.md` with the text from §1. Please confirm that this is the right copy. |
| Q8 | **Local toolchain.** This machine has Node 26 and no pnpm. The brief pins Node 24 LTS. | I install Node 24 with nvm and enable pnpm with corepack. `.nvmrc` = `24`, `engines.node` = `>=24 <25`, and `packageManager` pins pnpm. |

## 2. Approach and order of work

Small commits in this order. Each step keeps `pnpm lint`, `pnpm typecheck` and `pnpm test` green.

1. **Workspace and tooling.** `pnpm-workspace.yaml`, the root `package.json` scripts for every command in AGENTS.md §4, `.nvmrc`, `onlyBuiltDependencies: [better-sqlite3, esbuild]`, `tsconfig.base.json` (`frontend-conventions.md` §3 flags), ESLint flat config (type-aware rules from §3, the SQL rules from `security.md` §2.8 with `eslint-plugin-drizzle` and a `no-restricted-syntax` ban on `sql.raw` and string `db.run`/`db.execute`), Prettier, `Makefile` (`dev`, `test`, `lint`, `seed` as a stub that prints "comes with M1/M2").
2. **`shared/`.** `ids.ts` (one branded Zod TypeID schema per prefix in D36), `errors.ts` (codes from `api.md` §1 plus the error envelope schema), and `events/` (envelope `{seq, type, data}`, `ready`, `reset`, `test.ping`, and the `EventType` list).
3. **Backend core.** `core/ports/` with one file per port: `transport.ts`, `repositories.ts` (`UnitOfWork.run(tx => …)`, `EventsRepository`, `SettingsRepository`), `queue.ts`, `model.ts`, `prices.ts`, `workspace.ts`, `clock.ts`, `ids.ts`. Ports whose adapter comes later are types only. `core/events/` has `appendEvent(tx, type, data)` and `hub.ts` (in-process notify after commit; `subscribe(afterSeq)` reads from the DB, so replay and live use the same code).
4. **Adapters.**
   - `adapters/db/`: `better-sqlite3` with WAL, `foreign_keys=ON` and `busy_timeout=5000`. Write transactions use `BEGIN IMMEDIATE`, with one retry on `SQLITE_BUSY`. It has the Drizzle schema for `events` and `settings` only, the TypeID column type (the only conversion point), a UTC timestamp column helper, and the unit of work. It also records a `db_lock_wait_seconds` timing in the log (a full histogram can come later; listed in Follow-ups).
   - `adapters/sse/`: frames (`id:`, `event:`, `data:`), `retry: 2000`, a `: ping` heartbeat every 15 s, `ready {max_seq}`, `Last-Event-ID` replay, and `reset` when the cursor is older than the oldest kept event.
   - `adapters/clock/`, `adapters/ids/` (`uuidv7` + `typeid-js`).
   - `adapters/model/fake/`: the fixture loader for `backend/test/fixtures/fake-scripts/*.yaml` (Zod-validated) and the `fake:scripted` catalog entry. No agent.
   - `adapters/http/`: Hono + `@hono/zod-openapi`. Middleware order: request id → Pino logger → Host check → Origin check → CORS (allowlist only) → `secureHeaders` (CSP and headers from `security.md` §2.1) → `bodyLimit` 1 MB (413 `too_large`). Then a Zod error hook (422 `validation_error`, `.strict()`) and the generic error handler (code + request id, never a stack). Routes: `GET /api/health`, `GET /api/stream`, `GET /api/openapi.json`, `POST /api/_test/events` (only with `APP_ENV=test`). The OpenAPI docs page appears only with `APP_ENV=dev`.
5. **`app/`.** `config.ts` (Zod-parsed env; the process exits with a clear message when a value is invalid, and when `HOST` is not loopback), `main.ts` (wiring, Pino redaction of every `*_API_KEY` value and key path), and `cli.ts` with `ids decode <typeid|uuid>` (converts both ways).
6. **Migration.** `drizzle.config.ts` and `migrations/0000_events_settings.sql`, generated by drizzle-kit. Scripts: `db:generate`, `db:migrate` and `db:check`. `db:check` runs `drizzle-kit check` and also generates into a temporary folder and fails if anything new appears.
7. **Contract suites.** `backend/test/contracts/` has a small runner (`defineContract(name, makeAdapter, cases)`), plus `transport.contract.ts` and `unit-of-work.contract.ts`. The cases are listed in §5.
8. **Frontend.** Vite + React + strict TS, Tailwind v4, shadcn/ui initialised on Base UI (Tooltip and Button only for now), TanStack Query, TanStack Router (file routes, lazy routes for Statistics, Flow and the skill editor), the shell from §4, `lib/realtime/` (`transport.ts`, `sse.ts`, `reducer.ts`), `lib/log.ts`, `Skeleton`, `themes/command.css` (light and dark), `themes/variants.ts`, `public/theme-init.js`, and a local ESLint rule that bans hex colours and arbitrary Tailwind values in `components/` and `features/`.
9. **API client.** `pnpm gen:api` starts the app in memory, writes `openapi.json` and runs the generator into `frontend/src/lib/api/generated/`. The CI freshness check regenerates the client and runs `git diff --exit-code`.
10. **Folder indexes.** `scripts/check-index.ts` + a `README.md` in every † folder that exists after M0.
11. **CI and repository.** `.github/workflows/ci.yml` runs every gate in `testing.md` §4: install with `--frozen-lockfile`, lint (ESLint, Prettier, dependency-cruiser), typecheck, test, `db:check`, gen:api freshness, check:index, the event-list check, the bundle budget, Playwright and `pnpm audit --audit-level high`. I also add `javascript-typescript` to the CodeQL matrix, `.github/dependabot.yml` (npm + github-actions, weekly), `.github/workflows/security-review.yml` (`anthropics/claude-code-security-review`, only for PRs that touch AGENTS.md §7 paths and only from the owner's branches), and `.github/pull_request_template.md`.
12. **Repo files.** `reference/`, the `README.md` quickstart, `.env.example`, `config/models.yaml` (only `fake:scripted`, used when `FAKE_MODEL=1`), and the `docs/status.md` update.

### Files (new unless marked)

```
package.json  pnpm-workspace.yaml  pnpm-lock.yaml  .nvmrc  .npmrc  tsconfig.base.json
eslint.config.js  .prettierrc  .prettierignore  .dependency-cruiser.cjs  Makefile  .env.example
README.md (edit)  config/models.yaml  scripts/{check-index.ts, check-bundle.ts, check-events.ts, gen-api.ts} + tests
eslint-rules/no-raw-design-values.js
.github/{workflows/ci.yml, workflows/security-review.yml, workflows/codeql.yml (edit), dependabot.yml, pull_request_template.md}
reference/README.md  the earlier prototype's files
shared/{package.json, tsconfig.json, README.md, src/ids.ts, src/errors.ts, src/events/{envelope.ts, types.ts, index.ts}}
backend/{package.json, tsconfig.json, drizzle.config.ts, README.md, migrations/0000_*.sql}
backend/src/app/{main.ts, config.ts, cli.ts, README.md}
backend/src/core/ports/{transport,repositories,queue,model,prices,workspace,clock,ids}.ts + README.md
backend/src/core/events/{append-event.ts, hub.ts, README.md}
backend/src/adapters/{http,sse,db,clock,ids,model}/… + README.md each
backend/test/{contracts,api,security,fixtures}/…  backend/test/fixtures/bad-import/ (dependency-cruiser fixture)
frontend/{package.json, tsconfig.json, vite.config.ts, index.html, components.json, playwright.config.ts, README.md}
frontend/public/theme-init.js
frontend/src/{main.tsx, routes/**, features/shell/**, components/ui/**, components/skeleton.tsx, lib/{log.ts, api/**, realtime/**}, themes/**}
frontend/test/{e2e/shell.spec.ts, security/, fixtures/oversized-bundle/}
docs/status.md (edit), plus the doc corrections from §1 once answered
```

## 3. New dependencies (all need approval)

| Package | Where | Why |
| --- | --- | --- |
| `typescript`, `tsx` | root dev | Compiler; runs TS scripts and the dev backend |
| `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-drizzle`, `eslint-plugin-react-hooks`, `globals` | root dev | Lint rules in `frontend-conventions.md` §3 and `security.md` §2.8 |
| `prettier` | root dev | Formatting |
| `dependency-cruiser` | root dev | Import rules (D35) |
| `vitest` | root dev | All unit, service, API and contract tests |
| `@playwright/test`, `@axe-core/playwright` | frontend dev | Smoke test; axe check of the shell (`themes.md` §5) |
| `zod` | shared, backend, frontend | D33 |
| `typeid-js`, `uuidv7` | shared (typeid), backend | D22, D36 |
| `hono`, `@hono/node-server`, `@hono/zod-openapi` | backend | D34 |
| `drizzle-orm`, `better-sqlite3`, `@types/better-sqlite3`, `drizzle-kit` (dev) | backend | D34, D29 |
| `pino`, `pino-pretty` (dev) | backend | Logging, `architecture.md` §9 |
| `yaml` | backend | `config/models.yaml` and fake-model fixtures (`security.md` §2.4 already names it) |
| `react`, `react-dom`, `vite`, `@vitejs/plugin-react` | frontend | D28 |
| `tailwindcss`, `@tailwindcss/vite` | frontend | D28 |
| `@base-ui/react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` | frontend | shadcn/ui on Base UI (D28); icons for the rail and header |
| `@tanstack/react-query`, `@tanstack/react-router`, `@tanstack/router-plugin` | frontend | D28 |
| `@fontsource-variable/geist`, `@fontsource-variable/geist-mono` | frontend | Command fonts, self-hosted so that the CSP stays `'self'` |
| `@testing-library/react`, `jsdom` | frontend dev | Reducer and component tests |
| `@hey-api/openapi-ts` | frontend dev | **API client generator** (see below) |

**Generator choice: `@hey-api/openapi-ts`** with its `@tanstack/react-query` and `zod` plugins. It emits typed SDK functions, TanStack Query option factories and hooks, and Zod schemas from one OpenAPI file. It has no runtime dependency beyond its small fetch client, which is generated into the folder. Alternative: Orval, which is also fine, but its config is heavier and its Zod output is a separate mode. I will record the choice in `frontend/src/lib/api/README.md`.

Not added in M0: `ai`, price, queue and workspace libraries (out of scope); TanStack Virtual (M3) and dnd-kit (M4), which are added when they are used. The bundle check uses `node:zlib`, so it needs no package.

## 4. UI design (needs approval before UI code)

Only the shell and empty pages. Based on `design/screens.md` §1 and the Command tokens in `themes.md` §3 (not copied from them).

```
┌──────┬──────────────────────────────────────────────────────────────────────┐
│  ＋  │                                       Bots  Skills  Statistics  ⚙    │  header 48 px
│──────├──────────────────────────────────────────────────────────────────────┤  (bot bar empty in M0)
│      │                                                                      │
│ rail │   page content                                                       │
│ 72px │   "/"  → empty state: "Pick a conversation or press +"               │
│      │   other routes → page title + Skeleton rows while lazy chunk loads   │
│      │                                                                      │
└──────┴──────────────────────────────────────────────────────────────────────┘
```

| Part | Proposal | States |
| --- | --- | --- |
| Rail | 72 px column, `surface-container`, `outline` right border. Top: 48 px round "+" button (`primary` ring on focus, tooltip "New conversation" on hover **and** focus). Below it a divider, then an empty list (no conversations exist in M0). | "+" is visible but disabled, with the tooltip "Comes with conversations (M3)". There is no endpoint to create a conversation yet. |
| Header | 48 px, `surface`, `outline` bottom border. Left: the bot bar area, empty with no placeholder text (AC1: "empty header"). Right: text links Bots, Skills, Statistics, then a Settings icon button, all with tooltips. | The active route link uses `on-surface` and the others use `on-surface-muted`. |
| Main | `surface`. `/` shows a centred, muted line: "Pick a conversation or press +". The Get started checklist (UI-1.7) is not in M0 because it needs `/api/setup` and `/api/models`. | Each route has a pending component that shows `Skeleton` blocks. |
| Empty pages | Conversation `/c/$conversationId`, Bots `/bots`, Bot detail `/bots/$botId`, Create bot `/bots/new`, Skills `/skills`, Skill editor `/skills/$skillId/edit` (lazy), Settings `/settings`, Statistics `/stats` (lazy). Each page has an `h1` and a muted line: "This page arrives in M<n>." | Loading: `Skeleton` after 200 ms, `aria-busy`, no shimmer with reduced motion. Error: a route error boundary with "Something went wrong" and a Retry button. |
| Skeleton | One shared component with variants `line`, `avatar` and `block`. It uses `surface-raised`, shimmers with `duration-medium`, and is hidden for 200 ms before it appears. | |
| Theme | Command light and dark from the OS (`prefers-color-scheme`). There is no switcher UI in M0. `data-theme="command"`, `data-mode`, `data-density="default"`. Geist 13 px base, `radius-control` 6 px. | |
| Accessibility | Landmarks: `nav` (rail), `header`, `main`. A visible focus ring (`primary`). Tab order: "+", header links, main. axe runs in both modes. | |

Checks in M0 (`themes.md` §5, scaled to what exists): the token contrast unit test, axe on the shell in light and dark, a Playwright screenshot of the shell in both modes, and the theme leak test (switch 50 times, then count listeners and style elements).

## 5. Tests mapped to acceptance criteria

| AC | Test |
| --- | --- |
| 1 `make dev` shows the shell with "+" and an empty header | `frontend/test/e2e/shell.spec.ts` "AC1: shell loads with + and empty header" + screenshot |
| 2 `HOST=0.0.0.0` exits | `backend/test/security/startup.test.ts` (config parse rejects; spawned process exits non-zero with the message) |
| 3 foreign Origin / wrong Host → 403 | `backend/test/security/origin-host.test.ts`: evil Origin on POST → 403 `origin_rejected`; no Origin on POST → 403; wrong Host → 403; good origin passes; same checks on `/api/stream` |
| 4 test event, SSE receive, replay, reset | `backend/test/api/stream.test.ts`: append via `POST /api/_test/events` → client gets the matching `id`; reconnect with `Last-Event-ID` replays the missed ones; a cursor older than the oldest kept event → `reset`; `/api/_test/events` → 404 when `APP_ENV≠test` |
| 5 gen:api produces a client; CI fails when stale | `scripts/gen-api.test.ts` (generates into a temp dir and compares) + the CI step `pnpm gen:api && git diff --exit-code` |
| 6 bad imports fail lint | `scripts/import-rules.test.ts` runs dependency-cruiser on `backend/test/fixtures/bad-import/` (core→adapter, adapter→adapter) and expects both violations |
| 7 index check | `scripts/check-index.test.ts`: an unlisted file fails, a listed but missing file fails, a complete folder passes |
| 8 contract suites | `transport.contract.ts` (SSE adapter: ordering, replay after cursor, gap → reset, live after replay, no duplicates at the replay/live seam) and `unit-of-work.contract.ts` (Drizzle: commit writes rows and the event; rollback leaves no event; two racing compare-and-set updates on one `settings` row → exactly one wins; `seq` strictly increasing under 50 parallel appends) |
| 9 bundle budget | `scripts/check-bundle.test.ts` with `frontend/test/fixtures/oversized-bundle/` → fails; the real build → passes; CI step |
| 10 CI green | The PR checks |
| 11 docs unchanged except corrections | Listed under "Docs updated" |
| Brief extras | `lib/realtime/reducer.test.ts` "applies an event idempotently"; `security/error-handler.test.ts` (no stack, has a request id); `security/body-limit.test.ts` (413); `security/unknown-fields.test.ts` (422); `security/redaction.test.ts` (a sentinel `*_API_KEY` never in logs or responses); `scripts/check-events.test.ts` |

## 6. Risks

- **CSP vs Base UI/Vite in the production build.** Some libraries inject `<style>` tags, which `default-src 'self'` blocks. I will test the production build under the real CSP in Playwright. If something breaks, I stop and ask before I relax any directive.
- **Host check vs Vite proxy.** In dev, the browser calls `127.0.0.1:5173`, and Vite proxies `/api` to `:8000` with `changeOrigin: true`, so Host becomes `127.0.0.1:8000`. Origin stays `:5173`, which is in `ALLOWED_ORIGINS`. SSE goes through the same proxy.
- **SQLite races in tests.** `better-sqlite3` is synchronous, so the "racing" cases use two connections to one file (each with `BEGIN IMMEDIATE`). They do not use two promises on one connection, which would never really race.
- **New-ish versions** (Tailwind v4, Base UI shadcn init, Hey API plugins). I pin exact versions in the lockfile, and Dependabot handles updates.
- **Size of the slice.** If it grows past one reviewable PR, I propose splitting it into M0a (tooling, backend, CI) and M0b (frontend shell) before I start the frontend.

## 7. Owner actions (outside the code)

- Add the `ANTHROPIC_API_KEY` repository secret for the security-review workflow (it is skipped without the secret).
- Keep GitHub's default CodeQL setup off. Turn on secret scanning and push protection (`security.md` §2.11), if they are not on yet.

---

**Scope note for M0a, approved by the owner on 2026-10-24.**

PR #23 adds docs checks to `pnpm check:index`. They are defined in `docs/architecture.md` §4.2 ("The same script checks the docs indexes"):

1. Each story id in `docs/requirements/*.md` is inside the range that `docs/requirements/README.md` gives for its file, and the last id of the range exists.
2. Each `Amends:` and `Supersedes:` line in `docs/decisions/` names decisions that exist, and the "Changed by" column of `docs/decisions/README.md` lists exactly those entries.
3. Each decision file has one index row, and each row links to a file that exists.

The checks read only fixed metadata, never prose. Please add them to the M0a brief and to the `check:index` script before M0a is done. After #23 merges, bring `main` into this branch first, so the checks run against the new metadata.

---
_Generated by [Claude Code](https://claude.ai/code)_
