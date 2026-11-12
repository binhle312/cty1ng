# Repository audit, 2026-11-05

Status: **all seven owner questions have answers. Fixes follow the approved order.** No code finding is fixed by this file.

This file holds the results for the next agent. It is a record of one audit, not a specification. If it disagrees with the code at a later commit, check the code first.

## Start here (for a new chat)

1. Read "Owner decisions", "Approved fix order" and "Fix progress" below. If a question has no answer, continue with it.
2. Ask the owner one question at a time. Give a detailed explanation, an example and a recommended answer.
3. After each answer, update "Owner decisions" in this file.
4. When all questions have answers, follow the approved fix order below. Check which PRs exist first (`gh pr list`).
5. Do not start M3. It waits for the end of this plan. #69 is closed and not part of this plan now (see "Decisions during PR 3").

The plan comes from the owner, 2026-11-04: audit, owner review of each finding, fixes in small draft PRs by module, second audit, and then M3. The plan of 2026-11-04 also merged #69 before M3, and the owner changed that on 2026-11-06. The coding standard is parked, so this audit checks the code against `docs/` and `AGENTS.md`.

## Owner decisions

| # | Question | Recommendation | Answer |
| --- | --- | --- | --- |
| 1 | What is the rating of the Save finding (row 1a)? | P2 | **P2** (owner, 2026-11-05). Fix it in one PR with the P3 "types an edit back during a conflict" |
| 2 | Is six open app tabs normal use (row 14)? | Rate P2, and fix before M3 | **P2, fix before M3** (owner, 2026-11-05). Show the owner a one-page design first |
| 3 | If another tab moves a skill to Trash, can the skill page lose unsaved text (row 15)? | Accept it, and write it in `skills-page.md` | **Accepted** (owner, 2026-11-05). Docs change only: `skills-page.md` takes the rule of `bot-page.md` §4.2. The P3 "unknown skill URL loses the whole shell" stays |
| 4 | Do we widen the sensitive data guard (row 4)? | Yes, keep P2 | **Widen now, keep P2** (owner, 2026-11-05). Catch prefixed names, the JSON form and long hex, with a test for each form. D39 does not change. Placeholders get no exception, so `DB_PASSWORD=changeme` is refused. Owner approval is given for this change; the PR still lists it under `Needs human review` |
| 5 | Do we keep the touch swipe requirement (row 13)? | Drop it | **Dropped** (owner, 2026-11-05). The owner uses a laptop or a desktop, with a touchpad and a mouse. Remove the sentence from `docs/tasks/M2-bots.md:160`, `docs/requirements/app-shell.md:87` and `docs/design/components/top-header.md:29`. In its place, add a test that the wheel and a two-finger motion scroll the roster. The tap and long press code and tests stay |
| 6 | Do you approve the fix order below? | Yes | **Approved** (owner, 2026-11-05) |
| 7 | What are the owner's PR #59 issues? | Add them to this list before the fixes start | **Closed** (owner, 2026-11-05). #59 is merged, so its remaining issues are in the audited code, and these findings count as them. If the owner names one that is not on this list, add a row |

**Approved fix order** (small draft PRs; bug fixes and style-only changes stay separate):

1. Docs only: the rules from questions 3 and 5, and this file.
2. Security: widen the guard (row 4) and limit the `SKILL.md` parse cost (row 5). One PR, because it starts the paid security scan. List both under `Needs human review` (`AGENTS.md` §7).
3. Skills page: rows 1a, 3, 6 and 7, with the P3 "types an edit back during a conflict".
4. Bots page: rows 1 and 2.
5. Tests only: rows 8, 9, 10, 11, 12 and 13.
6. Six tabs (row 14): a one-page design for owner approval first, then code. It includes the P3 "the stream does not come back in `make dev`".
7. Other P3 marked "Fix before M3": the migration rebuild, the TypeID 500, the error boundary and `lineDiff` (DQ-037). GitHub required checks are a repo setting: give the owner the steps, or set them only if the owner asks.

