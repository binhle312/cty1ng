# core/ports

One interface per external dependency; adapters implement them (D35, architecture.md §2).
Ports whose adapter comes in a later slice are types only.

| File | What it is for |
| --- | --- |
| `transport.ts` | `EventFeed.subscribe(cursor)`: what a transport adapter (SSE) reads from |
| `repositories.ts` | Repositories per aggregate, the unit of work, the committed event-log reader |
| `queue.ts` | Run queue: enqueue, claim with lease, finish, fail (types only until M3) |
| `model.ts` | Model provider and catalog entry (catalog only until M3) |
| `prices.ts` | Price source for usage (types only, D21) |
| `workspace.ts` | Workspace with `resolve()` as the only path gate (types only until M6) |
| `clock.ts` | Now |
| `ids.ts` | New TypeID with a UUIDv7 inside (D22, D36) |

Start here: `repositories.ts`. Do not: import a library here; ports are plain TypeScript.
