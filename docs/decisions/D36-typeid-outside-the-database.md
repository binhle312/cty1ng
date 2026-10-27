# D36. Ids are TypeIDs everywhere outside the database

Status: accepted (2026-10-21, owner). Builds on D22, which still decides the stored value.
Decision: Every id keeps the UUIDv7 value from D22. In the database it is stored as a UUID
(`TEXT` on SQLite, `uuid` on Postgres). Everywhere else it is written as a
[TypeID](https://github.com/jetify-com/typeid): a type prefix, an underscore, and the same
128 bits in 26 lowercase base32 characters. Examples: `bot_01jb8x6p0afqz8r2m3k5t7v9wx`,
`conv_01jb8x7c2d…`. That covers the API, URLs, events, logs, the frontend and the code in
`core/`.

| Table | Prefix | | Table | Prefix |
| --- | --- | --- | --- | --- |
| `bots` | `bot` | | `runs` | `run` |
| `skills` | `skill` | | `run_steps` | `step` |
| `skill_versions` | `skillv` | | `model_requests` | `mreq` |
| `conversations` | `conv` | | `handoffs` | `handoff` |
| `messages` | `msg` | | | |

A new table picks its prefix in the same PR that adds it, and this table is updated with it. Proposed with
D37 and D38: `proj` (projects), `mem` (memory items). With D41: `skilld` (skill drafts). With D51: `fb` (reply feedback), `stest` (skill test cases, amendment 2026-10-27).

- **One conversion point.** A Drizzle custom column type in `adapters/db/` turns a TypeID into
  a UUID on write and back on read. No other code converts.
- **Typed by prefix.** `shared/src/ids.ts` defines one Zod schema per prefix (`BotId`,
  `MessageId`, …), branded as in `frontend-conventions.md`. A wrong prefix fails the parse,
  so passing a message id where a bot id is expected fails both at compile time and at runtime.
- **API errors.** A malformed id, or one with the wrong prefix, returns 422 `invalid_id`.
  A well-formed id that does not exist returns 404 as before.
- **Library.** `typeid-js`, behind the ids port, with `uuidv7` for generation (new
  dependencies, approved with M0's list).

Why: The owner accepted the recommendation. A bare UUID in a log line, URL or bug report says
nothing about what it points to, and two UUIDs can be swapped by mistake without any error. A
prefix makes ids readable and lets the parser reject a mix-up. Storing plain UUIDs keeps the
database compact, keeps native `uuid` on Postgres, and keeps ids sortable by time.
Rejected:
- **Plain UUIDv7 everywhere** (D22 as written): unreadable, and swaps go undetected.
- **Storing the TypeID string in the database:** larger keys and indexes, and the native
  `uuid` type on Postgres is lost.
- **Converting in the HTTP adapter only:** then events, logs and core code would show a
  different form of the same id than the API does.
Consequences:
- Ids in URLs are 30–34 characters instead of 36.
- Fixtures and seed data use TypeIDs.
- A debugging query against the database needs the UUID form. M0 adds a small CLI command
  (`ids decode`) that converts both ways.
Implemented in: `../domain-model.md` §1, `../api.md` §1, `../frontend-conventions.md`,
`../architecture.md` §2, `../tasks/M0-skeleton.md`.