After these: the owner fixes or drops each of the other 33 P3 findings and the P3 rows that later reviews added, except the row "Guard shapes accepted". Then one style-only PR for the 104 `max-params` places, a second audit, and M3. The coding standard stays parked until the owner restarts it.

**Changed on 2026-11-08 (owner; written here on 2026-11-10):** fix every P3 found so far before M3. This replaces item 7 and the "fixes or drops" step above.

- Scope: the P3 findings of this file, the open and `partial` P3 rows of [delivery quality](../delivery-quality.md), and the follow-ups of [status](../status.md). DQ-109 is in scope too.
- Method: make one list with no duplicates. Check each item in the code: still there, already fixed, or not reproduced. Then fix in small PRs by area. Bring an item to the owner to drop only when it costs more than it gives.
- Order: PR 5, PR 6, the P3 PRs, the style-only `max-params` PR, the second audit with [the audit workflow](../workflows/audit.md), then M3.
- The list is not in the repository. The ledger rows that say "on the P3 list before M3" mean this list. The list of 2026-11-12 was checked on `ec41c39`, and it replaces the draft of 2026-11-10. The owner approved it and the order of its PRs on 2026-11-12.
- The rule for later milestones is in the [merge bar](../workflows/merge-bar.md): P3 findings are fixed at the end of each milestone (owner, 2026-11-10).

**Decisions made during PR 2** (owner, 2026-11-05):

- The frontmatter limit for row 5 is 8,192 characters. The largest valid export has about 6.2 KB, so a much lower limit is not possible.
- The import preview pauses between rows. A review showed that a 35 KB zip with 200 folders under the limit still blocked the server for about 15 s.
- A password value still needs 4 or more characters. In `"password": "x"`, `x` means any value.
- The guard frees text that holds no secret: references, type names with no quotes, shell paths after `pwd`, and values made of words next to a key word. Skills have no override, so a false match blocks a save. The cost is that a few weak forms escape, such as `password: {hunter22}`. The rules and their cost are in `security.md` §2.13.
- Four rare forms stay as known gaps: a Markdown table, a value on the next line, hex with colons, and a long plain value that hides a second value.
- A value made of words needs real word shapes. A word has a vowel and fewer than 5 consonants in a row. A test with seeded random values holds these limits: at most 1% of 24-character and 0.1% of 40-character base62 or base64 values that `main` refuses go free, and at least 90% of 24-character lowercase letters and digits and 85% of 24-character base32 in capitals are refused.
- A schema with no value and `useState("")` are free. These five false matches stay and `security.md` §2.13 lists them: `confirmPassword: z.string().min(8),`, `hashedPassword = await bcrypt.hash(password, 10)`, `resetPassword: async (email) => {`, `newPassword: string|undefined`, `ALL_TESTS_PASS: done`.
- DQ-049 and DQ-050 have the same cause as DQ-033 and DQ-045, and they get no redesign: keep the fix, with one owner in the code. If a review finds the same cause again, stop patching and propose a redesign (AGENTS.md §9).
- DQ-052 and DQ-053 have the same cause as DQ-034: a free rule takes more than it names. Decision: close the free rules. A free schema takes only named members, a quoted value after a type name and `=` is a value, and a test puts a secret in each place of each free form. `security.md` §2.13 has the lists.
- DQ-058 and DQ-059 have the same cause again: the rules for a reference, a type and a `pwd` path took open text, so a later key in that text was not read. Decision: no free rule has a place for any text. A value ends at a reference before a JSX tag end and at a type before an arrow, and a path takes only listed characters. These false matches are the accepted cost: `pwd=/a:/b`, `pwd=/a/b?x=1`, `pwd=/a=b`, `pwd=/a/(b)`, `pwd=/a/b#c`, ``(password:`string`)=>x``, `password={a}">x`, `password={a})>x`, `password={a},>x`. The builder found four more in the comparison, and the owner accepted them on 2026-11-06: `pwd=/home/owner/>`, ``password=`{a}`/>``, `password="{a}/>`, `pwd="/home/owner,a:1`.
- Text after a literal or a type name stays free. So `password: true hunter22` escapes, because the guard cannot tell it from `password: string in the request body`, and a false match blocks a save.
- The environment suffixes also take `qa`, `uat`, `stg`, `prd`, `local` and `development`. `password_local: disabled` is a false match that stays, and `DB_PASSWORD_ROOT=` escapes.
- Free React state also takes `null`, `undefined` and the types `<string | null>` and `<string | undefined>`.
- The speed test keeps one 1,000 ms limit for each line.
- PR 2 gets one full independent review of its final revision. Only P1 and P2 findings block the merge, and P3 findings go on the follow-up list.
- The guard forms are frozen at `cabed57`, with no new form or free rule in this PR. Text has no end, so each review of the guard found a new shape, and each new rule could cause the next finding. The goal of row 4 was met in the first commit. A guard finding in the last review blocks the merge only in one of these cases:
  1. A text that audit row 4 or `security.md` §2.13 names gets the opposite answer from the one that the text gives.
  2. A seeded random-value test in `sensitive-data.rules.test.ts` misses its limit.
  3. `backend/test/security/guard-real-text.test.ts` fails.

  Any other text, free or refused, is P3 and goes on the P3 list in this file, even if `main` gives another answer. So a secret in a new shape can stay free until a later PR. The freeze covers only which text the patterns accept. The whole merge bar still applies to the scan speed, the masking of a found value, row 5, the import change, and each required check.
