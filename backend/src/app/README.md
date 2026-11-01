# app

The composition root (D35): the only place that wires adapters into the core.

| File | What it is for |
| --- | --- |
| `main.ts` | Starts the backend: configuration, migrations, then the server; stops on any failure before it listens |
| `compose.ts` | Wires the adapters and the core into the Hono app |
| `config.ts` | Environment variables parsed with Zod (`docs/architecture.md` §8), the loopback check, `DATA_DIR` from the repository root |
| `catalog-files.ts` | Reads `config/models.yaml` and `config/tools.yaml` into the catalog; checks at start that the model adapter knows each provider and effort |
| `database.ts` | Opens the database and applies pending migrations (used at start and by `db migrate`) |
| `cli.ts` | Owner commands: `ids decode`, `db migrate`, and `skills import`, `export`, `trash`, `restore` |
| `skill-commands.ts` | The `skills` commands; they call the same services as the API (`trash` and `restore` until M5b) |
| `skill-commands.test.ts` | Import with and without `--apply`, a second run, export, Trash and restore |
| `skill-folders.ts` | Reads `<folder>/<slug>/SKILL.md` for import with the zip's rules; writes an export into an empty folder |
| `timed-jobs.ts` | The timed jobs (`docs/architecture.md` §6.1): the Trash purge and the event pruning, each at start and on its interval |
| `timed-jobs.test.ts` | Each job runs at start, on its interval, and after a failure, which never stops the other |

Start here: `compose.ts`. Do not: put business rules here; they belong in `core/`.
