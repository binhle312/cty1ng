# app

The composition root (D35): the only place that wires adapters into the core.

| File | What it is for |
| --- | --- |
| `main.ts` | Starts the backend: configuration, migrations, then the server; stops on any failure before it listens |
| `compose.ts` | Wires the adapters and the core into the Hono app |
| `config.ts` | Environment variables parsed with Zod (`docs/architecture.md` §8), the loopback check, `DATA_DIR` from the repository root |
| `database.ts` | Opens the database and applies pending migrations (used at start and by `db migrate`) |
| `cli.ts` | Owner commands: `ids decode`, `db migrate` |

Start here: `compose.ts`. Do not: put business rules here; they belong in `core/`.