- DQ-057 has the same cause as DQ-046 and DQ-048: a claim with no run behind it. Decision: no redesign, because the cause is process and the wrong claims are corrected. A later docs PR adds a rule that each claim in a PR body or an owner question needs a real run.

**Decisions after PR 2** (owner, 2026-11-06). The guard rules are in `security.md` §2.13.

- Skill and bot saves get no "Save anyway" for now. The guard at the merge of #73 refused 5 of 451 third-party skill files (7 lines) on this machine, and all 7 lines hold example or masked values. An edit fixes each one.
- The known guard gaps and false matches stay. The guard forms are closed, and later reviews and audits do not ask the owner about guard shapes.
- Only the owner reopens the guard, after a save that no edit can fix or a real secret that got through.
- The nil UUID and `github_pat_` wait for the next guard change, with no PR of their own.
- `lineDiff` (DQ-037) moves to PR 7, as a P3 to fix before M3. All lines different took 27 ms for 500 lines and 10.7 s for 10,000 lines. The `maxEditLength` option of `diff`, set to 2,000, took 187 ms for 10,000 lines (script run, 2026-11-06). Above the limit, the old text shows as removed and the new text as added. The limit needs a home under the "no hardcoded values" rule.
- New rules: [pattern rules](../workflows/merge-bar.md#pattern-rules) and the claim rule in [testing.md §5](../testing.md#5-evidence-in-prs).
- No separate stop signal for now. The ledger marks 13 issues as caused by a repair, all on #73, and the 5 P2 among them (DQ-046, DQ-052, DQ-053, DQ-058, DQ-059) come from free rules of the guard, which the pattern rules now limit. Many older ledger rows do not record this field. Reopen if a PR outside pattern rules gets two P2 findings from its repairs.

**Decisions during PR 3** (owner, 2026-11-06).

- The skill editor's rule for server text stays one small function, `takesServerText`. The rest of the page's state rules stay in the page, and they are not moved to a `skill-page-state.ts`. The P3 review before M3 can look at this again.
- #69, "Leave working code alone", stays closed. The owner watches more PRs before deciding whether to bring it back, with no date set. Its rule is not in force, and M3 does not wait for it.
- The wait of a skill Delete is replaced (`AGENTS.md` §9). Three bugs came from keeping it in the page's state (DQ-067, DQ-069, DQ-078). The page now asks the query client if a Delete of this skill is on its way, so the wait has the life of the request.
- `useOnPage` is the redesign for late answers on the skill pages (`AGENTS.md` §9, DQ-065). No shared wrapper for all late answers for now. Look again if the same bug comes back in a new request.

**Decisions during PR 4** (owner, 2026-11-06).

- Row 2 and the Advanced defaults of a new bot have the same cause as DQ-003 (`AGENTS.md` §9): a form that fills once takes cached data. The cause is mainly process, because `testing.md` had the rule ("A second Clone …", "A test that reloads …") and no step checked that a builder applied it. Decision: small fixes with no shared hook, plus these four steps.
  1. For each changed screen, the PR names a test for each row of the edge case table, or says why the row does not apply. A reviewer reports a missing row as a finding.
  2. The general rule goes in `frontend-conventions.md` §5, `testing.md` §3 and the review guide.
  3. A fix record names the general rule and the search of old fixes (`workflows/bug-fix.md`, step 2).
  4. The second audit lists each form that fills once, and it runs a second visit on each.
- The independent review found one more path with this cause: a Clone decides from the cached catalog if its model is gone. Decision: fix it in PR 4 with the same small wait (DQ-096).
- The next review found another path: a Clone decides from the cached skill list if a copied skill is in Trash (DQ-101). Decision: one rule for the form. The Create page waits for this visit's read of the settings, the models, the tools and the skills. This replaces the separate waits.
- The third review found that the builder's fix of DQ-092 made a wait that can come back: an event closed an open form, and the typed text went (DQ-104). This has the cause of the pitfall "Waiting on a query that keeps failing". Decision (owner, 2026-11-07): delete that clause. The wait ends when the read gives its last answer. When a read fails on a later visit, the page holds the skeleton for about 7 s (DQ-092, dropped). The builder told the owner only this number. A later run showed that each live event starts the retries again (DQ-109), so the owner has not decided on that longer hold.
- The review of `2a39bd6` found a test that checked before the page took its held answer (DQ-110). This has the cause of DQ-094, DQ-099 and DQ-100: a test that does not reach its case. Decision (owner, 2026-11-07): fix the shared helper `heldAnswer`, so all its tests wait for the page. The first form of this fix waited for one timer step, and it raced the page (review of `3b7e074`). The builder changed the helper to wait for the query client, under this same decision, and told the owner.
- Decisions on the PR's open items (owner, 2026-11-08): keep the longer skeleton of DQ-109 as a P3 follow-up. DQ-088 is P2, and it gets its own small PR after PR 4: the app's reads and saves run when the browser says that it is offline, and each page is tested offline. Write the `docs/workflows/audit.md` PR now, at the same time as PR 4.
- This is an exception to `principle-fix-root-cause`, which asks for one owner. The rule stays in three code places: the skill Clone, the bot Clone and the wait for this visit's read in `create-bot-page.tsx`. The builder's advice, not part of the decision: look again if a third form of this type appears.

**Decisions for PR 6** (owner):

- 2026-11-09, option A: only a visible tab holds the stream. A hidden tab closes it, and a tab that becomes visible opens a new stream and reads all data again. Option B, one stream that all tabs share, is refused for now. Look at it again if the owner keeps many windows side by side, or if a feature needs a live tab in the background.
- 2026-11-10: the design in [the plan](../plans/audit-pr6-six-tabs.md) is approved. The wait before a new stream is 2 s, the same value as `retry: 2000`, with one home in `shared/`.
- 2026-11-10, after the first review of #91: the lost Clone draft (DQ-180) has the failed rule of DQ-104, so its fix gets its own PR on `main` first, and #91 waits (option A). The unused stop function of `startRealtime` goes (DQ-183).
- The cause in the P3 row "the stream does not come back in `make dev`" was not correct. A run on 2026-11-10 showed two causes: the Vite proxy kept a dead stream open, and after a 502 `EventSource` stops for good and the client opened no new stream. The length of the stop does not matter. The rules are in `realtime-events.md` §3, "Stream life".

## Fix progress

Each fix PR updates its row in the same PR. Check `gh pr list --state all`, because this table can be behind.

| PR | Scope | State |
| --- | --- | --- |
| 1 | Docs only | merged: #71 |
| 2 | Security | merged: #73 |
| 3 | Skills page | merged: #78 |
| 4 | Bots page | merged: #82 |
| 5 | Tests only | merged: #86 |
| 6 | Six tabs | merged: #91 |
| 7 | Other P3 for M3 | replaced by the P3 PRs (owner, 2026-11-08). The first, records only: #105 |

## Result

Commit `1c413b3` on `main`. The audit changed no repo files. At that commit, all gates passed: lint, typecheck, 1,360 unit tests, 71 e2e tests, `check:index`, `check:events`, `db:check`, build and `check:bundle`.

This list combines two audits. It has 55 findings. After the owner's decisions, 15 are P2, 39 are P3, 1 is an accepted case, and none is P1. The second audit gave 4 findings: 3 are new, and 1 was already on this list. It rated one finding P1, and the owner rated it P2 (row 1a).

"Checked" means that the lead ran the case or read the code again. "Reviewer" means that only the reviewer's evidence supports the finding.

## P2: wrong behaviour

| # | Finding | First wrong code | Evidence |
| --- | --- | --- | --- |
| 1a | A live refresh can replace text typed during a Save. This occurs only if the owner types all fields back to the last saved text and the refresh comes before the Save answer. The bar then says "All changes are saved." Other new text stays. Second audit: P1. Lead: P2, because the replaced text is the previous version, which stays in History. It has the same cause as the P3 "types an edit back during a conflict". | `frontend/src/features/skills/skill-page.tsx:133` | Checked in a real browser: 4 cases, and only this case fails |
| 1 | Esc with unsaved changes does nothing on the bot page. The dialog opens and closes at once, so the owner sees nothing. The test passes only because `act()` hides the failure. | `frontend/src/features/bots/bot-page.tsx:277`, test at `bot-page.test.tsx:1363` | Checked in a real browser: 0 dialogs after Esc, 1 after a Discard click |
| 2 | A second Clone of a bot starts from cached old data. Create then sends the old persona, tools and pins. | `frontend/src/features/bots/create-bot-page.tsx:94`, `:219` | Checked in a real browser: the form has the old persona after the source changed |
| 3 | If the owner deletes the last active skill, the app shows Page not found and the toast goes. The reviewer also saw the shell go. | `frontend/src/features/skills/skill-page.tsx:353` | Checked in a real browser: 4 of 4 runs with a held list answer. It depends on timing: one run with no hold reached the empty state, but the toast was not seen |
| 4 | The sensitive data guard misses `DB_PASSWORD=`, `"password": "x"`, `GITHUB_TOKEN=`, `access_token:`, `client_secret=` and hex secrets. | `backend/src/core/guard/sensitive-data.rules.ts:45`, `:59`, `:137` | Checked by a script. D39 accepts that patterns are incomplete, so the owner can lower this finding |
| 5 | A hostile `SKILL.md` blocks the whole server. | `backend/src/core/skills/skill-md.ts:25` | Checked: 12.4 s for 389 KB of frontmatter, and the time grows quadratically. The limit is 1 MB for each file |
| 6 | If the owner leaves the page, a failed Import Apply, Save, rename or Create shows nothing. The bot page and the dialogs show a toast. | `frontend/src/features/skills/import-page.tsx:126`, `skill-page.tsx:183`, `new-skill-page.tsx:201` | Code read by the lead; run by the reviewer |
| 7 | Skill Clone and "Clone to edit" fail silently if their read fails. | `frontend/src/features/skills/skill-page.tsx:258` | Code read by the lead; run by the reviewer |

## P2: missing proof

For the first five rows, the reviewer changed the code in a scratch copy of the build, and the tests still passed.

| # | Requirement with no real test | Where |
| --- | --- | --- |
| 8 | Invariant 21: a restore never assigns a skill to a bot | `backend/src/core/bots/bots.service.test.ts:728` |
| 9 | API keys never appear in a response. The test calls 5 of 37 operations, and its stream check reads no event. The security reviewer rated this P3 | `backend/test/security/secrets.test.ts:13` |
| 10 | The guard on a bot's name and description at create, and on its name at PATCH | `backend/src/core/bots/bots.service.ts:356`, `:415` |
| 11 | CL2: a Clone whose model left the catalog starts with an empty model | `frontend/src/features/bots/create-bot-page.tsx:171` |
| 12 | The header roster stops moving while the pointer is in the header | `frontend/src/features/shell/header-roster.tsx:263` |
| 13 | The wheel and a two-finger touchpad motion scroll the roster (`top-header.md` state 3). The code exists, but the only wheel test scrolls `main` (`frontend/test/e2e/shell.spec.ts:52`). This row replaces the touch swipe, which the owner dropped. Mouse drag has tests (`frontend/test/e2e/bots.spec.ts:130`, `:312`, `:409`) | `frontend/src/features/shell/header-roster.tsx:290` |

## Rated by the owner

| # | Finding | Owner's decision |
| --- | --- | --- |
| 14 | With six app tabs open, every request in every tab hangs with no error. Each tab holds one stream, and the browser allows six connections for each host. Reviewer evidence: `frontend/src/lib/realtime/sse.ts:30` | **P2**, fix before M3 (question 2) |
| 15 | Trash in another tab removes the unsaved text on a skill page with no question. The bot page accepts this result in `bot-page.md` §4.2, but `skills-page.md` has no such rule. Code read by the lead: `frontend/src/features/skills/skill-page.tsx:101` | **Accepted**: `skills-page.md` takes the rule, and no code changes (question 3) |

## P3

The lead did not check these again, except where a row says so. The others are from reviewer evidence.

### Backend and data

- A migration that rebuilds a parent table with rows fails at startup. `PRAGMA foreign_keys=OFF` does nothing in a transaction: `backend/src/adapters/db/migrate.ts:20`. No shipped migration does this today. **Fix before M3.**
- A description that ends in two newlines changes after export and import: `backend/src/core/skills/skill-md.ts:21`. Fixed in #73.
- A new assign can pin an older version, and the docs do not agree on the rule: `backend/src/core/bots/bots.service.ts:579`.
- One purge item that fails blocks all later items: `backend/src/core/skills/skills.service.ts:526`, `backend/src/core/bots/bots.service.ts:711`.
- `trashed_bot_ids` is not parsed on read and holds TypeIDs: `backend/src/adapters/db/repositories.ts:267`.
- The import preview id does not use the ids port: `backend/src/core/skills/skill-import.service.ts:253`.

### Security

- `lineDiff` has no budget: 24.5 s for a body of 20,000 characters: `backend/src/core/skills/skill-diff.ts:8`. One `changed` import row can reach it: 11.6 s from a 202-byte zip if the saved body has 10,000 lines. The pause between rows does not help inside a row (#73 review). **Fix before M3**, in PR 7 (owner, 2026-11-06).
- The dev page has no CSP or `frame-ancestors`: `frontend/vite.config.ts:18`.
- The paid security review does not watch the model adapters, `skill.rules.ts`, `bot.rules.ts`, `main.ts`, `compose.ts` and other paths: `.github/workflows/security-review.yml:20`.
- Refused requests carry no security headers, and the plan and `security.md` disagree: `backend/src/adapters/http/app.ts:61`.
- The changelog has no length limit, and its regex is quadratic: `backend/src/adapters/http/routes/skills.ts:34`, `backend/src/core/skills/skills.service.ts:584`.
- No test covers an absolute zip path or a forged entry size, or checks secrets through the CLI: `backend/src/adapters/http/uploads/skill-zip.test.ts`.
- Guard shapes accepted (owner, 2026-11-06): each guard shape, free or refused, that reviews and audits report. The lists and the rule are in `security.md` §2.13. This row needs no fix or drop answer, and a new shape adds no row.

### API and realtime

- A TypeID with the right shape gives 500 on most routes, not 422 or 404: `shared/src/ids.ts:7`, `backend/src/adapters/db/columns.ts:11`. **Fix before M3.**
- **Fixed in #91** ("Decisions for PR 6", last item). In `make dev`, the stream does not come back after a backend outage longer than the 2 s retry: `frontend/src/lib/realtime/start.ts:14`. **Fix before M3.**
- CLI changes do not wake the server's event stream, so open pages stay old until the next server write, a reconnect or a window focus. Second audit; code read by the lead: `backend/src/core/events/hub.ts:103`.
- An event that commits between the first GET and the first `ready` does not reach the page. The spec has this gap too: `frontend/src/lib/realtime/reducer.ts:34`. Read again on 2026-11-12: since #91, each later stream reads all data after its `ready`; DQ-200 is the open gap of that read. The stream of page start is the exception, so the gap of this bullet stays there (`realtime-events.md` §3, "Stream life", rule 4; `start.test.ts`, "the ready of the stream of page start reads nothing again").
- `field` in a 422 has two formats: `pins.0.skill_id` and `pins[0]`: `backend/src/adapters/http/router.ts:19`.
- Repeated items are not refused in import apply and export. An empty `ids=` gives an empty zip: `backend/src/core/skills/skill-import.service.ts:282`, `backend/src/adapters/http/routes/skills.ts:393`.
- Three inputs skip strict parsing: `backend/src/adapters/http/routes/skills.ts:32`, `backend/src/adapters/http/app.ts:85`, `shared/src/bots.ts:198`.

### Bots pages

- A late Delete answer moves the owner off the page they went to: `frontend/src/features/bots/delete-bot-dialog.tsx:38`.
- "Focus the first error" does nothing for fields with no `aria-invalid`: `frontend/src/features/bots/create-bot-steps.tsx:739`.
- Try again never shows the sending state: `frontend/src/features/bots/create-bot-page.tsx:366`.
- A server error on `cloned_from_bot_id` shows on no step and blocks Create: `frontend/src/features/bots/create-bot-form.ts:110`.
- A ticked skill that another tab deprecates shows as "A skill in Trash": `frontend/src/features/bots/create-bot-page.tsx:592`.

### Found during PR 4

- **Fixed in #84. P2 (owner, 2026-11-08); its own PR after PR 4.** After the browser reports that it is offline, the first visit to a Clone page, a bot page or `/bots/new` stays loading until the browser is online again. TanStack Query pauses reads, and the app runs on 127.0.0.1. Run with an `offline` event on `8c2278f` and on the branch; real Wi-Fi off is not tested: `frontend/src/main.tsx:15`.
- Esc on the bot page does nothing when the focus is outside the edit form, for example after a click on a blank area, on Discard or on a tab. Run on `8c2278f` and on the branch: `frontend/src/features/bots/bot-page.tsx:279`.
- Two older Esc checks and one older option have no test that fails without them: `contains`, `defaultPrevented` and the template's `retry: false` (DQ-095).
- A live event during a first-load read joins that read, so the form can open with a value from before the event. The next change has the same result, because an open form keeps its first answer (DQ-107).
- When a read of the Create form keeps failing, each live event for that list starts the retries again. With an event every 3 s for 21 s, the form opened at 25.1 s (DQ-109).
- `heldAnswer` waits on the client that `watchQueryClient` set last, and nothing checks it. A test with its own client and no call gets the old race back (DQ-115).
- Create waits for its refresh of the lists before it moves to the new bot. When the skill read keeps failing, the form stays disabled for about 7 s (DQ-108).
- The skill Clone cuts the name with a cached limit. The form checks the name against the current limit. From reading the code: `frontend/src/features/skills/new-skill-page.tsx:160`.

Correction to row 1: `act()` is not the only thing that hides the failure. A bare `dispatchEvent` hides it too, so removing `act()` alone gives a test that passes on the old code (run on `8c2278f`). `pressKey` makes React finish its work where a browser does.

### Found during PR 5

- The pointer freezes the header order only over the middle 6 of the 12 header columns. The freeze starts on the roster wrapper (`frontend/src/features/shell/header-roster.tsx:262`, inside `col-span-6` at `top-header.tsx:25`). The comment at `header-roster.tsx:40`, the click-outside check (`data-header-part` on the whole `<header>`, `top-header.tsx:22`) and `top-header.md` state 9 say "in the header". So a pointer in a side column does not freeze the order. From reading the code, not run. Found by the review of `41df63a`. **Owner, 2026-11-09: change the docs, not the code.** Fixed in #86: UI-2.9, `top-header.md` state 9, `bots-page.md`, the M2 brief and the code comment now say "over the bot avatars".

### Skills pages and shell

- **Fixed in #78.** Late answers from Restore, Import and Trash move the owner off the page they went to. Both audits found the Import case: `frontend/src/features/skills/skill-history.tsx:223`, `import-page.tsx:119`, `skill-page.tsx:352`.
- Skill Clone can split an emoji, and the saved name then holds "�". The Clone form shows the name first, so the owner can correct it. Second audit; checked through the API by the lead: `shared/src/skills.ts:142`.
- An unknown skill URL loses the whole shell: `frontend/src/features/skills/skill-page.tsx:101`.
- **Fixed in #78.** If the owner types an edit back during a conflict, the bar says "saved" over old text: `frontend/src/features/skills/skill-page.tsx:131`.
- A failed background refresh replaces the History tab: `frontend/src/features/skills/skill-history.tsx:79`, `:262`.
- "Close this card and try again" does not try again: `frontend/src/features/skills/skill-dialogs.tsx:50`.
- The app has no error boundary, so a failed lazy chunk replaces the whole app: `frontend/src/router.ts:8`, `frontend/src/features/shell/top-header.tsx:11`. **Fix before M3.**
- The Export card counts a skill that left the list: `frontend/src/features/skills/export-card.tsx:74`.

### Tests and tooling

- Invariant 7: no test proves `bot.updated` on `POST /skills/{id}/bots`, or `trash.changed` on a bot purge: `backend/src/core/bots/bots.service.ts:680`, `:695`.
- **Fixed on 2026-11-12** (a repository setting, at the owner's request; `testing.md` §4 has the rule). GitHub requires no status checks, so a PR with a red gate can merge: `docs/testing.md:296`. **Fix before M3.**
- `db:check` does not read the migration SQL, so a hand edit passes: `scripts/db-check.ts:31`.
- Lint guards are narrower than the text that relies on them, and `pnpm lint` allows warnings: `eslint.config.js:19`, `:50`.
- The Guide skill omits "Make active again" and "Show deprecated": `seed/skills/using-the-app/SKILL.md:30`.
- Some e2e tests wait a fixed time and then check that nothing happened (plausible only): `frontend/test/e2e/bots.spec.ts:290`.
- **Fixed in #73** (commit `2eb1b9e`: the test joins the key from two parts). A test holds a full-shape AWS example key: `backend/src/core/guard/sensitive-data.rules.test.ts:9`.

## Limits

- Not reached: real-browser avatar upload and touch drag, the order that each race test forces in the service tests, GitHub secret scanning settings, and decoder fuzzing.
- The owner's list of PR #59 issues is not a separate list: the owner closed that question on 2026-11-05 (question 7), and the findings of this audit count as those issues.

## How to repeat the key checks

The probes were temporary files and are gone. To repeat them, use a real browser with a real backend, and hold the request with `page.route`.

- **Row 1a:** create a skill and change Description. Click Save, and hold the POST. Type Description back to the old text. Send the POST, but hold its answer until the refresh arrives. The field then shows the sent text, and the bar says "All changes are saved."
- **Row 1:** on a bot page, type in Name and press Esc. No dialog stays open.
- **Row 2:** clone a bot from the Bots page and leave. Change the source bot's persona through the API, and clone again without a reload. The form has the old persona.
- **Row 3:** deprecate and delete the only skill, with `page.route` on `GET /api/skills`. The page ends on "Page not found".
- **Row 5:** call `parseSkillMd` with 40,000 unique frontmatter keys (389 KB). It takes about 12 s.
