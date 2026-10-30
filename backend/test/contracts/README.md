# contracts

One contract suite per port (D35). A new adapter must pass its port's suite
(`docs/architecture.md` §4.1).

| File | What it is for |
| --- | --- |
| `transport.contract.ts` | The transport suite: replay, the gap rule, order, only committed events |
| `unit-of-work.contract.ts` | The unit-of-work suite: commit, rollback, compare-and-set races, seq order (`docs/architecture.md` §11) |
| `other-writer.worker.ts` | A second SQLite writer on its own thread, as a second process would be |

The `*.test.ts` files run each suite against the adapters. Start here:
`unit-of-work.contract.ts`.
