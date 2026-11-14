# app

The composition root (D35): the only place that wires adapters into the core.

| File | What it is for |
| --- | --- |
| `main.ts` | Starts the backend: configuration, migrations, then the server; stops on any failure before it listens. Loads the app only after the settings pass, so a refused start stays small |
| `main.test.ts` | The real entry point on a port that another program uses: one line, and the database is closed |
| `compose.ts` | Wires the adapters and the core into the Hono app: the bots and avatar services with the disk avatar store |
| `one-line.ts` | Writes a failure line of the CLI or the start on stderr as one line: each control character in its escaped form |
| `one-line.test.ts` | Line breaks, a tab, an escape code, DEL and a C1 control become escapes; other text stays |
| `config.ts` | Environment variables parsed with Zod (`docs/architecture.md` §8), the loopback check, `DATA_DIR` from the repository root |
| `catalog-files.ts` | Reads `config/models.yaml` and `config/tools.yaml` into the catalog; checks at start that the model adapter knows each provider and effort |
| `database.ts` | Opens the database and applies pending migrations (used at start and by `db migrate`) |
| `cli.ts` | Owner commands: `ids decode`, `db migrate`, `skills import`, `export`, `trash`, `restore`, and `bots seed`, `trash`, `restore` |
| `cli.test.ts` | The real commands in their own process: one line and no stack trace for a path that is not there or a bad setting; a stack trace for a failure of another kind |
| `bot-commands.ts` | The `bots` commands: the seed of `seed/bots.yaml`, and `trash` and `restore` until M5b |
| `bot-commands.test.ts` | The seed with the real seed files (order, a second run, no model, a missing skill), Trash list and restore |
| `skill-commands.ts` | The `skills` commands; they call the same services as the API (`trash` and `restore` until M5b) |
| `skill-commands.test.ts` | Import with and without `--apply`, a second run, export, Trash and restore |
| `skill-folders.ts` | Reads `<folder>/<slug>/SKILL.md` for import with the zip's rules; writes an export into an empty folder |
| `timed-jobs.ts` | The timed jobs (`docs/architecture.md` §6.1): the Trash purge (skills, bots, unused avatar files) and the event pruning, each at start and on its interval |
| `timed-jobs.test.ts` | Each job runs at start, on its interval, and after a failure, which never stops the other; each failed purge item gets its own log line |

Start here: `compose.ts`. Do not: put business rules here; they belong in `core/`.
