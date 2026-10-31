# M1c: Backend maintenance

Checkpoint: **plan** (short; the configuration names and the writer guard's behaviour).

## Goal

Two backend tasks that earlier slices left as follow-ups (`status.md`), built in one small PR
after M1b and before M2 (owner, 2026-10-31): the event log is pruned every day, and a second
SQLite writer for the same database in one process is refused at the open, instead of blocking
the thread until `busy_timeout` and failing with `SQLITE_BUSY`. No new
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
  and `EVENT_PRUNE_INTERVAL_HOURS` (24) (owner, 2026-10-31). Event retention is separate from
  Trash retention (`trash_days`). Both are positive integers; `app/config.ts` refuses any other
  value (0, negative, a fraction, text) at startup with a clear message, as for the other
  variables. The job is a core service that takes the time from the clock port, deletes
  through the events repository with bound parameters, and is added to `app/timed-jobs.ts` and
  to the table in `architecture.md` §6.1. Pruning writes no event.
- **SQLite writer guard.** `openWriter` refuses a second writer connection for the same
  database file in the same process, with a clear error; closing the writer frees the file
  again. The check keys on the identity of the opened file (device and inode, read after the
  open), not on its path: an absolute path alone does not catch a symlink, a hard link, or a
  path with `..` or `./` that names the same database. A failed open (a pragma that throws, a
  file that is not a database) closes the connection and leaves nothing registered. Readers
  (`openReader`) are not limited. A CLI command in another process (`db migrate`, `skills …`)
  still opens its own writer while the server runs: the guard is per process, and SQLite's
  lock and `busy_timeout` handle the processes.

## Out of scope

Pruning of anything other than `events` (the Trash purge is M1 and M5b). A cross-process lock.
The `db_lock_wait_seconds` histogram (M3). Any UI.

## Acceptance criteria

- The cutoff is `now − EVENT_RETENTION_DAYS × 24 h`. An event whose `created_at` is before
  the cutoff is deleted; one at the cutoff exactly, or after it, is kept. The job runs at start
  and every `EVENT_PRUNE_INTERVAL_HOURS`, and a failed run is logged and retried at the next
  interval.
- `EVENT_RETENTION_DAYS` and `EVENT_PRUNE_INTERVAL_HOURS` accept only positive integers; any
  other value stops the startup with a message that names the variable.
- When every event is older than the window, the job deletes them all; the stream still works,
  and a new event gets the next seq.
- After pruning, `events.seq` never goes back: a new event gets a seq above every pruned one
  (invariant 7).
- The gap rule (`realtime-events.md` §2), where `oldest` is the seq of the oldest kept event: a
  client whose `Last-Event-ID` is below `oldest − 1` gets `reset` with the `id:` the stream
  continues from, then the live events. A cursor of exactly `oldest − 1` needs no pruned event,
  so it gets the replay from `oldest`, not `reset`; so does any later cursor. This is what
  `core/events/hub.ts` and the transport contract do today; keep it.
- A second `openWriter` for the same file in one process throws, also when the second path is
  a symlink, a hard link or a relative path to the same file; after the first writer closes, a
  new one opens. A failed open leaves the file free. A writer for another file, and any
  number of readers, open while a writer is open.
- A `db migrate` or `skills` CLI process runs while the server process holds its writer (the
  existing race tests in `adapters/db/migrate.test.ts` still pass).

## Tests

- Config: the defaults; each variable refuses 0, a negative number, a fraction and text.
- Pruning service, with the manual clock: an event one millisecond before the cutoff is
  deleted and one at the cutoff is kept; all events old (complete removal), then a new event
  gets a seq above every pruned one.
- Timed job, as in `app/timed-jobs.test.ts`: at start, on the interval, after a failure.
- SSE: prune, then reconnect with a cursor below `oldest − 1` (`reset` with its `id:`), with
  exactly `oldest − 1` (the replay from `oldest`, no `reset`) and with a later one (the
  replay); reconnect after a complete removal.
- Writer guard: the same path; a symlink, a hard link and a relative path with `..` to the
  same file; after close; another file; readers while a writer is open; a failed open (a file
  that is not a database) leaves the file free.
- The existing migration race tests, unchanged.

## Needs human review

The guard in `adapters/db/client.ts`. The two variables are approved (owner, 2026-10-31).

## Open questions

None. The owner set the target, the two variables and their defaults, the guard's scope and
the tests above (2026-10-31).
