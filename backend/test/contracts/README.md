# test/contracts

One suite per port; every adapter of that port runs it (D35, architecture.md §2).

| File | What it is for |
| --- | --- |
| `runner.ts` | `defineContract` and `runContract` |
| `transport.contract.ts` | Replay, gap and ordering cases for any transport (realtime-events.md §1a) |
| `unit-of-work.contract.ts` | Commit, rollback and the §11 concurrency cases for any database |

Adapters run them in `*.test.ts` files here (`sse.transport.test.ts`,
`drizzle-sqlite.unit-of-work.test.ts`). Do not: test adapter internals here; only the port.
