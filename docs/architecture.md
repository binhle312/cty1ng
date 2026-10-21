# Architecture

Stack (D34): TypeScript on Node 24 LTS for the backend, Hono for HTTP, Drizzle for the
database, the Vercel AI SDK (`ai`) for model calls; React + Vite for the frontend (D28); Zod
for every schema (D33). Libraries sit behind ports so they can be replaced (D35).

## 1. The big picture

```
Browser (React SPA, served by Vite in dev, by the backend as static files in prod builds)
  │  HTTP  POST / PATCH / PUT / DELETE   (actions)        ─┐
  │  HTTP  GET                             (reads)          │ generated TS client
  │  SSE   GET /api/stream                 (live events)   ─┘
  ▼
Node process (one process in phase 1)
  ├─ app/        composition root: read config, build adapters, hand them to core, start
  ├─ adapters/   http (Hono routes + middleware), sse, db (Drizzle), model (AI SDK, fake),
  │              queue, prices, workspace (disk + git), clock
  ├─ core/       use cases per feature (bots, skills, conversations, messages, runs, handoffs,
  │              events, catalog, stats) and the pure rules (`*.rules.ts`)
  └─ core/ports/ interfaces the core needs; adapters implement them
        │
        ▼
  data/app.db (SQLite, WAL)   data/workspaces/<conversation_id>/   data/avatars/
```

## 2. Ports and adapters (D35)

The core says what it needs as an interface (a **port**); an **adapter** implements it with a
library. The core never imports a library that an adapter wraps, so changing the library
changes one adapter and nothing else.

| Port (`core/ports/`) | What the core asks for | Phase-1 adapter | Later or alternative |
| --- | --- | --- | --- |
| `transport.ts` | `subscribe(afterSeq) → AsyncIterable<Event>` turned into frames | `adapters/sse/` | WebSocket (`realtime-events.md` §1a) |
| `repositories.ts` | One repository per aggregate, plus `UnitOfWork.run(tx => …)` | `adapters/db/` (Drizzle, SQLite) | Drizzle on Postgres (D29) |
| `queue.ts` | Enqueue, claim with lease, finish, fail | `adapters/queue/in-process/` (rows in `runs`) | `adapters/queue/pg-boss/` |
| `model.ts` | Stream a reply with tools; report usage per request | `adapters/model/ai-sdk/`, `adapters/model/fake/` | Direct vendor SDKs |
| `prices.ts` | Price one request; say where the price came from | `adapters/prices/genai-prices/` + `config/models.yaml` override (D21) | Another price feed |
| `workspace.ts` | Resolve, read, write, commit, changed-since | `adapters/workspace/local-git/` | Object storage on a VPS |
| `clock.ts`, `ids.ts` | Now; new id of a given type: UUIDv7 (D22) written as a TypeID (D36) | System clock, `uuidv7` + `typeid-js` | Fixed values in tests |

**Unit of work.** A state change and the event describing it commit together (§5, rule 3 in
`AGENTS.md`). Services do both inside one `uow.run(tx => …)`; the repositories they get from
`tx` share the transaction. This is part of the persistence port, so a new database adapter
cannot quietly drop the guarantee.

**Contract tests.** Each port has one suite in `backend/test/contracts/<port>.contract.ts`.
Every adapter runs it (the SSE adapter and the fake model from M0). A new adapter is done when
it passes the suite.

**Not abstracted:** TypeScript, React, Zod and SQL beyond what Drizzle covers for SQLite and
Postgres. D35 explains why.

## 3. Components and their contracts

| Component | Owns | Must not |
| --- | --- | --- |
| `adapters/http/` | Hono routes (Zod schemas via `@hono/zod-openapi`), status codes, error mapping, middleware (Host/Origin, `secureHeaders`, `bodyLimit`, CORS in dev, Pino logging) | Contain business rules or SQL. A handler parses, calls one service, maps the result |
| `core/<feature>/*.service.ts` | Use cases: transactions through the unit of work, calling rules, appending events | Import Hono, Drizzle, `ai`, pg-boss or any adapter |
| `core/<feature>/*.rules.ts` | Decisions as pure functions (`decideRuns`, `budgetAfter`, `visibleHistory`, `parseMentions`) | Import ports, services, adapters or `Date.now()`; time comes in as an argument |
| `core/events/` | `appendEvent(tx, type, data)`; the hub that wakes subscribers after commit | Be called outside a unit of work that also changes state |
| `core/runs/` | The worker loop: claim through the queue port, leases, retries, cancellation, building the prompt, the bot's tools, writing the bot message | Decide who runs (that is `decideRuns`); touch files except through the workspace port |
| `core/catalog/` | The model catalog from `config/models.yaml`, availability (key present), effort per model | Store keys anywhere |
| `adapters/workspace/local-git/` | `resolve()` and the path sandbox, git commits | Know about bots or conversations beyond ids and write paths |
| `adapters/db/` | Drizzle table definitions, repositories, the unit of work | Business logic |
| `app/` | `main.ts` (wiring), `config.ts` (env parsed with Zod), `cli.ts` | Logic of its own beyond wiring |

