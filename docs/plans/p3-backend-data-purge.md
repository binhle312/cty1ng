# P3 backend data and purge

Brief: the P3 list before M3 (owner, 2026-11-08; list approved 2026-11-12), list PR 9: items 27, 28, 29, 30, five parts of item 31, and the docs of item 37 (owner, 2026-11-13, question 12)
Checkpoint: none (the P3 list: "Needs the owner before code: no")
Approval: chief agent, 2026-11-15, under the owner's order of 2026-11-14 (P3 questions to consultants); owner review pending

## 1. What I found on `origin/main` (`97221d3`, 2026-11-15, read)

| Item | State | Where |
| --- | --- | --- |
| 27. One purge item that fails blocks all later items | Still there | `backend/src/core/skills/skills.service.ts:524-536`, `backend/src/core/bots/bots.service.ts:711-719`: no catch around `uow.run`. `backend/src/app/timed-jobs.ts:25-32` catches only per step, so the later items of the step wait. A failure that repeats keeps them in Trash on each run |
| 28. `trashed_bot_ids` is not parsed on read | Still there | `backend/src/adapters/db/schema.ts:48` (`$type<string[]>()`, no check), `backend/src/adapters/db/repositories.ts:267-276` (`toSkill` passes the value as it is). The restore skips a bad entry (`skills.service.ts:490-495`), but a stored value that is not a list goes into `for … of` |
| 29. The import preview id does not use the ids port | Still there; not addressed in this PR: needs a D36 prefix (Q3) | `backend/src/core/skills/skill-import.service.ts:261`: `globalThis.crypto.randomUUID()` (UUIDv4, no TypeID prefix) |
| 30. Invariant 7: no test of `bot.updated` on `POST /skills/{id}/bots`, or of `trash.changed` on a bot purge | Still there, both parts | `bots.service.test.ts:889-890` keeps only `bot.purged`; the success test of `pinSkillToBots` (`:659-687`) checks no event. Code: `bots.service.ts:680`, `:701` |
| 31a. The service method `trashed` has no caller | Still there | `skills.service.ts:512-515`; no caller in `backend/src` or the tests (the CLI reads `readers.skills.trashed()`, not the service) |
| 31b. Export all reads each latest version again | Still there | `skills.service.ts:369-376`: `list()` gives `latest`, then `latestVersion()` reads it again |
| 31c. `liveSkill` has two copies | Still there | `skills.service.ts:73`, `bots.service.ts:743` (same check, same message "No such skill.") |
| 31d. The purge loop has two copies | Still there | `skills.service.ts:519-537`, `bots.service.ts:706-721` |
| 31e. `modifiedAt` of the avatar port has only test callers | Still there | `core/ports/avatar-files.ts:40`; callers: the adapter, the fake, `avatars.service.test.ts` (4), the contract suite (5) |
| 37. The version rule of a new assign | Docs not changed; no test | `docs/domain-model.md:620`, `docs/api.md:123`; the PUT tests of `backend/test/api/bots.test.ts` use only v1 |

Not mine: the 1 MB limit and `SkillDiff` (list PR 10).

## 2. Changes, in commit order

1. This plan and its row in `docs/plans/README.md`.
2. **Remove first (31a, 31e).** Remove the service method `trashed`. Remove `modifiedAt` from the port, the adapter and the fake; the tests read the time from `list()`.
3. **31b.** Export all uses the `latest` that `list()` gives. The path with ids stays.
4. **31c.** One `liveSkill`, exported from `core/skills/`; `bots.service.ts` imports it.
5. **31d.** One purge loop: `backend/src/core/purge-due.ts`. The service gives two functions: the due ids for a cutoff, and "purge this id in this transaction if it is still due" (the recheck of `trash_days` and of the state stays in each service). No change of behaviour; the old tests stay green.
6. **27.** Tests first, then the fix in the one loop (section 4, the chief decides the option). `docs/architecture.md` §6.1, the row "Trash purge", gets the new behaviour. The comment of `timed-jobs.ts` too.
7. **28.** Test first, then `toSkill` parses the value with Zod (section 4).
8. **30.** Two tests (they pass on `main`: break claims).
9. **37.** One commit: the owner's words in `docs/domain-model.md` and `docs/api.md`, and one API test (passes on `main`: break claim).
10. The break list `scripts/breaks/pr-<n>.json` and its report.
Item 29 is not addressed: it needs a D36 prefix (section 4, Q3).

