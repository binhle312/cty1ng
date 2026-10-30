# backend

The Node backend: Hono over HTTP, Drizzle on SQLite, ports and adapters (D35,
`docs/architecture.md` §2, §4). It runs TypeScript directly on Node 24, with no build step.

| File | What it is for |
| --- | --- |
| `package.json` | The `@cty1ng/backend` package: `dev`, `start`, `cli`, `typecheck`, `db:*` scripts |
| `tsconfig.json` | Type-check settings for this package |
| `drizzle.config.ts` | drizzle-kit settings: the schema file and the migrations folder |
| `migrations/` | SQL that drizzle-kit writes from the schema, reviewed like code (`docs/architecture.md` §10) |
| `scripts/` | Package scripts |
| `scripts/db-check.ts` | `db:check`: fails when the schema has changes that no migration holds |
| `src/` | The source |
| `src/app/` | The composition root, configuration and the CLI |
| `src/core/` | Business logic and the ports; never imports an adapter |
| `src/adapters/` | One folder per outside system (`http`, `sse`, `db`, `log`, `ids`, `clock`, `model`) |
| `test/` | Tests that are not next to their code |
| `test/helpers.ts` | A test backend on a temporary database, an in-memory logger, SSE frame readers |
| `test/contracts/` | One contract suite per port, run by every adapter |
| `test/api/` | HTTP tests of the routes |
| `test/security/` | The tests of `docs/security.md` §3 |
| `test/fixtures/` | Fake model scripts (`docs/testing.md` §2) |

Start here: `src/app/compose.ts`. Do not: import an adapter from `src/core/`, or one adapter
from another (`docs/architecture.md` §4.1).
