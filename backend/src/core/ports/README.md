# ports

One file per port (`docs/architecture.md` §2, D35). The core depends on these interfaces; the
adapters implement them. A port whose adapter comes in a later slice is types only, and that
slice may change it with the owner's review.

| File | What it is for |
| --- | --- |
| `repositories.ts` | Repositories and the unit of work: `UnitOfWork.run(tx => …)`, `Readers` |
| `transport.ts` | The realtime transport: `subscribe(afterSeq, signal)` (`docs/realtime-events.md` §1a) |
| `clock.ts` | `now()` |
| `ids.ts` | `newId(prefix)`: a UUIDv7 as a TypeID (D22, D36) |
| `queue.ts` | The job queue (types only; M3) |
| `model.ts` | The model provider (types only; M3) |
| `prices.ts` | Model prices (types only; cost tracking) |
| `workspace.ts` | The Library workspace, `resolve()` included (types only; M6) |

Start here: `repositories.ts`. Do not: import an adapter or an adapter's library here.
