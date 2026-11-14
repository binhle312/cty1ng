# P3 PR C: limits for the diff and the changelog, and API strict inputs

Brief: the one P3 list before M3 (owner-approved 2026-11-12), part 5, list PR 7 (items 23, 24) and list PR 10 (items 32, 33, 34, and the two approval parts of 31). Night decisions: arena 1 synthesis, Q9 (one PR) and Q12 A.
Checkpoint: none (no new screen, no code design). Public API changes and upload code are flagged under `Needs human review`.
Approval: chief agent, 2026-11-15, under the owner's order of 2026-11-14 (P3 questions to consultants); owner review pending. Revision 1. Answers of the chief: Q1 A, Q3 diff budget 2000, Q4 A, Q5 A. Q2, Q3 (changelog default), Q6 and Q7 go to consultants; section 6 records the answers when they come.

## 1. Item check on `origin/main` = `97221d3` (2026-11-15)

| Item | Place on `97221d3` | State, how I know |
| --- | --- | --- |
| 23 `lineDiff` has no budget | `backend/src/core/skills/skill-diff.ts:6-14`; callers `skills.service.ts:336-337`, `skill-import.service.ts:217-218` | still there. ran (probe, `diff@9.0.0`, this laptop): 5,000 all-different lines 2,716 ms; 10,000 lines 12,868 ms |
| 24 changelog: no length limit, quadratic regex | `routes/skills.ts:34` (`z.string().optional()`), `skills.service.ts:582` (`/\s*\n\s*/g`) | still there. ran the regex alone on spaces + `x`: 500 → 0.1 ms, 1,000 → 0.3 ms, 20,000 → 180 ms, 100,000 → 2,319 ms. A JSON body may be 1 MB (`middleware.ts:103`), so about 230 s by the curve (not run). Second path: the import changelog `Imported from {file}` (`skill-import.service.ts:318`) takes the zip's file name, which only the 5 MB upload limit bounds |
| 32 two `field` formats | `router.ts:19-20` joins the Zod path with dots (`pins.0.skill_id`); `bots.service.ts:242` (`pins[i]`), `:650` (`bots[i]`) | still there. read. `docs/api.md:30` (`mentions[0]`) and `:64` (`bots[i]`) already show the bracket form; the frontend keys pin errors as `pins[i]` (`create-bot-steps.tsx:398`, `create-bot-form.ts:257`); `fieldHead` splits on `.` and `[`, so it reads both |
| 33 repeated items; empty `ids=` | import apply: `skill-import.service.ts:290-299` maps each slug with no repeat check (a repeated `changed` slug then fails as 409 `stale_write`, a repeated `new` slug as 409 `slug_taken`: from reading the code, not run); export: `routes/skills.ts:394-403` (repeated id → two zip entries with one path, from reading `skills.service.ts:372` and `writeSkillZip`; `ids=` → `[]` → an empty zip `0-skills-….zip`) | still there. read. The Export card never sends `ids=`: its button is off at 0 ticks (`export-card.tsx:84`) |
| 34 three inputs skip strict parsing | (1) `routes/skills.ts:32` `VersionParam.version` and `:221-222` diff `from`/`to`: `z.coerce.number()`; (2) `app.ts:85` is `app.doc31("/api/openapi.json", …)`, not `frontendFiles` (that is `:86`): the OpenAPI document route is not a Zod route, so it takes any query string, against `security.md` §2.9; the dev `/api/docs*` routes (`routes/api-docs.ts`) are the same; (3) `shared/src/bots.ts:198` `ToolSettingsBody = z.record(z.string(), z.boolean())`: any key | still there. ran (probe, zod 4.6.7): `z.coerce.number().int().positive()` accepts `0x2`, `2.0`, `1e0`, ` 2 `, `+2`, `02`, `0b10` as 2 or 1. (2) and (3): read |
| 31 part: the 1 MB limit in two places | `uploads/skill-zip.ts:14` `SKILL_ZIP.maxSkillMdBytes`, `app/skill-folders.ts:18` `MAX_SKILL_MD_BYTES` | still there. read. `MAX_BODY_BYTES` (`middleware.ts:103`) is also 1 MB but is another rule (the JSON request body, `security.md` §2.7): not part of the one limit |
| 31 part: the `SkillDiff` shape twice | `shared/src/skills.ts:211-214` and an inline copy at `routes/skills.ts:227-230` | still there. read |

