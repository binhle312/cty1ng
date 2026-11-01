# catalog

The model catalog and the tool catalog (`docs/domain-model.md` §4, §4.1; `docs/architecture.md` §3).

| File | What it is for |
| --- | --- |
| `catalog.rules.ts` | Checks the parsed `config/models.yaml` and `config/tools.yaml`, adds the fake models with FAKE_MODEL=1, and says whether a model can run |
| `catalog.rules.test.ts` | Availability, file order, the fake models, every refused entry |

Start here: `catalog.rules.ts`. Do not: read files or provider keys here; `app/` passes the file contents and which key variables are set.
