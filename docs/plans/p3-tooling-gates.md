# P3 list PR 19: tooling gates

Brief: P3 list of 2026-11-12, part 2, items 73, 74, 75 and 76 (part 5, PR 19), approved by the owner on 2026-11-12
Checkpoint: none (tooling only; no UI, no code design)
Approval: chief agent, 2026-11-15, under the owner's order of 2026-11-14 (P3 questions to consultants); accepted by the owner, 2026-11-15

## Items and their state on `main` (`97221d3`)

| Item | Defect | How I know |
| --- | --- | --- |
| 73 | `db:check` compares only the number of migration files, so a hand edit of a committed `.sql` passes (audit of 2026-11-05) | read `scripts/db-check.ts`; red run comes with the test |
| 74 | The SQL rule and the bot-list write rule are narrower than the text that relies on them; `pnpm lint` allows warnings | read `eslint.config.js`; a dry run of the wider selectors (below) |
| 75 | `pnpm e2e:serve` stops its servers only on SIGINT and SIGTERM; when it dies another way, its detached server groups stay on the ports | read `scripts/e2e-serve.ts:35-36`; red run comes with the test |
| 76 | No test runs `scripts/e2e-serve.ts` itself | no test file spawns the script |

Dry run of `eslint . --max-warnings 0` on `main`: exit 0, 387 files, 0 warnings, 0 errors, 107
suppressed messages (104 `max-params` from `eslint-suppressions.json`, 3 from inline disables).
Suppressed messages do not count against `--max-warnings`. An unused suppression already fails the
run (ESLint prints "There are suppressions left that do not occur anymore", exit 2).

## Changes

### 73: `db:check` reads the SQL

- `scripts/lib/db-schema.ts` (pure): the schema of a database from its `sqlite_master` rows. A table
  is the set of the clauses of its CREATE TABLE text, so a column that `ALTER TABLE ... ADD` put at
  the end, or the quotes of a rename, make no difference. Other objects are their CREATE text.
- `scripts/db-check.ts` keeps its file-count check, then applies the committed migrations (journal
  order, split at `--> statement-breakpoint`) to one in-memory database, applies a migration that
  `drizzle-kit generate` writes from `schema.ts` into an empty folder to a second one, and fails
  with each difference. It uses `node:sqlite`, which is part of Node 26: no new dependency.
- Seam: `DB_CHECK_MIGRATIONS` names the source folder (default `backend/migrations`), so a test
  runs the script on a copy.
- Not claimed: a hand-added data statement that does not change the schema; the meta snapshots
  (`drizzle-kit check` reads those).

### 74: lint guards and warnings

- `pnpm lint` runs `eslint . --max-warnings 0`.
- SQL rule: `sql.raw` also in member form (`orm.sql.raw`); a renamed `sql` import is refused, so the
  `sql.raw` rule sees each named import; `db`/`tx` `run|execute|all|get|values` refuse each first
  argument that is not a `sql` tagged template (a string in a variable, a call result).
- Bot-list write rule: the key call anywhere in the arguments of `setQueryData`/`setQueriesData`
  (the filters form of `setQueriesData`), the `...Options().queryKey` form, and every non-test file
  of `frontend/src` except the store.
- The two texts say what lint checks and what it does not: `docs/security.md` §2.8 and
  `docs/frontend-conventions.md` §1 (the bot-list row).
- Not claimed: `exec`/`prepare` on a better-sqlite3 handle with a built string. A wider rule flags 4
  places today (`migrate.ts` x3, `bots-schema.test.ts:67`) and #113 rewrites `migrate.ts`, so this
  waits for a later PR (chief, 2026-11-15, Q1 B).

### 75 and 76: `e2e:serve` stops on more exits, and a test runs the script

- `scripts/e2e-serve.ts` also stops its server groups on SIGHUP, on an uncaught exception, and on an
  unhandled rejection.
- Seam: `E2E_SERVE_SERVERS` names a JSON file with the web servers; without it, the script reads
  `frontend/playwright.config.ts` as before. `E2E_SERVE_MARKER` exists already.
- `scripts/e2e-serve.test.ts` spawns the script with fixture servers on free ports, never 8100 or
  8101. A test signals only the pids that it started or that the fixtures printed, each checked as a
  positive integer, and kills no process by a pattern.
- Not claimed: SIGKILL or an out-of-memory kill of the script. Nothing kills the servers of a dead
  run at the next start: a recorded pid can belong to another process by then.

## Test strategy

| Behaviour | Test | Level | Cases beyond the normal path |
| --- | --- | --- | --- |
| Same schema in another clause order, after ADD COLUMN, after a rename: no difference | `scripts/lib/db-schema.test.ts` | unit | quotes and commas inside a CHECK and a DEFAULT |
| A changed NOT NULL, CHECK, index column or partial WHERE: a difference | `scripts/lib/db-schema.test.ts` | unit | an object only on one side |
| `db:check` passes on the committed migrations and fails on a hand-edited copy | `scripts/db-check.test.ts` | process | a dropped NOT NULL; a renamed index |
| Each SQL-rule gap is refused; `Map.get` with a template key and `db.get(sql\`...\`)` pass | `scripts/lint-rules.test.ts` | lint | renamed import, member form, variable argument |
| Each bot-list gap is refused | `scripts/lint-rules.test.ts` | lint | filters form, `Options().queryKey`, a file in `lib/` |
| `e2e:serve` starts, writes the marker, and on SIGTERM removes it and stops the servers | `scripts/e2e-serve.test.ts` | process | ports free again |
| SIGHUP stops the servers | `scripts/e2e-serve.test.ts` | process | red on the old script |
| A closed stdout (EPIPE) stops the servers | `scripts/e2e-serve.test.ts` | process | red on the old script |
| A second start while one runs exits 1 | `scripts/e2e-serve.test.ts` | process | the first keeps its marker |

Evidence: test first, with the red run of each new test in the PR. The SQL-rule reject tests are
security tests, so `scripts/breaks/pr-<n>.json` has a break for each (a break changes a selector
value in `eslint.config.js`).

## Risks

- Process tests under load: each spawn takes about 1 s; each wait has its own deadline and label, and
  the waits of one test add up to less than its 20 s limit (review round 1 of #120, R1-8).
- A future migration shape that the unit tests do not cover could make a false difference.

## Changes during the build (2026-11-15)

- No last step on `exit`: nothing in the script calls `process.exit` before its stop has ended, so
  that step covered no path. Removed before the build commit.
- The process test runs the script with `node`, not through pnpm and tsx. Not claimed: how pnpm
  and tsx pass a signal on.

## Open questions

Answered by the chief on 2026-11-15: Q1 B (no `exec`/`prepare` widening), Q2 A (narrow the two
texts), Q3 A plus a break list for the SQL-rule tests.
