# Architecture

## 1. The big picture

```
Browser (React SPA, served by Vite in dev, by FastAPI as static files in prod builds)
  │  HTTP  POST / PATCH / PUT / DELETE   (actions)        ─┐
  │  HTTP  GET                             (reads)          │ generated TS client
  │  SSE   GET /api/stream                 (live events)   ─┘
  ▼
FastAPI process (one process in phase 1)
  ├─ api/          routers: validate input, call services, map errors
  ├─ services/     use cases: bots, skills, conversations, messages, runs, handoffs
  ├─ domain/       pure rules: routing, budget, mentions, history window (no I/O)
  ├─ events/       append events in the same DB transaction; fan out to SSE subscribers
  ├─ worker/       claims queued runs with a lease, runs the agent, writes results
  ├─ agent/        Pydantic AI agent, prompt builder, tools (files, skills, handoff)
  ├─ workspace/    per-conversation folder + git repo, path sandbox
  ├─ catalog/      model catalog loader, provider adapters (effort mapping)
  └─ db/           SQLAlchemy models, session, Alembic migrations
        │
        ▼
  data/app.db (SQLite, WAL)   data/workspaces/<conversation_id>/   data/avatars/
```

## 2. Components and their contracts

| Component | Owns | Must not |
| --- | --- | --- |
| `api/` | HTTP shapes (Pydantic schemas), status codes, error mapping | Contain business rules or SQL |
| `services/` | Transactions, orchestration of domain + db + events | Talk HTTP; call the model directly |
| `domain/` | Decisions as pure functions (`decide_runs`, `budget_after`, `visible_history`, `parse_mentions`) | Import db, httpx, pydantic-ai, `datetime.now()` |
| `events/` | `append_event(session, type, payload)`; the in-process hub that wakes SSE streams | Be called outside a DB transaction that also changes state |
| `worker/` | Claiming runs, leases, retries, cancellation, writing the bot message | Decide who runs (that is `domain/`) |
| `agent/` | Building the prompt, the tool functions, calling Pydantic AI, streaming deltas | Read or write workspace paths except via `workspace/` |
| `workspace/` | Path resolution and the sandbox, git commits | Know about bots or conversations beyond ids and write paths |
| `catalog/` | Reading `config/models.yaml`, availability (API key present), effort → provider parameter | Store keys anywhere |
| `db/` | Table definitions, migrations | Business logic |

**Why `domain/` is pure.** Routing ("who runs next?") is where bugs hide: mentions, budgets,
pending members, deleted bots, branches. As a pure function it can be tested with hundreds of
table rows in milliseconds and read by a reviewer in one sitting. Services gather the state,
call the function, and act on the answer.

## 3. Repository layout

```
.
├─ AGENTS.md                 rules for coding agents
├─ CLAUDE.md                 "@AGENTS.md"
├─ README.md                 what it is, quickstart
├─ Makefile                  dev, test, lint shortcuts
├─ config/
│  └─ models.yaml            model catalog
├─ docs/                     this specification
├─ backend/
│  ├─ pyproject.toml         uv-managed, Python 3.14+
│  ├─ alembic/               migrations
│  ├─ app/
│  │  ├─ main.py             app factory, middleware, static files
│  │  ├─ settings.py         env-based settings (pydantic-settings)
│  │  ├─ ids.py              UUIDv7 helpers (D22)
│  │  ├─ api/ services/ domain/ events/ worker/ agent/ workspace/ catalog/ db/
│  │  └─ cli.py              `app skills import <folder>`, `app skills export <folder>`
│  └─ tests/                 mirrors app/ (unit, api, agent, security)
├─ frontend/
│  ├─ package.json           pnpm
│  ├─ src/
│  │  ├─ api/generated/      generated client (never edit)
│  │  ├─ api/                hooks wrapping the client (TanStack Query)
│  │  ├─ stream/             SSE connection, event reducer
│  │  ├─ flow/               Flow pane: scene, cues, renderer contract, diagram renderer (flow-view.md)
│  │  ├─ routes/             TanStack Router route tree (D28)
│  │  ├─ theme/              token files per theme (command.css, material.css), variants.ts (D30, design/themes.md)
│  │  ├─ pages/              conversation, bots, bot-detail, bot-create, skills, skill-edit, settings
│  │  ├─ components/         header, rail, message, composer, chips, cards, avatar-stack
│  │  └─ lib/                markdown renderer (sanitised), formatting
│  └─ tests/                 Vitest unit + Playwright e2e
└─ data/                     runtime data (git-ignored)
```