**Why the rules are pure.** Routing ("who runs next?") is where bugs hide: mentions, budgets,
pending members, deleted bots, branches. As a pure function it can be tested with hundreds of
table rows in milliseconds and read by a reviewer in one sitting. Services gather the state,
call the function, and act on the answer.

## 4. Repository layout

A pnpm workspace with three packages. Each folder marked † has a `README.md` index (§4.2).

```
.
├─ AGENTS.md                 rules for coding agents
├─ CLAUDE.md                 "@AGENTS.md"
├─ README.md                 what it is, quickstart
├─ Makefile                  dev, test, lint, seed shortcuts
├─ package.json              workspace scripts (lint, typecheck, test, e2e, gen:api, check:index)
├─ pnpm-workspace.yaml
├─ .dependency-cruiser.cjs   import rules (§4.1)
├─ config/
│  └─ models.yaml            model catalog and price overrides
├─ docs/                     this specification
├─ shared/ †                 code both sides import
│  └─ src/
│     ├─ events/             Zod schemas of the event envelope and every event type
│     ├─ ids.ts              TypeID schemas per prefix (BotId, MessageId, …; D36)
│     └─ errors.ts           API error codes
├─ backend/ †
│  ├─ package.json
│  ├─ drizzle.config.ts
│  ├─ migrations/            SQL generated by drizzle-kit, reviewed like code
│  ├─ src/
│  │  ├─ app/ †              main.ts, config.ts, cli.ts (`skills import|export <folder>`)
│  │  ├─ core/
│  │  │  ├─ ports/ †         one file per port (§2)
│  │  │  └─ <feature>/ †     bots, skills, conversations, messages, runs, handoffs, events,
│  │  │                      catalog, stats: *.service.ts, *.rules.ts, *.test.ts
│  │  └─ adapters/
│  │     └─ <system>/ †      http, sse, db, model, queue, prices, workspace, clock
│  └─ test/
│     ├─ contracts/ †        one suite per port, run by every adapter
│     ├─ api/                HTTP tests against the Hono app
│     ├─ security/           security.md §3
│     └─ fixtures/           fake-model scripts, seed data
├─ frontend/ †
│  ├─ package.json
│  ├─ src/
│  │  ├─ routes/ †           TanStack Router route tree (D28)
│  │  ├─ features/<feature>/ † conversation, bots, skills, settings, flow (flow-view.md), stats:
│  │  │                      components, hooks over the generated client, view state
│  │  ├─ components/ui/      shadcn/ui on Base UI (copied in, owned by us)
│  │  ├─ lib/api/ †          generated/ (never edit) and the client setup
│  │  ├─ lib/realtime/ †     transport.ts, sse.ts, event reducer (realtime-events.md §1a)
│  │  ├─ lib/ †              markdown renderer (sanitised), log.ts, timerange/, formatting
│  │  └─ themes/ †           token files per theme, variants.ts (D30, design/themes.md)
│  └─ test/
│     ├─ e2e/                Playwright
│     └─ security/
└─ data/                     runtime data (git-ignored)
```

Unit tests sit next to the code they test (`decide-runs.rules.test.ts`). File names are
kebab-case.

### 4.1 Import rules

```
app ──▶ adapters ──▶ core ──▶ shared
 └──────────────────▶ core
frontend ──▶ shared
```

- `app/` may import anything in the backend. It is the only place adapters are chosen.
- `adapters/<system>/` may import `core/` (ports and types) and `shared/`. **Adapters never
  import each other**; if two need to cooperate, `app/` wires them.
- `core/` may import `core/ports/`, other core features' public files and `shared/`. Never an
  adapter, never Hono, Drizzle, `ai`, pg-boss, `better-sqlite3`, `node:fs` or `node:child_process`.
- `*.rules.ts` may import only other `*.rules.ts` files and `shared/`.
- `frontend/` may import `shared/`, never `backend/`. It talks to the backend only through
  `lib/api/generated/`.

