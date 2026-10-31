# M1c: Backend maintenance

Checkpoint: **plan** (short; the configuration names and the writer guard's behaviour).

## Goal

Two backend tasks that earlier slices left as follow-ups (`status.md`), built in one small PR
after M1b and before M2 (owner, 2026-10-31): the event log is pruned every day, and a second
SQLite writer for the same database in one process is refused instead of deadlocking. No new
screen, table or endpoint.

## Read first

`docs/domain-model.md` §8 (events, "pruned by a daily task"); `docs/realtime-events.md` §2 (the
gap rule and `reset`); `docs/architecture.md` §6.1 (timed jobs), §8 (configuration), §11
(SQLite, one writer); `backend/src/adapters/db/client.ts` (the comment this slice turns into a
check); `backend/src/app/timed-jobs.ts` (the M1 purge job); `docs/testing.md` §3.

## In scope

- **Event pruning.** A timed job, at start and then every day, deletes the events whose
  `created_at` is older than the retention window. Default retention: 30 days. Following
  `AGENTS.md` §10 (no hardcoded values), the retention and the interval are environment
  variables with these defaults, written in `architecture.md` §8: `EVENT_RETENTION_DAYS` (30)
  and `EVENT_PRUNE_INTERVAL_HOURS` (24). The job is a core service that takes the time from the
  clock port, deletes through the events repository with bound parameters, and is added to
  `app/timed-jobs.ts` and to the table in `architecture.md` §6.1. Pruning writes no event.
- **SQLite writer guard.** `openWriter` refuses a second writer connection for the same
  database file in the same process, with a clear error; closing the writer frees the file
  again. The check keys on the resolved path of the file. Readers (`openReader`) are not
  limited. A CLI command in another process (`db migrate`, `skills …`) still opens its own
  writer while the server runs: the guard is per process, and SQLite's lock and
  `busy_timeout` handle the processes.

## Out of scope

Pruning of anything other than `events` (the Trash purge is M1 and M5b). A cross-process lock.
The `db_lock_wait_seconds` histogram (M3). Any UI.

## Acceptance criteria

- An event older than `EVENT_RETENTION_DAYS` is deleted by the job; a newer one is kept; the
  job runs at start and every `EVENT_PRUNE_INTERVAL_HOURS`, and a failed run is logged and
  retried at the next interval.
- After pruning, `events.seq` never goes back: a new event gets a seq above every pruned one
  (invariant 7).
- A client whose `Last-Event-ID` is older than the oldest kept event gets `reset` with the
  `id:` the stream continues from, then the live events (`realtime-events.md` §2). A client
  whose cursor is still inside the window gets the replay, not `reset`.
- A second `openWriter` for the same file in one process throws; after the first writer
  closes, a new one opens. A writer for another file, and any number of readers, open while a
  writer is open.
- A `db migrate` or `skills` CLI process runs while the server process holds its writer (the
  existing race tests in `adapters/db/migrate.test.ts` still pass).

## Tests

Service test for the pruning job with the manual clock (kept and deleted rows, the seq after a
prune); timed job test as in `app/timed-jobs.test.ts`; SSE test: prune, then reconnect with a
pruned cursor and with a kept one; unit tests for the writer guard (same path, after close,
another path, readers); the existing migration race tests unchanged.

## Needs human review

The two new environment variables and their defaults. The guard in `adapters/db/client.ts`.

## Open questions

None. The owner set the target, the retention default and the guard's scope (2026-10-31).
