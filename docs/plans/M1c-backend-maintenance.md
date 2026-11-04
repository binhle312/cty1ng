# M1c plan: Backend maintenance

> **Record, not spec.** Copied from [#55, first comment](https://github.com/binhle312/cty1ng/pull/55#issuecomment-6544708357) on 2026-11-04. The owning documents win where they differ ([index](README.md)).
>
> **Approval:** the plan has no approval line. It holds the changes after the owner's review of 2026-10-31. #55 merged on 2026-11-01.

Brief: `docs/tasks/M1c-backend-maintenance.md`. Checkpoint: **plan**. No migration, no new dependency, no endpoint, no UI.

## 1. Event pruning

```text
app/timed-jobs.ts ──(at start, every EVENT_PRUNE_INTERVAL_HOURS)──▶ core/events/event-pruning.service.ts
                                                                    pruneDue(): cutoff = clock.now() − EVENT_RETENTION_DAYS × 24 h
                                                                    uow.run(tx ⇒ tx.events.deleteBefore(cutoff))   // one DELETE, bound parameter, no event
```

| File | Change |
| --- | --- |
| `core/ports/repositories.ts` | `EventsWriter.deleteBefore(cutoff: Date): Promise<number>`: deletes rows with `created_at < cutoff`, returns the count |
| `adapters/db/repositories.ts` | Drizzle `delete(events).where(lt(events.createdAt, cutoff))`. `created_at` is ISO-8601 UTC text from `toISOString()`, so text order is time order |
| `core/events/event-pruning.service.ts` (new) | `createEventPruning({ uow, clock, retentionDays })` → `{ pruneDue }` |
| `app/config.ts` | `EVENT_RETENTION_DAYS` (30) and `EVENT_PRUNE_INTERVAL_HOURS` (24): `z.coerce.number().int().positive()`. Zod names the variable in the message |
| `app/timed-jobs.ts` | Second job beside the Trash purge. Each job has its own `try/catch` and timer, so a failure in one does not stop the other. Log `event prune` with the count when it is > 0 |
| `app/compose.ts`, `app/main.ts` | Wire the service; pass the interval |

**Seq never goes back.** `events.seq` is `INTEGER PRIMARY KEY AUTOINCREMENT`, so SQLite keeps the high mark in `sqlite_sequence`. Probe: insert 3 rows, delete all, the next insert got seq 4. A test proves it on the real database.

**Gap rule.** `core/events/hub.ts` already decides it as the brief says (`afterSeq < oldest − 1` → `reset`; after a complete removal `oldest` and `newest` are null, so `max_seq` is 0 and a cursor above 0 gets `reset`). The decision does not change. The new SSE tests prune through the service with the manual clock, not raw SQL.

**Hub fix: busy loop after a complete prune (owner's review, 2026-10-31).** The hub notified seq 3, then the job deletes every event. A reconnect gets `reset` and its cursor goes to `max_seq` = 0, but `lastNotified` stays 3. So `waitForNotify` (`hub.ts:23`) resolves at once on every pass, `after(0)` returns nothing, and the loop runs on microtasks only. Timers and I/O never run (the owner's bounded probe made 1,000 empty reads before a zero-delay timer could run). The same loop can happen without a complete prune: if the clock went back, pruning by `created_at` can delete the newest seq and keep an older one.

The fix stops comparing seqs to decide whether to wait:

```text
before:  wait unless lastNotified > cursor          (wrong when pruned seqs are above the cursor)
after:   gen = notify count, read when the page starts
         read page; short page → wait until notify count > gen
```

A notify that comes before the read started was committed before the read, so the read sees it. A notify that comes after it raises the count, so the wait ends at once. No wake is lost, and an empty read never repeats without a new notify. `lastNotified` goes. The hub's interface (`subscribe`, `notify(seq)`) does not change.

Not in this fix: after a complete prune, an up-to-date client (cursor 3) also gets `reset`, because `max_seq` is 0. That costs one reload of state with GETs and is correct by the current rule, so it stays.

## 2. SQLite writer guard (`adapters/db/client.ts`, **needs human review**)

```text
openWriter(file)
  1. new Database(file)
  2. key = dev:ino of the opened file  (statSync(sqlite.name, { bigint: true }), after the open)
     the lookup throws → close this connection, rethrow, nothing registered
  3. key already open?  → close this connection, throw WriterAlreadyOpenError (names the file)
  4. pragmas (busy_timeout, WAL, foreign_keys, synchronous); one throws → close, rethrow, nothing registered
  5. register key → this connection; wrap this connection's close():
       close the connection first; if close() throws, the entry stays (the connection is still open)
       then delete the entry only if it still points to this connection
```

**Cleanup is safe (owner's review, 2026-10-31).** Without the owner check, this sequence removes B's protection: A opens, A closes (file free), B opens (B owns the key), A closes again (a no-op for SQLite) and deletes the key, then a third writer opens next to B. With the check, A's second close leaves B's entry alone. Probes: a second `close()` is a no-op; `close()` throws "This database connection is busy executing a query" while an iterator is open, and the connection stays open.

The identity lookup fails for `:memory:` (`ENOENT`) and for a file removed between the open and the stat. `openWriter` is for the database file only (no caller passes `:memory:`; the in-memory test database in `test/helpers.ts` uses `new Database` directly), so these throw and the connection is closed.

- Keyed on device + inode, read after the open. Probe: a symlink, a hard link and a path with `..` give the same key. `bigint` because inode numbers can exceed 2^53 (WSL, some file systems).
- Check before the pragmas, so a refused second writer fails at once and never waits on `busy_timeout`.
- Probe: a text file that is not a database opens, then `journal_mode = WAL` throws "file is not a database" → step 4 path.
- The registry is a module-level `Map`. It is per JavaScript thread, which is what we want: the deadlock happens only on one thread. `test/contracts/other-writer.worker.ts` (a writer on a worker thread, a stand-in for a second process) keeps working. CLI processes keep their own writer.
- `openReader` is unchanged.
- The comment in `client.ts` and the "Do not" line in `adapters/db/README.md` become "refused by `openWriter`".

## 3. Tests

| Test | Proves |
| --- | --- |
| `app/config.test.ts` | Defaults 30 / 24; each variable refuses `0`, `-1`, `1.5`, `abc` with its name in the message |
| `core/events/event-pruning.service.test.ts` (new, real SQLite unit of work + manual clock) | cutoff − 1 ms deleted, cutoff kept, after cutoff kept; all old → all deleted, count returned; next append's seq > every pruned seq; no event written |
| `app/timed-jobs.test.ts` | Prune at start, on its interval, after a failure (logged, retried); a failing purge does not stop pruning, and the other way round |
| `test/contracts/transport.test.ts` (hub regression, written first and seen to fail on the current hub) | Real SQLite, manual clock, one hub: append 3 events through `appendEvent` (the hub is notified up to 3), move the clock past the window, prune through the service, subscribe again on the same hub with cursor 3 → `ready`, `reset`. Then a zero-delay timer runs, and a new appended event (seq 4) arrives. The reader's `after` is wrapped with a counter that throws after 50 reads, so the old hub fails fast instead of hanging the test worker (a microtask loop also blocks Vitest's own timeout) |
| `test/api/stream.test.ts` | After a prune through the service: cursor < oldest − 1 → `reset` with the `id:` the stream continues from; cursor = oldest − 1 → replay from oldest, no `reset`; a later cursor → replay; after a complete removal, reconnect at the newest seq, then a new event arrives with the next seq |
| `adapters/db/client.test.ts` (new) | Second writer refused: same path, symlink, hard link, relative path with `..`; after close a new one opens; another file opens; readers open while a writer is open; a not-a-database file fails and leaves the file free; A open → A close → B open → A close again → a third writer is still refused next to B; `close()` that throws (an open iterator) keeps the entry, then a clean close frees it; a failed identity lookup (`:memory:`, and a stat that throws, through a spy) closes the connection and registers nothing |
| `adapters/db/migrate.test.ts` | Unchanged; the race tests still pass |

## 4. Docs in the same PR

`architecture.md` §8 (two rows) and §6.1 (event prune row); `domain-model.md` §8 and `realtime-events.md` §2 ("30 days" → `EVENT_RETENTION_DAYS`, default 30); `.env.example`; folder READMEs (`core/events`, `adapters/db`, `app`); `status.md` (M1 merged, M1c state, remove the two follow-up rows).

## 5. Risks

- **One big DELETE.** The first prune after a long time off deletes everything older than 30 days in one statement on the writer. For a local app the count is small (thousands of rows). No index on `created_at` is needed: a full scan once a day is cheap, and an index would need a migration. If it gets slow, delete by `seq` in batches later.
- **Tests that open two writers on one file in one thread.** None found (`grep openWriter`): `migrate.test.ts` closes each writer before the next and races in child processes.

## Needs human review

- The guard in `adapters/db/client.ts` (brief).
- The wait rule in `core/events/hub.ts` (the busy-loop fix; outside the brief's file list, asked for by the owner's review).

## Changes after the owner's review (2026-10-31)

1. Hub busy loop after a complete prune: fixed with a notify count, with a regression test on one hub (§1, §3).
2. Writer cleanup: the entry goes only after `close()` succeeds and only if the connection still owns it; a failed identity lookup closes the connection (§2, §3).

## Open questions

None. Both variables, the defaults and the guard's scope are set in the brief (owner, 2026-10-31).