dependency-cruiser checks these in `pnpm lint`; a violation fails CI.

### 4.2 Folder indexes for agents

Each folder marked † in §4 has a `README.md` that indexes it, so an agent (or a person) can find
the right file by reading one short page instead of opening every file. `docs/README.md` does
the same for the documentation.

Format:

```md
# core/runs

Runs one bot's reply: claim, prompt, model call, tools, finish. Rules: architecture.md §6.

| File | What it is for |
| --- | --- |
| `worker.service.ts` | The loop: claim a run, execute it, release or fail it |
| `prompt.rules.ts` | Builds the prompt in the order of conversation-rules.md §4 |
| `tools.service.ts` | The bot's tools (files, skills, handoff) over the workspace port |

Start here: `worker.service.ts`. Do not: call the model except through the model port.
```

- One line of purpose, then a table with every file and subfolder in the folder (tests,
  `README.md` itself and `generated/` excepted), then where to start and what not to do.
- Descriptions say what a file is for, not what it contains line by line, so they change only
  when the purpose changes.
- **Kept current by CI.** `pnpm check:index` fails when a file or subfolder is missing from
  its folder's table, or when the table names something that no longer exists. Whether a
  description is still true is a review item in the PR template.
- Leaves only: the root `README.md` and this section link to the package indexes; there is no
  second, central file list to drift.

## 5. Events: what we do and don't do

"Event-driven" means different things; this app uses two of them.

| | Used | Why |
| --- | --- | --- |
| **Event log** (D9): every state change visible in the UI appends a row to `events` in the same transaction | Yes | Live UI, replay after reconnect, one source for the stream (`realtime-events.md`) |
| **Job queue**: runs are rows claimed with a lease (§6); pg-boss on Postgres later | Yes | Work survives restarts and moves to a separate worker without a redesign |
| **In-process domain events** (a service publishes "message created", another listens) | Optional, only inside one process and one transaction | Allowed when it removes a real coupling; not a framework |
| **Event bus** between services (Kafka, Redpanda, NATS) | No | One process, one database. Nothing to decouple across a network |
| **Event sourcing** (state rebuilt from events) | No | Tables are the source of truth; events describe changes for the UI |

If another system ever needs these changes (analytics, a second service), add an **outbox**:
a relay reads committed `events` rows and publishes them to Redpanda or NATS. The tables and
services stay as they are.

## 6. Runs, the worker, and concurrency

A **run** is one bot answering one trigger message. Lifecycle:

```
queued ──claim (lease)──▶ running ──▶ done
   │                         │ └────▶ failed   (after max attempts; system message shown)
   └──── stop ───────────────┴──────▶ stopped  (owner pressed Stop)
```

- Runs are rows in `runs`. The worker is a loop in the Node process (`core/runs/`, through the
  queue port): claim the oldest `queued` run whose conversation has no `running` run, set
  `locked_until = now + lease`, execute, finish.
- **One running run per conversation** (D11) is enforced in the claim query, not by locks in
  memory, so it survives restarts and a later multi-process worker.
- Different conversations run concurrently, up to `MAX_CONCURRENT_RUNS` (default 3).
- A crash leaves a `running` row with an expired lease; the next claim picks it up again
  (`attempts + 1`). After `MAX_ATTEMPTS` (default 3) it becomes `failed`.
- **Idempotency:** a run produces exactly one bot message; the message row is created when the
  run starts (status `streaming`) and reused on retry, so retries never duplicate messages.
- **Stall timeout:** the lease covers a crashed worker, not a provider that hangs. Each model
  request has a read timeout (`MODEL_REQUEST_TIMEOUT_SECONDS`), and as a backstop the worker
  fails a run that has had no `message.delta` and no `run.step` for `RUN_STALL_SECONDS`. Such a
  run ends `failed` with `error = "timed_out"`; the message shows Retry (UI-3.7). Timed-out runs
  are not retried automatically.
- **Stop:** marks queued runs `stopped`; for the running one, aborts it through an
  `AbortSignal` passed to the model port and checked between tool calls; the message keeps its
  partial text with status `stopped`.

This is the prototype's job/lease design (see `porting-guide.md`), keyed by conversation
instead of a chat-platform thread.

## 7. Example flow: the owner sends "@BA write login stories"

