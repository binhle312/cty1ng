# db

Drizzle on better-sqlite3 (D29, `docs/architecture.md` §11): the persistence port.

| File | What it is for |
| --- | --- |
| `client.ts` | The writer and reader connections: WAL, `foreign_keys`, `busy_timeout` |
| `schema.ts` | The Drizzle tables (M0: `events`, `settings`; M1: `skills`, `skill_versions`) |
| `columns.ts` | The TypeID column (TypeID in code, UUID in the database) and the UTC timestamp column |
| `repositories.ts` | The events, settings and skills repositories, `setIf` compare-and-set included |
| `unit-of-work.ts` | Write transactions one at a time with `BEGIN IMMEDIATE`; reads on the reader connection |
| `migrate.ts` | The one migration runner: lock first, then apply and record, in one transaction |

Start here: `unit-of-work.ts`. Do not: open a second writer connection in the same process, or
build SQL from strings (`docs/security.md` §2.8).