## 3. Tests and test strategy

Each new test is written before its code, and I record its red run (command, failing line) on the commit before the fix. A test that passes on the old code gets a claim in the break list (`docs/testing.md` §5). Each changed test gets a claim or an `exempt` entry.

| Id | Test | Kind | How it fails before |
| --- | --- | --- | --- |
| T1 | `core/purge-due.test.ts`: three due items, the second throws; the first and third are purged, the second is reported, the count is 2 | order | red: the loop stops at the second item |
| T2 | `skills.service.test.ts`: three due skills, the purge of the middle one throws (a uow wrapper in the test); the others are gone, the middle one is still in Trash; the events are `skill.purged` + `trash.changed` for the first and third only | order | red |
| T3 | `bots.service.test.ts`: the same for bots (`bot.purged` + `trash.changed`) | order | red |
| T4 | `skills.service.test.ts`: a skill that failed is purged by the next run after the cause goes away | order | red (first run never reaches the items after it; written to fail at the count) |
| T5 | `timed-jobs.test.ts`: a failed item gives one error line with the step and the id; the info line keeps the count of the others | log | red (only with option A) |
| T6 | `repositories` test: a stored `trashed_bot_ids` that is a list of bot ids reads back as `BotId[]` | data | green on main: exempt (no change of behaviour), or part of T7 |
| T7 | the same file: a stored value that is not a list of bot ids (`"x"`, `[1]`, `{}`) is refused on read | data | red: today it passes through |
| T8 | `bots.service.test.ts`: `pinSkillToBots` that moves two bots writes two `bot.updated` events with those bot ids | invariant 7 | green on main: claim, break = skip the `emitBot` call at `bots.service.ts:680` |
| T9 | `bots.service.test.ts`: a bot purge writes `trash.changed` after `bot.purged` | invariant 7 | green on main: claim, break = skip `appendTrashChanged` in the bot `purgeInTx` |
| T10 | `backend/test/api/bots.test.ts`: a new assign with v2 of a skill that has v4 pins v2 | item 37 | green on main: claim, break = `setPin` pins the latest version |

Order and race cases: T1 to T4 are the order cases of item 27 (the failed item does not change the order or the result of the others; the next run tries it again). The races that exist (a skill restored, or `trash_days` raised, between the list and the transaction: `skills.service.test.ts:500-509`) stay green through the one loop; T1 also checks that an item that is no longer due is skipped and not counted.

Changed tests of steps 2 to 5 (the `modifiedAt` reads): `exempt` with the reason "the same assertion through `list()`; no change of behaviour".

## 4. Open questions for the chief

Q1 and Q2: answered by the chief with consultants, 2026-11-15 (two consultants agreed; option A for both). Q3: answered.

**Q1 (item 27): what does the purge do after one item fails?** Answered: A (the chief with consultants, 2026-11-15). Notes of the answer: keep the step try in `timed-jobs.ts` (the read of the due list can still throw); catch outside `uow.run` for each item; log the error as pino `err`, one line per failed item with the step and the id; the info line keeps the real counts; a test runs the job a second time and checks that it tries the failed item again; the checks inside each transaction stay. A does not make sure that an item that keeps failing goes by its deadline: the failed item stays in Trash, and the log shows it. No document decides it. `architecture.md` §6.1 says "Purges each item … One item per transaction, with its event" and "a failed run (or purge step) is logged and the next run tries again". Example: skills A, B, C are due; B fails each time (a bad row). Today A goes, B fails, C stays in Trash on every run, past `trash_days` (D62 says "never shorter", "up to one interval longer").

| Option | What happens | Gain | Cost / risk |
| --- | --- | --- | --- |
| A (recommended) | The loop goes on after a failed item. `purgeDue` returns `{ purged, failed: [{ id, error }] }`. `timed-jobs.ts` logs one error line per failed item (step, id, error) and the info line keeps the counts | C goes on time; the log names B; the counts stay right | The return type changes: about 20 test lines read `.purged` |
| B | The loop goes on; at the end it throws one `AggregateError` with each failure | Fewer changes; `timed-jobs.ts` stays | The info line counts 0 for that step although A and C went; the id of B is only inside the error |
| C | No change of code; §6.1 says that one failure stops the step | No code | C stays in Trash after `trash_days` for as long as B fails |

