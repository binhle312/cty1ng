# P3 list PR 6: the migration runner turns foreign keys off for a table rebuild

Brief: none. The source is item 22 of the P3 list (the audit of 2026-11-05, "Backend and data",
"Fix before M3") and the owner's answer of 2026-11-13 (question 10).
Checkpoint: plan (`AGENTS.md` §7: how migrations run).
Approval: the owner, 2026-11-13 (revision 3). The owner approved revision 1 with its five points and two additions (part 8), and dropped the addition to point 2 on the same day (part 6a).

The branch `fix-migration-foreign-keys` starts from `main`. No open PR changes `migrate.ts`.

## 1. The problem

`backend/src/adapters/db/migrate.ts` runs each statement of each waiting migration inside one
`BEGIN IMMEDIATE`. For a change that `ALTER TABLE` cannot do, drizzle-kit rebuilds the table: a
new table, a copy of the rows, `DROP TABLE` of the old one, a rename. It puts
`PRAGMA foreign_keys=OFF` before these statements. SQLite ignores that statement inside a
transaction, so the `DROP TABLE` of a parent table runs with the keys on.

A probe (2026-11-13, the `better-sqlite3` of the repository, SQLite 3.53.4, an in-memory
database; the second opinion of the owner repeated it): a rebuild of a parent table that has one
child row.

| The foreign key of the child | The runner of today | The design of part 2 |
| --- | --- | --- |
| `ON DELETE no action` | Fails: `FOREIGN KEY constraint failed` | Passes; the child row stays |
| `ON DELETE cascade` | **Passes, and the child row is gone** | Passes; the child row stays |
| `ON DELETE set null` | **Passes, and the child loses its parent id** | Passes; the child row stays |

`main` has no key with a delete action: `backend/migrations` has three migration files, and two
of them (`0001_skills.sql`, `0002_bots.sql`) have six foreign keys, each with
`ON DELETE no action` (a search by the second opinion; checked again on `97221d3`, see part 10).
So `main` loses no data today.

`PRAGMA defer_foreign_keys=ON` inside the transaction is no fix: it fails for `no action` and
loses data for the other two (the same probe).

## 2. The design (owner, 2026-11-13)

The runner does the steps in this order:

1. `PRAGMA foreign_keys=OFF`, before the transaction.
2. `BEGIN IMMEDIATE`. The write lock comes first, as today.
3. Read the last applied migration. Apply and record each waiting migration. All waiting
   migrations are in this one transaction, as today.
4. If one or more migrations were applied: `PRAGMA foreign_key_check`. One or more rows mean
   `ROLLBACK` and an error.
5. `COMMIT`.
6. In a `finally` block: `PRAGMA foreign_keys=ON`. Then the runner reads the value back. If the
   value is not 1, the runner throws, and the start stops.

**Why step 6 matters.** `migrate()` gets the writer connection, and the app uses that
connection for each write after the start (`backend/src/app/database.ts`). A runner that
leaves the keys off lets rows with a broken reference in, with no error.

**The PRAGMA lines of a migration file do no work.** Inside the transaction,
`PRAGMA foreign_keys=ON` and `PRAGMA foreign_keys=OFF` change nothing (probe: the value stays
0). Only the runner sets the value. The comment of `migrate.ts` says this.

**A DELETE in a migration starts no delete action.** With the keys off, `ON DELETE cascade`
and `ON DELETE set null` do not run. The child row stays, and `foreign_key_check` finds it
(probe). So the migration stops with a rollback and loses no data. A person who writes such a
migration must delete or change the child rows in the migration itself.

**The error of a failed check** names the table, the row number (`rowid`) and the parent
table of each broken reference, and how many there are. It has no data of a row.
`foreign_key_check` gives these values: `table`, `rowid`, `parent`, `fkid` (probe). For a table
with no `rowid`, the value is null, and the message names only the tables. The message shows
the first 10 references and the full count.

**When the check runs: only when a migration was applied.** The other choice is a check at
each start. I measured the check: 32 ms for 200,000 child rows. The time is not the reason.
The reason: a check at each start is a new gate for data that is there already, and it can
stop a start that works today. That is a different decision from item 22.

One effect of the design: a broken reference that the database has already stops the next
migration, because the check reads each table. The message names the row, and the owner
repairs it. With the keys always on in the app, such a row cannot come from a normal write.

A caller that is inside a transaction: `BEGIN IMMEDIATE` fails there today, and it still fails
before a statement of a migration runs. No new guard.

Two processes at the same time: `foreign_keys` is a setting of one connection. Each process
turns its own keys off, then waits for the write lock. The second process finds nothing
waiting, runs no check, and turns its keys on again.

## 3. Files to touch

