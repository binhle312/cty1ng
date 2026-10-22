# test/contracts

One suite per port; every adapter of that port runs it (D35, architecture.md §2).

| File | What it is for |
| --- | --- |
| `runner.ts` | `defineContract` and `runContract` |
| `transport.contract.ts` | Replay, gap and ordering cases for any transport (realtime-events.md §1a) |
| `unit-of-work.contract.ts` | Commit, rollback and the §11 concurrency cases for any database |

Limits to know (M0a review):

- The unit-of-work races run inside one process. The SQLite adapter serialises its own
  transactions with an in-process lock, so these cases prove the compare-and-set and ordering
  rules, not contention between processes. `BEGIN IMMEDIATE`, `busy_timeout` and the one retry
  on `SQLITE_BUSY` are not exercised across processes yet (a follow-up). The Postgres adapter
  (M9) runs the same cases with real concurrency.
- There is no model contract suite yet: the model port has only the catalog until M3.

Adapters run them in `*.test.ts` files here (`sse.transport.test.ts`,
`drizzle-sqlite.unit-of-work.test.ts`). Do not: test adapter internals here; only the port.