Events (`AGENTS.md` §5 rule 3), same in A and B: the failed item's transaction rolls back, so it writes no `skill.purged`, `bot.purged` or `trash.changed`. Each purged item keeps its own events in its own transaction. No new event type. The failed item stays in Trash and the next run tries it again.
The new sentence in §6.1 (A): "When one item fails, the job logs it with its id and goes on with the next item; the failed item stays in Trash, and the next run tries it again."
Not in scope: the avatar cleanup (`avatars.service.ts:63-78`) has the same shape (one transaction for all files); item 27 names only the two loops.

**Q2 (item 28): what does a read do with a bad stored value?** Answered: A (the chief with consultants, 2026-11-15). The risk is bigger than A below says: `list()` reads every row through `toSkill` (`repositories.ts:147`, `:161`), so one bad row makes the whole Skill Hub list, Export all and the Trash list answer 500. The undo: `UPDATE skills SET trashed_bot_ids = NULL WHERE id = ?`. Valid values stay valid: `null` and an empty list. No stored data changes. The restore loses only its `safeParse` skip, and keeps its check that each bot still exists and is live. Tests: `{}`, `[1]`, `["not-a-typeid"]` are refused, and one row reads back as `BotId[]`.
- A (recommended): refuse it (Zod `parse`, an error), as `tool_settings` does (`bots-repository.ts:229`, its test `bots-repository.test.ts:47-55`). `SkillRecord.trashedBotIds` becomes `BotId[] | null`, and the restore loses its `safeParse` skip. Risk: one bad row makes each read of that skill fail (500). The app never writes such a value, and no real database exists (owner, 2026-11-13).
- B: drop the bad entries on read (a value that is not a list reads as `null`). The reads never fail; a bad value is silent.
No migration and no change of the stored value in A or B. The audit also says the column "holds TypeIDs" (D36 stores UUIDs in the database). Changing that changes stored values: not in this PR; I write it as `Not claimed` and name it for the owner.

**Q3 (item 29): the fix needs a TypeID prefix that D36 does not have.** Answered: A (the chief, 2026-11-15). `docs/decisions/` is the owner's (`AGENTS.md` §7), so the prefix is the owner's choice. The PR names it under `Needs human review`: the owner picks a prefix (for example `simp`); then the fix is one line and one test. D36: every id outside the database is a TypeID, and its table lists each prefix. The ids port only makes TypeIDs (`newId(prefix)`). My scope says: no change to `docs/decisions/`.
- A (recommended): no code tonight. The PR names item 29 under `Needs human review`: "the owner picks a prefix (for example `simp`) for D36; then the fix is one line, `deps.ids.newId("simp")`, and one test".
- B: the chief allows a D36 line now; I add the prefix to `shared/src/ids.ts`, use the ids port, and flag the D36 line for the owner.
- C: add a `newUuid()` to the ids port (UUIDv7, no prefix). Changes a port and its contract suite, and the API id still has no prefix (against D36).


## 5. Risks

- Step 5 changes the code of the job that deletes data. The old tests of both loops (`skills.service.test.ts:483-509`, `bots.service.test.ts:860-891`) stay as they are, and must stay green before step 6.
- Item 28 A can make a read fail (Q2).
- Item 37 changes only docs and adds a test; the owner approved the words. No code change.

## 6. Not claimed (so far)

- The break report uses the runner of `origin/main`; if #107 merges first, the records turn runs it again.
- Item 28 does not change the stored form of `trashed_bot_ids` (TypeID strings in JSON).

## 7. What the build changed (2026-11-15, round 1 finding R1-8)

- The one purge loop is `backend/src/core/trash/purge-due.ts` (with `purge-due.test.ts` and a `README.md`), not `backend/src/core/purge-due.ts`: `docs/architecture.md` §4 plans a `trash` folder for D62.
- Each service gives three functions (the due ids, the delete time of one item or null, the purge). The recheck of `trash_days` is in the shared loop, not in each service. The behaviour is the same.
- T1 became two tests in `purge-due.test.ts`; T5 became two tests in `timed-jobs.test.ts`. T6 and T7 are in `backend/src/adapters/db/skills-repository.test.ts`. T8 and T9 claim only the event part of invariant 7.
