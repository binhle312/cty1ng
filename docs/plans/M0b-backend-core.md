# M0b plan: Backend core

> **Record, not spec.** Copied from [#48, first comment](https://github.com/binhle312/cty1ng/pull/48#issuecomment-6521547149) and [revision 1](https://github.com/binhle312/cty1ng/pull/48#issuecomment-6521767782) on 2026-11-04. The owning documents win where they differ ([index](README.md)).
>
> **Approval:** revision 1 holds the owner's review of 2026-10-30 and replaces decisions A-F. #48 merged on 2026-10-30.

Brief: `docs/tasks/M0-skeleton.md` (§Parts, row M0b). Checkpoint: **plan**. I build nothing until the owner approves this. Acceptance criteria: 2, 3, 4, 8, 10.

## 1. Decisions for the owner

| # | Decision | Recommendation | Why |
| --- | --- | --- | --- |
| A | **Unit of work on SQLite** | `uow.run(async tx => …)`. Write transactions run **one at a time** (an in-process queue) with `BEGIN IMMEDIATE`. Reads outside a transaction use a second, read-only connection. | better-sqlite3 has one connection. An `await` inside a transaction would let other code run inside it. The queue prevents that, and the port stays async, so Postgres fits later. |
| B | **Wrong `Host` error code** | New code `host_rejected` (403) in `api.md` §1. | Today only `origin_rejected` exists, and a bad Host is a different problem (DNS rebinding). |
| C | **Unhandled errors** | New code `internal_error` (500), and an optional `request_id` in the error shape. Every response also has an `X-Request-Id` header. | `security.md` §2.10 says the response returns the request id, but `api.md` has no 5xx code and no field for it. |
| D | **How the backend runs** | No build step: `node src/app/main.ts` uses Node 24's built-in type stripping. Dev uses `tsx watch`. | One less tool. It works because every import already ends in `.ts` (set up in M0a). |
| E | **Migrations** | The app applies pending migrations at start. `pnpm --filter backend db:migrate` exists too. | A local app for one person: starting it should just work. |
| F | **`DATA_DIR`** | A relative path resolves from the repository root, not from `backend/`. | `make dev` runs inside `backend/`, but the docs put `data/` at the root. |

## 2. Ports (`backend/src/core/ports/`, owner approval: they shape every later slice)

| Port | M0b | Shape |
| --- | --- | --- |
| `repositories.ts` | **adapter now** (Drizzle) | `UnitOfWork.run<T>(work: (tx: Tx) => Promise<T>): Promise<T>`. `Tx` gives `events`, `settings` and `afterCommit(fn)`. A `Readers` object gives reads outside a transaction |
| `transport.ts` | **adapter now** (SSE) | `subscribe(afterSeq: number \| null, signal): AsyncIterable<StreamEvent>`. It yields `ready`, then `reset` or the replay, then live events |
| `clock.ts` | **adapter now** | `now(): Date` |
| `ids.ts` | **adapter now** (uuidv7 + typeid-js) | `newId(prefix): TypeID` |
| `queue.ts`, `model.ts`, `prices.ts`, `workspace.ts` | types only | The smallest interface each needs from `architecture.md` §2. The slice that builds the adapter may change it, with owner review |

`settings` gets `get`, `set` and `setIf(key, expected, next)`. `setIf` is the compare-and-set the contract suite needs (AC8).

## 3. What M0b adds

```text
backend/ †
├── package.json  drizzle.config.ts  tsconfig.json
├── migrations/0000_init.sql          events + settings only (domain-model.md §8, §10)
├── src/app/ †                        main.ts (wiring, startup checks), config.ts (Zod env), cli.ts (`ids decode`)
├── src/core/ports/ †                 §2
├── src/core/events/ †                append-event.ts, hub.ts (wakes subscribers after commit)
├── src/core/catalog/ †               `fake:scripted` when FAKE_MODEL=1
├── src/adapters/http/ †              app, routes (health, stream, openapi.json, _test/events), middleware, errors, logger
├── src/adapters/sse/ †               frames, ready, reset, `: ping` every 15 s, `retry: 2000`
├── src/adapters/db/ †                client (WAL, foreign_keys, busy_timeout), schema, TypeID + UTC columns, unit of work, repositories
├── src/adapters/clock/ †  src/adapters/ids/ †
├── src/adapters/model/ †             fake/: FAKE_MODEL switch + YAML script loader (no agent)
└── test/  contracts/ † (transport, unit-of-work)  api/  security/  fixtures/fake-scripts/
.env.example                          every variable in architecture.md §8
```

## 4. Request path and security middleware (owner review: security-sensitive)

In order: request id → Pino logger → **Host check** (`127.0.0.1:PORT`, `localhost:PORT`; 403 `host_rejected`) → **Origin check** (non-GET needs an allowed Origin; GET is checked when Origin is present; the stream too; 403 `origin_rejected`) → `secureHeaders` (the CSP and headers of `security.md` §2.1) → CORS only for `ALLOWED_ORIGINS` → `bodyLimit` 1 MB (413 `too_large`) → route → error handler (code and request id, never a stack).

At start: refuse a non-loopback `HOST`, and refuse `APP_ENV=test` with `NODE_ENV=production`.

Logs are Pino JSON. Values of every `*_API_KEY` variable are redacted in messages, fields and child bindings, also when they are JSON-escaped. JSON keeps newlines escaped, so a log line cannot be forged.

## 5. Routes

| Route | Notes |
| --- | --- |
| `GET /api/health` | `{db, worker: "not_started", catalog: {models, available}}`; 200 when the database works, 503 when not |
| `GET /api/stream` | SSE, with `Last-Event-ID` replay; `reset` when the cursor is older than the oldest kept event or newer than the newest |
| `GET /api/openapi.json` | From `@hono/zod-openapi`; M0c generates the client from it |
| `POST /api/_test/events` | Only when `APP_ENV=test`, and not in the OpenAPI schema. Body `{note}` (strict). Appends `test.ping` |

## 6. New dependencies (owner approval)

| Package | For |
| --- | --- |
| `hono` 4.13, `@hono/node-server` 2.1, `@hono/zod-openapi` 1.6 | HTTP, OpenAPI (D34) |
| `drizzle-orm` 0.45, `drizzle-kit` 0.31 (dev) | Database layer, migrations (D34) |
| `better-sqlite3` 13 (+ `@types/better-sqlite3`) | SQLite. **Native: added to `allowBuilds: true`** (`security.md` §2.11) |
| `pino` 10 | Logs (`architecture.md` §9) |
| `uuidv7` 1.2, `typeid-js` 1.2 | Ids (D22, D36) |
| `yaml` 2.9 | Fake model scripts (`testing.md` §2) |
| `zod` 4.6 | Schemas (already in the workspace) |

## 7. Tests

| AC | Test |
| --- | --- |
| 2 | `test/security/startup.test.ts`: `HOST=0.0.0.0` (and a LAN address) exits with a clear message; `APP_ENV=test` + `NODE_ENV=production` exits |
| 3 | `test/security/host-origin.test.ts`: POST with `Origin: https://evil.com` → 403 `origin_rejected`; POST with no Origin → 403; wrong Host → 403 `host_rejected`; correct → passes; the stream applies the same checks |
| 4 | `test/api/stream.test.ts`: append → a connected client gets it with the right `id`; reconnect with `Last-Event-ID` replays what it missed; an old cursor gets `reset` |
| 8 | `test/contracts/transport.contract.ts`, run against the hub directly **and** over SSE (frames parsed back). `test/contracts/unit-of-work.contract.ts` on Drizzle: two transactions race `setIf` on one row → exactly one wins; a rolled-back transaction leaves no event; `seq` strictly increases under parallel appends; the hub is woken only after commit |
| also | `security.md` §3 items for M0: a sentinel `*_API_KEY` never appears in any response or log line; unknown JSON field → 422; body > 1 MB → 413; an unhandled error gives a code and request id with no stack. `db:check` passes. TypeID column round trip. The fake script loader rejects bad YAML |

## 8. Docs to update in this PR

`api.md` §1 (`host_rejected`, `internal_error`, `request_id`); `architecture.md` §8 if a variable changes; `domain-model.md` §8 note that `events.conversation_id` gets its foreign key with the `conversations` table (M3); `testing.md` if a test location moves.

## 9. Not in M0b

The frontend and `gen:api` (M0c). Event pruning (the daily job comes with the first timed job). The `db_lock_wait_seconds` metric of `architecture.md` §9: I propose it as a follow-up, since there is no metrics output yet. The OpenAPI docs page (`APP_ENV=dev`): it needs a new dependency, so follow-up.

---

# M0b plan, revision 1 (owner review, 2026-10-30)

This replaces decisions A–F of the plan above. Everything else stays.

| # | Revised decision |
| --- | --- |
| **A** | SQLite allows **one active writer per database**. The adapter serializes each **whole** write transaction (an in-process queue, then `BEGIN IMMEDIATE`). Every read inside a transaction goes through that transaction's own repositories, on its connection, so it sees its own writes. Independent reads use a second, read-only connection. WAL mode lets those reads continue during a write. The interface is written out below, so the Postgres fit can be reviewed now. |
| **B** | Two outcomes. A **missing, duplicate or malformed `Host`** gets **400 `bad_request`**: a request-validation failure, not always an attack. Node drops duplicate `Host` headers, so the check counts them in the raw headers. A **well-formed `Host` that is not on the allowlist** gets **403 `host_rejected`**. |
| **C** | `internal_error` (500) is for an unexpected error that the server catches **before it sends the response**. A process crash cannot promise a JSON body. The request id is made by the **first** middleware. It goes in the `X-Request-Id` header, in the error body (`request_id`) and in every log line of that request. Stack traces never go in a response. |
| **D** | Unchanged: no build step. The code uses erasable TypeScript syntax only (`erasableSyntaxOnly`, set in M0a), and `pnpm typecheck` stays a separate `tsc --noEmit` gate. No path aliases: Node ignores `tsconfig.json` at runtime. |
| **E** | One migration runner (`adapters/db/migrate.ts`), used both at start and by `db:migrate`. It reads the drizzle-kit migration files and applies the pending ones in **one `BEGIN IMMEDIATE` transaction**, recording each in the drizzle-kit migrations table. A second process waits for the lock, then finds nothing pending. A failed migration rolls back and **startup stops with a non-zero exit before the server listens**. |
| **F** | `DATA_DIR` is resolved against the repository root, which is found from the backend's own file location (`import.meta.dirname`), never from `process.cwd()`. A test starts the config from the root and from `backend/` and checks that both choose the same folder. |

## The persistence port (`core/ports/repositories.ts`)

```ts
export interface UnitOfWork {
  // One write transaction. A transaction does not begin until any running one has ended. If
  // `work` throws, everything rolls back, and no afterCommit callback runs.
  run<T>(work: (tx: Tx) => Promise<T>): Promise<T>;
}

export interface Tx {
  readonly events: EventsWriter;
  readonly settings: SettingsWriter;
  afterCommit(callback: () => void): void; // runs once, after COMMIT succeeds
}

export interface Readers {
  // Reads outside a transaction. They see only committed data.
  readonly events: EventsReader;
  readonly settings: SettingsReader;
}

export interface EventsReader {
  after(seq: number, limit: number): Promise<PersistedEvent[]>; // ordered by seq
  bounds(): Promise<{ oldest: number | null; newest: number | null }>;
}
export interface EventsWriter extends EventsReader {
  append(event: NewEvent): Promise<number>; // returns the new seq
}

export interface SettingsReader {
  get(key: string): Promise<unknown>; // undefined when the key has no row
}
export interface SettingsWriter extends SettingsReader {
  set(key: string, value: unknown): Promise<void>;
  setIf(key: string, expected: unknown, next: unknown): Promise<boolean>; // compare-and-set
}
```

**Why this fits Postgres:** every method is async. The `Tx` repositories run on the transaction's connection, and `afterCommit` gives the "notify after commit" step that SSE needs on both databases. On Postgres, `run` becomes a normal transaction from a pool, with no queue. What the interface **cannot** prove yet is listed in `realtime-events.md` §5: on Postgres, events can commit out of `seq` order. That is an M9 item, and the contract suite will gain a case for it then.

## Tests added for the revision

- **B:** missing Host, two Host headers and `Host: a b` → 400 `bad_request`. `Host: evil.com:8000` → 403 `host_rejected`.
- **C:** a route that throws gives 500 `internal_error`. The body's `request_id` equals the `X-Request-Id` header and the id in the log line. The body has no stack.
- **E:** two runners started at once apply each migration exactly once. A broken migration leaves the schema unchanged, and startup exits non-zero before it listens.
- **F:** loading the config from the root and from `backend/` gives the same `DATA_DIR`.
