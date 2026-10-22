# adapters/db

Drizzle on SQLite: tables, repositories, the unit of work (architecture.md §2, §10, §11).

| File | What it is for |
| --- | --- |
| `connection.ts` | Opens the write and read connections (WAL, foreign keys, busy timeout) and migrates |
| `schema.ts` | Table definitions (domain-model.md); drizzle-kit generates migrations from it |
| `columns.ts` | Column helpers: TypeID ⇄ UUID id column, UTC timestamp |
| `typeid.ts` | The one TypeID ⇄ UUID conversion (D36), also used by `ids decode` |
| `events-repository.ts` | Append and read the event log |
| `settings-repository.ts` | Settings rows with compare-and-set |
| `unit-of-work.ts` | `BEGIN IMMEDIATE` transactions, one at a time per process; the database probe |

Start here: `unit-of-work.ts`. Do not: write SQL strings (security.md §2.8) or SQLite-only SQL
(architecture.md §10).