| File | Change |
| --- | --- |
| `backend/src/adapters/db/migrate.ts` | The steps of part 2, the message of the failed check, the comment |
| `backend/src/adapters/db/migrate.test.ts` | The tests of part 5 |
| `scripts/breaks/pr-<n>.json` | Part 5: four tests (10 to 13) pass on the old code, so each needs a break (part 10) |
| `docs/architecture.md` §10, guardrail 3 | The text for a person who writes a migration (part 4) |
| `docs/domain-model.md`, the line about `foreign_keys=ON` | One clause: the migration runner turns the keys off while it applies migrations |
| `backend/src/adapters/db/README.md` | The row of `migrate.ts`, if its words change |
| `docs/audits/2026-11-05-repo-audit.md`, the bullet of item 22 | The new fact (part 6), and "Fixed in #<n>" |
| `docs/plans/README.md`, this file | The plan and its row |
| `docs/delivery-quality.md`, `docs/status.md` | The records of the PR. DQ ids: DQ-310 to DQ-319 |

No new migration file: the tests build their own migration folders in a temporary folder, as
the test "rolls back every migration of the run when one fails" does today. No new dependency,
no API change, no screen.

## 4. The text for a person who writes a migration (guardrail 3, to approve)

> The migration runner turns foreign keys off before its transaction and on again after it. A
> `PRAGMA foreign_keys` line in a migration file does nothing. Before the commit, the runner
> runs `PRAGMA foreign_key_check`; a broken reference stops the run, and no migration of the
> run is applied. While a migration runs, a `DELETE` starts no `ON DELETE` action: delete or
> change the child rows in the migration.

## 5. Test strategy

All tests are in `backend/src/adapters/db/migrate.test.ts`, with a real database file in a
temporary folder and a migration folder that the test writes. I write each test before the
code and record its failure on `main`.

| # | Behaviour | Fails on `main` with |
| --- | --- | --- |
| 1 | A rebuild of a parent table with a child row, `no action`: passes, the child row and the new column are there | `FOREIGN KEY constraint failed` |
| 2 | The same with `cascade`: the child row stays | The child row is gone |
| 3 | The same with `set null`: the child keeps its parent id | The parent id is null |
| 4 | A migration file that has `PRAGMA foreign_keys=ON` before its rebuild gives the same result as test 2 | The child row is gone |
| 5 | A migration deletes a parent row that has a `cascade` child: the run stops, the two rows are there, no migration is recorded | The run passes, and the child row is gone |
| 6 | A migration leaves a broken reference: the run stops; the message has the table, the row number, the parent table and the count; it does not have a value of the row | The run fails with another message (`FOREIGN KEY constraint failed`) |
| 7 | Two waiting migrations, and the check fails after the second: the first is rolled back too | As test 6 |
| 8 | More than 10 broken references: the message shows 10 and the full count | As test 6 |
| 9 | Three processes start at the same time on a database with rows, and the new migration is a rebuild: it is applied one time, and no row is lost | `FOREIGN KEY constraint failed` |
| 10 | Nothing waits, and the database has an old broken reference: the run passes and applies 0 (the check does not run) | Passes on `main`: not a claim; it holds the choice of part 2 |
| 11 | `foreign_keys` is 1 after a success | Passes on `main` |
| 12 | `foreign_keys` is 1 after a failed statement | Passes on `main` |
| 13 | `foreign_keys` is 1 after a failed check | Passes on `main`: the run fails there for another reason, and the value is 1 |
| 14 | The value that the runner reads back is not 1: the runner throws | No such check on `main` |

**Break list.** Tests 11 to 13 guard new code and pass on the old code, so a red run on `main`
proves nothing. Each gets a claim in `scripts/breaks/pr-<n>.json` with one break of the new
code: the `finally` block does not turn the keys on. Test 10 gets a claim with the break "the
check runs also when nothing was applied". The other tests get an `exempt` entry with the
reason "written before the code; the red run is in the PR".

Test 14 needs a connection that gives a wrong value. The test replaces `pragma` of one
connection for the read-back only. It is the only test with a replaced function.

Order and time cases: test 9 (three processes); test 7 (a failure after an applied migration);
tests 11 to 13 (the state after each end of the run). A late answer or a second tab does not
apply: the runner ends before the server listens.

The tests of today stay: the two races, the rollback, and "exits non-zero before it listens".

## 6. The record of the new fact (owner, 2026-11-13)

Item 22 has no row in the ledger. Its record is one bullet of the audit file
(`docs/audits/2026-11-05-repo-audit.md`, "Backend and data"). The PR writes the new fact there
and in a new issue row (DQ-310):

> With `ON DELETE cascade` or `ON DELETE set null`, the runner of today loses data with no
> error. `main` has no such key: the six foreign keys of the migration files (two in
> `0001_skills.sql`, four in `0002_bots.sql`) each have `ON DELETE no action`.