## 2. Changes

### PR 7 part (first commits, so the PR can split here)

**Item 23.** `lineDiff(from, to, maxEdits)` passes `maxEditLength: maxEdits` to `diffLines`. When `diffLines` returns `undefined` (over the budget), the result is every old line as `del`, then every new line as `add`. This is the owner's decision of 2026-11-06 (audit file, "Decisions after PR 2": "Above the limit, the old text shows as removed and the new text as added"). The answer is still a correct diff (applied to the old text, it gives the new text), only not the shortest one. So: no API shape change, no new UI text, no frontend change. The budget is per `lineDiff` call (one for the description, one for the body), so per History request and per import row. No `timeout` option (it reads the clock). Measured cost is about quadratic in the budget and almost flat in the line count:

| `maxEditLength` | 5,000 lines | 10,000 lines | 50,000 lines |
| --- | --- | --- | --- |
| 1,000 | 51 ms | 68 ms | 67 ms |
| 2,000 | 221 ms | 275 ms | 218 ms |
| 5,000 | 1,453 ms | 1,411 ms | 1,517 ms |
| 10,000 | 2,407 ms | 6,239 ms | 5,884 ms |

(all lines different, `diff@9.0.0`, node on this laptop, one run each.)

**Item 24.** A length check on the changelog in `skillTextProblem` (`skill.rules.ts`, pure; the limit comes in with the other limits), before the guard and before `oneLine`. Every path goes through it (`createInTx`, `addVersionInTx`; restore and import use those). Over the limit: 422 `validation_error`, `field: "changelog"`, with the existing template of `overLimit`: "The changelog has {n} characters. The limit is {max}. Make it shorter." The save bar already shows a field error outside the form as "Could not save {name}: {message}" (`save-error.ts:38`). Import: the preview refuses a file name that makes `Imported from {file}` longer than the limit, at the place where it already runs the guard on the file name (422 `validation_error`, `field: "file"`, "The file name has {n} characters. The limit is {m}. Rename the file."). With the limit, the regex reads at most the limit (500 characters: 0.1 ms), so I do not rewrite it (question Q4).