## 4. Runs, the worker, and concurrency

A **run** is one bot answering one trigger message. Lifecycle:

```
queued ──claim (lease)──▶ running ──▶ done
   │                         │ └────▶ failed   (after max attempts; system message shown)
   └──── stop ───────────────┴──────▶ stopped  (owner pressed Stop)
```

- Runs are rows in `runs`. The worker is an asyncio task in the FastAPI process that loops:
  claim the oldest `queued` run whose conversation has no `running` run, set
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
- **Stop:** marks queued runs `stopped`; for the running one, sets a cancel flag the agent
  loop checks between model requests and between streamed chunks; the message keeps its
  partial text with status `stopped`.

This is the prototype's job/lease design (see `porting-guide.md`), keyed by conversation
instead of Discord thread.

## 5. Example flow: the owner sends "@BA write login stories"

1. Browser `POST /api/conversations/{id}/messages` with text and the mention token for BA.
2. Router validates the schema. Service opens a transaction:
   - checks BA is an `active` member (otherwise 422 `mention_not_member`);
   - inserts the human message (parent = current active leaf), updates
     `active_leaf_message_id`, resets `bot_turns_used` to 0;
   - calls `domain.decide_runs(...)` → `[RunRequest(bot=BA, trigger=msg)]`;
   - inserts the run (`queued`) and events `message.created`, `run.queued`;
   - commits. The event hub wakes SSE subscribers.
3. Response `201` with the message. The browser already shows it (optimistic) and reconciles.
4. Worker claims the run, emits `run.started`, creates the bot message (`streaming`), builds the
   prompt (persona, conversation rules block, pinned skills, visible history), and runs the
   agent.
5. Tokens stream as `message.delta` events (not persisted). Partial text is saved about once
   per second. Tool calls run through `workspace/`; `load_skill` calls are recorded in
   `run_skills`.
6. On finish: message `complete`, run `done`, token counts saved, events `message.completed`
   and `run.finished`. Then `decide_runs` is called again for the bot's message (bot-to-bot,
   if enabled and budget remains).

## 6. Configuration

All configuration comes from environment variables (`.env` in development) read by
`app/settings.py`, plus `config/models.yaml`.

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

## 7. Observability

- Structured JSON logs (one line per event) with `conversation_id`, `run_id`, `bot_id`.
  Never log message content at INFO; never log keys.
- Every run stores model, effort, token counts, duration, attempts, error. A later milestone can
  build a cost view on this table; the data is captured from day one.
- `GET /api/health` returns DB reachability, worker alive, and catalog status.
- Metric `db_lock_wait_seconds` (histogram) around every write transaction: the input to D29's
  switch trigger 3.

## 8. Path to the VPS phase (not built now)

The design keeps these doors open:

| Later need | Why it is cheap |
| --- | --- |
| Separate worker process | Runs are claimed from the DB with leases, not held in memory |
| Postgres (D29 triggers) | The five guardrails below |
| WebSocket | Only `events/stream.py` and `frontend/src/stream/` change; event contract stays |
| Multi-user | `author_id`/`created_by` already stored; skills already have authors |
| Docker deployment | Everything configured by env vars; data in one directory |

Database guardrails, enforced in review from M0 (D29):

1. SQLAlchemy only; no SQLite-only SQL in services (no `strftime`, no `INSERT OR REPLACE`;
   use the dialect-aware upsert).
2. Portable types: UUIDs through a type that is `TEXT` on SQLite and `uuid` on PostgreSQL;
   timestamps in UTC.
3. Alembic with `render_as_batch=True`.
4. Time bucketing for statistics behind one function (`services/stats/buckets.py`), so
   PostgreSQL's `date_trunc(..., time zone)` can replace it.
5. From M9: CI runs the tests on PostgreSQL too, and the event stream tolerates commits that
   land out of `seq` order (`realtime-events.md`).