1. Browser `POST /api/conversations/{id}/messages` with text and the mention token for BA.
2. The Hono route parses the body with its Zod schema and calls the messages service, which
   opens a unit of work:
   - checks BA is an `active` member (otherwise 422 `mention_not_member`);
   - inserts the human message (parent = current active leaf), updates
     `active_leaf_message_id`, resets `bot_turns_used` to 0;
   - calls `decideRuns(...)` → `[{ bot: BA, trigger: msg }]`;
   - inserts the run (`queued`) and events `message.created`, `run.queued`;
   - commits. The event hub wakes subscribers.
3. Response `201` with the message. The browser already shows it (optimistic) and reconciles.
4. The worker claims the run, emits `run.started`, creates the bot message (`streaming`), builds
   the prompt (persona, conversation rules block, pinned skills, visible history), and calls the
   model port.
5. Tokens stream as `message.delta` events (not persisted). Partial text is saved about once
   per second. Tool calls go through the workspace port; `load_skill` calls are recorded in
   `run_skills`.
6. On finish: message `complete`, run `done`, token counts saved, events `message.completed`
   and `run.finished`. Then `decideRuns` is called again for the bot's message (bot-to-bot,
   if enabled and budget remains).

## 8. Configuration

All configuration comes from environment variables (`.env` in development), parsed once at
startup by a Zod schema in `app/config.ts` (the process exits with a clear message if one is
invalid), plus `config/models.yaml`.

| Variable | Default | Meaning |
| --- | --- | --- |
| `DATA_DIR` | `./data` | Database, workspaces, avatars |
| `HOST` | `127.0.0.1` | Must stay loopback in phase 1 (startup refuses `0.0.0.0`) |
| `PORT` | `8000` | |
| `ALLOWED_ORIGINS` | `http://127.0.0.1:5173,http://localhost:5173` | Dev frontend origins; prod build is same-origin |
| `MAX_CONCURRENT_RUNS` | `3` | Across conversations |
| `RUN_LEASE_SECONDS` | `900` | |
| `RUN_MAX_ATTEMPTS` | `3` | |
| `RUN_STALL_SECONDS` | `600` | No delta and no step for this long → run fails as `timed_out` |
| `MODEL_REQUEST_TIMEOUT_SECONDS` | `300` | Read timeout per model request |
| `RUNS_PER_CONVERSATION_PER_HOUR` | `50` | Safety cap independent of the turn budget |
| `<PROVIDER>_API_KEY` | none | Names referenced by `config/models.yaml` |

## 9. Observability

- Structured JSON logs with Pino (one line per event) with `conversation_id`, `run_id`,
  `bot_id`. Never log message content at `info`; never log keys (a redaction list in the logger
  config).
- Every run stores model, effort, token counts, duration, attempts, error. A later milestone can
  build a cost view on this table; the data is captured from day one.
- `GET /api/health` returns DB reachability, worker alive, and catalog status.
- Metric `db_lock_wait_seconds` (histogram) around every write transaction: the input to D29's
  switch trigger 3.

## 10. Path to the VPS phase (not built now)

The design keeps these doors open:

| Later need | Why it is cheap |
| --- | --- |
| Separate worker process | Runs are claimed from the DB with leases, not held in memory |
| Postgres (D29 triggers) | The guardrails below; a Drizzle adapter for Postgres behind the same port |
| Durable job queue | `adapters/queue/pg-boss/` behind the queue port, passing its contract suite |
| WebSocket | A second transport adapter; event contract stays (`realtime-events.md` §6) |
| Rate limiting | `hono-rate-limiter` middleware in the HTTP adapter (M9) |
| Multi-user | `author_id`/`created_by` already stored; skills already have authors |
| Docker deployment | Everything configured by env vars; data in one directory |

Database guardrails, enforced in review from M0 (D29):

1. Drizzle's query builder only; no SQLite-only SQL in repositories (no `strftime`, no
   `INSERT OR REPLACE`; use Drizzle's `onConflictDoUpdate`).
2. Portable types: UUIDs as `TEXT` on SQLite and `uuid` on PostgreSQL behind one column helper;
   timestamps in UTC.
3. Migrations generated by drizzle-kit and committed as SQL; on SQLite, drizzle-kit rebuilds a
   table for changes `ALTER TABLE` cannot do, so each generated migration is read before merge.
4. Time bucketing for statistics behind one function (`core/stats/buckets.rules.ts`), so
   PostgreSQL's `date_trunc(..., time zone)` can replace it.
5. From M9: CI runs the tests on PostgreSQL too, and the event stream tolerates commits that
   land out of `seq` order (`realtime-events.md`).