**Homes (Q12 A).** Two environment variables in `backend/src/app/config.ts`, wired in `compose.ts` into the skills service and the import service:
- `SKILL_DIFF_MAX_EDITS`, default `2000` (positive integer; the owner's 2026-11-06 text names 2,000).
- `SKILL_CHANGELOG_MAX`, default `500` (positive integer; section 7, Q3).
Defaults are written one time, in the table of `docs/architecture.md` §8. The rules that use them (`domain-model.md` §3.x skill history and import, `api.md` rows) name the variable, not the value.

### PR 10 part

**Item 32.** `router.ts` writes an array index as `[i]`: `pins[0].skill_id`. One helper for the `invalid_id` path and the other paths. `docs/api.md` §1 gets one sentence on the format. No frontend change (`fieldHead` already splits on `[`); the frontend parser tests stay; I add no frontend test unless the chief wants one.

**Item 33.**
- Import apply: a slug listed twice → 422 `validation_error`, `field: "slugs"`, "{slug} is listed twice." (the field of the other two slug errors of this endpoint, and the words of "This bot is listed twice."). Nothing is written. Service change in `skill-import.service.ts` apply (not a #114 file part: #114 changes the preview id at `:261`, a nearby hunk).
- Export, in the route only (`routes/skills.ts:393-403`; #114 rewrites `skills.service.ts:369-376`): `ids=` (empty) → 422 `validation_error`, `field: "ids"`, "Pick at least one skill."; an empty item (`ids=a,,b`) → 422 `invalid_id` "Not a skill id." (today it is dropped); an id listed twice → 422 `validation_error`, `field: "ids"`, "This skill is listed twice.". No `ids` at all still exports every active skill.

**Item 34.**
1. One strict schema for a positive integer in a path or query: `z.preprocess` that turns only `^[1-9][0-9]*$` into a number, then `z.number().int().positive()`. Used by `VersionParam.version` and the diff `from`/`to`. Probe: the OpenAPI type stays `integer` (so the generated client keeps `number`), `0x2` and `2.0` fail.
2. `GET /api/openapi.json` and the dev `/api/docs*` routes refuse a query string: 422 `validation_error` with the key as `field`, the answer of a Zod route with `NoQuery`.
3. `ToolSettingsBody` keys must match `ToolIdPattern` (the catalog's tool id rule, `shared/src/catalog.ts:48`). A key of another shape → 422 `validation_error`, `field: "tool_settings.<key>"`-style path from the router. A turned-off tool id that the model does not offer is still accepted (Clone page; `tool-settings.ts:81`). The stored JSON is always an effective result of catalog ids, so the read in `bots-repository.ts:229` keeps passing.

**Item 31, two parts (no behaviour change).**
- One SKILL.md size limit: `SKILL_MD_MAX_BYTES` exported from `core/skills/skill-import.service.ts` next to `ImportFolder` (both readers import that type already). `SKILL_ZIP.maxSkillMdBytes` and `skill-folders.ts` use it. It stays a fixed security check in code (`security.md` §2.4), not a variable. `MAX_BODY_BYTES` stays separate.
- The diff route answers `SkillDiff` from `shared/` in place of its inline copy; the service returns the `SkillDiff` type. `pnpm gen:api` shows if the generated client changes (the shared schema is `.strict()`; the inline copy is not).

### Docs and the Guide
`docs/api.md` (§1 field format; rows of `/skills/{id}/versions`, `/skills/{id}/versions/{version}/restore`, `/skills/{id}/diff`, `/skills/export`, `/skills/import/apply`, the docs routes if listed), `docs/architecture.md` §8 (two rows), `docs/domain-model.md` (the history diff and import rule name the variables), `docs/security.md` §2.9 if the docs routes need a line, folder READMEs if a file changes its purpose. Guide (`seed/skills/using-the-app/SKILL.md`): I read it before the docs commit; if no sentence becomes false and the owner gets no new page, command, action or choice, the description says "Guide: not changed" with the reason (a 422 text in the save bar is an error, not a choice). If the Guide names the changelog as free text of any length, I change that sentence.

## 3. Test strategy (test first; each red run recorded on the code before the fix)

| Behaviour | Level, file | Cases |
| --- | --- | --- |
| 23 budget | unit `skill-diff.test.ts` | a change under the budget gives the shortest diff (same lines stay `same`); edit length = budget gives the shortest diff; budget + 1 gives all `del` then all `add`; a fallback diff applied to the old text gives the new text; empty old or new text |
| 23 History path | service test `skills.service.test.ts` (fake clock, real rules) | `diff` with a small budget from the deps and two versions over it → fallback shape; under it → normal |
| 23 import path | service test `skill-import.service.test.ts` | a `changed` row over the budget gets the fallback diff; the row stays `changed` and applies |
| 23 config | `config.test.ts` | default 2000; a set value; 0, `-1`, `abc` stop the start |
| 24 limit | unit `skill.rules.test.ts` | changelog of exactly the limit passes; limit + 1 → `validation_error` on `changelog` with the text; the length check comes before the guard (a long changelog with a key-like text gives the limit error) |
| 24 API | API `skills.test.ts` | `POST /skills/{id}/versions` and `POST …/restore` with limit + 1 → 422 `field: "changelog"`, nothing written (versions list unchanged); exactly the limit → 201 |
| 24 import file name | service test | a file name that makes the changelog limit + 1 → 422 `field: "file"`; one character less → preview works |
| 24 config | `config.test.ts` | default 500; bad values stop the start |
| 32 | API `bots.test.ts` | a Zod error inside `pins` (`pins[0].skill_id` not a skill id, a wrong type) → `field: "pins[0].skill_id"`; a top-level field stays `name`; a nested object key stays dotted (`tool_settings.<id>`) |
| 33 import | API `skills.test.ts` | `slugs: ["a","a"]` → 422 `field: "slugs"`, nothing written (skill count, versions); `["a","b"]` still works |
| 33 export | API `skills.test.ts` | `ids=` → 422 `field: "ids"`; `ids=a,a` → 422; `ids=a,,b` → 422 `invalid_id`; no `ids` → all active; `ids=a,b` → 2 entries |
| 34.1 | API `skills.test.ts` | `versions/0x2`, `2.0`, `1e0`, `+2`, `02` → 422; `versions/2` → 200; diff `from=0x1` → 422 |
| 34.2 | API test (`security/errors-and-limits.test.ts` or `health.test.ts`) | `/api/openapi.json?x=1` → 422 `field: "x"`; without a query → 200; the dev docs page with a query → 422 |
| 34.3 | API `bots.test.ts` + unit | `tool_settings: {"Not An Id": false}` → 422; a catalog id turned off that the model lacks → accepted (no regression) |
| 31 | existing tests stay green (`skill-zip.test.ts` boundary at `maxSkillMdBytes`, the CLI folder tests); no red run (refactor) | — |

No order or race case: the changes are pure checks on one request. Break list: only for tests that pass on the old code (the 31 refactor has no claim; 34.2 and the 1 MB limit touch security code, so if any of their tests passes on the old code it gets a break). Most tests are test-first with a recorded red run.

## 4. Risks

- The export change must stay in the route (#114 rewrites the service function). The import apply check is in `skill-import.service.ts` apply; #114 changes `:261` of the same file: a text conflict is possible, solved in a records turn.
- PR E changes `create-bot-form.ts`; with the bracket format I do not touch it.
- `ToolSettingsBody` is also the read parser of stored JSON: a stored key that breaks `ToolIdPattern` would fail a read (500). Stored values are written only as effective results of catalog ids (pattern-checked by the catalog schema), and there is no real data before M3.
- `SkillDiff` from shared may change the generated client (`additionalProperties: false`); then `pnpm gen:api` output is committed.

## 5. Open questions (with my recommendation)

- **Q1 (a) The answer over the budget.** A: the fallback diff (all old lines `del`, all new `add`) in the normal 200 shape; budget per `lineDiff` call. B: a flag `truncated: true` in `SkillDiff` + a UI line (API shape and new UI text). C: an error (422/413) and an error text in two places. **Recommend A**: it is the owner's decision of 2026-11-06, it is still a correct diff, and it needs no API or UI change. Per call (not per request): one call has one cost bound; a request has at most 2 calls (History) or 2 per row with a pause between rows (import).
- **Q2 (b) Item 33 results.** `ids=` → A: 422 `validation_error` (field `ids`); B: the same as no `ids` (all skills). Repeated `ids=a,a` / `slugs` → A: 422; B: remove repeats silently. **Recommend A for both**: an explicit empty or repeated list is a client error, the page never sends either, and "refused" is the words of the item.
- **Q3 (c) Defaults.** `SKILL_DIFF_MAX_EDITS = 1000`: worst case about 70 ms of blocked server per call (table above), and any change of up to 1,000 added + removed lines still gets the shortest diff (twice the 500-line warning of `skill_body_warn_lines`). 2000 (the audit's probe value) costs about 220-275 ms per call. `SKILL_CHANGELOG_MAX = 500` characters: a one-line note; `Imported from {file}` fits any file name up to 486 characters (OS file names stop at 255 bytes); the regex at 500 takes 0.1 ms. **Recommend 1000 and 500.**
- **Q4 The quadratic regex.** A: the limit only (the regex then reads at most 500 characters). B: also rewrite `oneLine` with a split (linear, same result). **Recommend A** (simplest; no concrete failure is left at 500); B is one line if the chief wants the regex gone.
- **Q5 Item 32 format.** A: brackets for array indexes (`pins[0].skill_id`), dots for object keys; one router change; matches `api.md:30`, `:64` and the frontend keys. B: dots everywhere (`pins.0`): changes 2 service lines, 2 frontend lines, the docs. **Recommend A.**
- **Q6 Item 34 third input.** The list's `app.ts:85` is `app.doc31("/api/openapi.json")` (line 85 on `97221d3` and on the audit commit). Its input is the query string, which no schema checks; the same for the dev docs routes. **Recommend** fixing those as input (2). If the chief prefers, the alternative third input is `preview_id: z.string()` of import apply (not a UUID check), but #114 changes that id's format (ids port), so I recommend leaving it.
- **Q7 Item 31 "one limit".** It covers the SKILL.md limit of the zip reader and the CLI reader; `MAX_BODY_BYTES` is the JSON body limit, a separate rule that only has the same number. **Recommend** not joining it.

## 6. Answers (chief agent, 2026-11-15 01:1x +07)

- Q1: A. The 200 shape with the del/add fallback; budget per `lineDiff` call (the owner's text of 2026-11-06, audit file line 80).
- Q3, diff budget: `SKILL_DIFF_MAX_EDITS = 2000`, the value of the owner's 2026-11-06 text ("187 ms for 10,000 lines"). My measurement above agrees: 218-275 ms for 5,000 to 50,000 all-different lines.
- Q4: A, the limit only.
- Q5: A, brackets for indexes and dots for keys; `router.ts` only; `create-bot-form.ts` untouched.
- Q2, Q3 (changelog default), Q6, Q7: with the consultants. Items 33, 34 and 31 wait for these answers.

## 7. Answers (chief, arena 3, 2026-11-15 01:2x +07)

Two consultants agreed with the plan on all four questions. The answers are in the chief's folder `tmp/owner/night-2026-11-15/arena3/`.

- Q2 (item 33): as written. Only an absent `ids` means "all"; `ids=` (empty) → 422. The import check for repeated slugs runs before any claim or write.
- Q3 (changelog): 500 characters (`domain-model.md` and `skills-page.md` §5: "one line"). A long file name gets 422 on `file`; it is not shortened. The length check runs before the lines are joined, on every path, and the file-name check counts characters the same way. The CLI passes the folder's base name, not the full path, so a long parent path uses none of the limit (the risk line about CLI paths is removed). Follow-up for the records turn: M5 `propose_skill` takes a changelog with no stated limit (`conversation-rules.md` §7, "Text only").
- Q6 (item 34): yes. The numbers are `version` and the diff `from`/`to` (`routes/skills.ts:32`, `:221`). One more test: an integer above the safe range gets 422, not 404 or 500. `ToolIdPattern` is exported from `shared/src/catalog.ts`, with a comment: a change needs a check of the stored data, because the read parser of the stored JSON uses it. An empty `?` passes, as with `NoQuery`; the refusal has the common 422 shape.
- Q7 (item 31): yes. One fixed `SKILL_MD_MAX_BYTES` in `core/`; `MAX_BODY_BYTES` stays separate. `security.md` §2.4 gets one line: the CLI folder reader uses the same limit. `skill-commands.test.ts` uses the constant (the limit and the limit + 1). Upload code: flagged under `Needs human review`.