In the audit file, the old sentence of the bullet stays as it is. The new fact comes after it,
with the date. The PR does not write the old sentence again (owner, 2026-11-13).

No open PR can take this record: each one is after its round 1. So this PR records it.

## 6a. No check of the real database (owner, 2026-11-13)

The owner's statement of 2026-11-13: "I have not used the app yet. I start to use it after the
conversation feature is there. So no real database exists, and the check has nothing to read."
The owner dropped the addition to point 2 (one `PRAGMA foreign_key_check` on the real database
before the merge).

## 7. Risks

- **The keys stay off after a failure.** Step 6 and tests 11 to 14 are for this.
- **An old broken reference stops the next migration.** The message names the row.
- **A migration that used a delete action now stops.** No shipped migration has a `DELETE`. The
  text of part 4 tells the writer what to do.
- **PostgreSQL later (D29).** This runner is for SQLite only. The plan changes nothing for M9.

Not claimed: that drizzle-kit writes its rebuild statements in the order of the tests. I wrote
the statements by hand from memory. The builder generates one real rebuild with
`pnpm --filter backend db:generate` in a scratch copy and uses its statements in test 1.

## 8. The owner's decisions (2026-11-13, question 10)

> Question 10 (list PR 6): A. I approve the design of the third column. A plan comes first,
> with its test strategy.
> [...] Five points for the plan:
> 1. The state of foreign_keys after the run. migrate() gets the writer connection, and the
>    app uses that connection for each write after the start (backend/src/app/database.ts).
>    So the runner sets foreign_keys=ON in a finally block, reads the value back, and stops
>    the start if it is not 1. Tests: after a success, after a failed statement, after a
>    failed foreign_key_check.
> 2. A statement "PRAGMA foreign_keys=ON" inside the transaction changes nothing (run: the
>    value stays 0). So the PRAGMA lines of a migration file do no work, and only the runner
>    sets the value. Say this in the comment of migrate.ts.
> 3. One more effect, from a run: with the keys off, a DELETE in a migration does not start
>    ON DELETE cascade or set null. The child row stays, and foreign_key_check finds it. So
>    the migration stops with a rollback and loses no data. Add this case to the tests and
>    to the text for a person who writes a migration.
> 4. Keep one transaction for all waiting migrations, with BEGIN IMMEDIATE first, as today.
>    Say in the plan if foreign_key_check runs at each start or only when a migration was
>    applied.
> 5. The error of a failed foreign_key_check names the table and the row, and no row data.
> Record the new fact in the ledger row of item 22: with ON DELETE cascade or set null, the
> runner of today loses data with no error. main has no such key: the two migration files
> have six foreign keys, each with "ON DELETE no action" (a search by the second opinion)

**On revision 1 of the plan (2026-11-13): approved, with the five points.** The exact words:

> Plan of list PR 6: approved, with the five points.
> 1. Approved. The check runs only when a migration was applied.
> 2. Approved. One addition: before this PR merges, run PRAGMA foreign_key_check one time on
>    the real database, with a read-only connection, and tell me the result. Then the first
>    migration of M3 cannot stop on old data by surprise. The second opinion found no
>    database file in the main checkout, so this check was not run.
> 3. Approved, the text as you wrote it.
> 4. Approved. Tests 10 to 13 get a break, and each other test gets an exempt entry with
>    the reason of the plan.
> 5. Approved. In the audit file, keep the old sentence of the bullet and add the new fact
>    after it with the date. Do not write the old sentence again.
> The "Not claimed" line about drizzle-kit is correct, and the real rebuild from db:generate
> in a scratch copy is the right proof.

## 9. The five points of revision 1 (all approved)

1. The check runs only when a migration was applied, not at each start (part 2).
2. An old broken reference stops the next migration (part 2).
3. The text of guardrail 3 (part 4).
4. The break list for tests 10 to 13 (part 5).
5. Item 22 has no ledger row. The record goes into the audit bullet and a new row DQ-310, in
   this PR (part 6).

## 10. Facts corrected when the plan was committed (2026-11-15)

Two sentences of revision 3 were wrong in a fact. The design does not change.

1. "The two migration files have six foreign keys": `backend/migrations` has three migration
   files (`0000_init.sql`, `0001_skills.sql`, `0002_bots.sql`). The six foreign keys are in two
   of them: two in `0001_skills.sql`, four in `0002_bots.sql`. Each has `ON DELETE no action`.
   Command: `grep -n "FOREIGN KEY" backend/migrations/*.sql` on `97221d3`. Part 1 and part 6
   now say this. The owner's words in part 8 stay as they are.
2. Part 3 said that three tests pass on the old code. Part 5 and the owner's point 4 name four:
   tests 10 to 13. Part 3 now says four.
