# catalog

The model catalog (`docs/architecture.md` §3).

| File | What it is for |
| --- | --- |
| `catalog.ts` | The catalog entries; M0 has only `fake:scripted` when FAKE_MODEL=1 |

Start here: `catalog.ts`. Do not: read provider keys here; availability comes from the wiring.
