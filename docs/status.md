# Status

Where the project is right now. This file owns delivery state, next work, and owner decisions.
[delivery-quality.md](delivery-quality.md) tracks issue counts, review rounds, and prevention evidence.
The plan ([development-plan.md](development-plan.md)) says what and in which order, and carries no delivery state beyond whether a brief file exists.

**Who updates it:** the builder agent, in the same PR that finishes a step (part of the
definition of done in `AGENTS.md` §9). The owner updates it for owner-only steps (reviews,
approvals). Keep it short: link to PRs and briefs instead of describing work.

## Now

The repository audit of 2026-11-05 found 55 issues. After the owner's decisions, 15 are P2, 39 are P3, and the owner accepted one case; none is P1. Its fixes come before M3 in the owner's order. #69 is closed, and the owner watches more PRs before deciding whether to bring it back. Findings, decisions and progress are in [audits/2026-11-05-repo-audit.md](audits/2026-11-05-repo-audit.md). PR 2 of 7, the security fixes, merged in [#73](https://github.com/binhle312/cty1ng/pull/73) on 2026-11-06. [#76](https://github.com/binhle312/cty1ng/pull/76) merged on 2026-11-06 and records the guard decisions. PR 3 of 7, the Skills page, merged in [#78](https://github.com/binhle312/cty1ng/pull/78) on 2026-11-06. PR 4 of 7, the Bots page, merged in [#82](https://github.com/binhle312/cty1ng/pull/82) on 2026-11-08. PR 5 of 7, tests only, merged in [#86](https://github.com/binhle312/cty1ng/pull/86) on 2026-11-10. PR 6 of 7, six tabs, merged in [#91](https://github.com/binhle312/cty1ng/pull/91) on 2026-11-10.

The automated security review is off for now (owner, 2026-11-06, [security.md §2.11](security.md#211-supply-chain-and-review)).

M0, M1 and M2 are merged. M2c merged in [#59](https://github.com/binhle312/cty1ng/pull/59) on 2026-11-04.
M2c adds the bot page and the Skills page's upgrade and assign cards.
Its evidence and remaining limits are in [delivery-quality.md](delivery-quality.md) and its [archive](delivery-quality-archive.md), DQ-011–DQ-021.
The plans of each slice are in [plans/](plans/README.md).

The [Slices table](#slices) records delivery state and PRs.
The [design index](design/README.md) identifies agreed designs and open design work.

## Next

The owner's order (2026-11-08, in the [audit file](audits/2026-11-05-repo-audit.md), "Approved fix order"):

1. Audit PR 6, six tabs: merged in [#91](https://github.com/binhle312/cty1ng/pull/91) on 2026-11-10. Its follow-up, [#96](https://github.com/binhle312/cty1ng/pull/96), merged on 2026-11-10.
2. The P3 PRs: every P3 found so far, from one list with no duplicates, in small PRs by area. The M2 close rows of the [#60](https://github.com/binhle312/cty1ng/pull/60) review are on that list.
   The owner approved the list and the order of its PRs on 2026-11-12 ([audit file](audits/2026-11-05-repo-audit.md), "Changed on 2026-11-08"). The first PR, records only, is [#105](https://github.com/binhle312/cty1ng/pull/105).
3. One style-only PR for the 104 `max-params` places.
4. The second audit, with the [audit workflow](workflows/audit.md).
5. Prepare the [M3 part briefs and specification work](development-plan.md#specification-work-before-m3a).
   M3 has seven delivery parts. Resolve the open schema, Usage and Guide questions before dependent code. Each M3 part starts with the EGM step ([egm.md](workflows/egm.md)).
6. Complete the owner's whole-UI review after M3. The deferred items remain in the table below.

From M3 on, P3 findings are fixed at the end of each milestone, before the next one starts ([merge bar](workflows/merge-bar.md); owner, 2026-11-10).

## Waiting on the owner

| Item | Needed by |
| --- | --- |
| **UI review after M3** (owner, 2026-11-02): the owner reviews the whole UI once M3 is done; UI texts and UI standardisation wait until then. Open so far: the M2c texts (`design/components/bot-page.md` §10); "Required" (bot page) or "Type a name." (Create page) for an empty name; the disabled Discard of the bot save bar has no tooltip (ui-rules B5, found in the #59 review); the Always load switch of the bot's Skills tab is plainly disabled, with no tooltip and no focus, while its change is on its way (ui-rules B5, #59 review, 2026-11-03); the "+N" tile of the conversation icon: "+12" does not fit a 14 px cell at the 10 px minimum, so consider a +9 cap | End of M3 |
| Suggestions from the 2026-11-03 UI review, not approved rules: prefer "Type a name."; consider Up/Down instead of Alt+←/→ in vertical lists; use discard-specific dialog text when the owner stays on the page | UI review after M3 |
| D52 accepted (each run writes on its own branch and saves to the Library). An agent finishes the documents still missing: the M6 brief (its last open list), `domain-model.md` (`run_branches` and invariants), `architecture.md` (workspace operations, save queue, file claims), `security.md` §2.3, `realtime-events.md` (`library.*`), `conversation-rules.md` (run end). The owner approves the `run_branches` schema design (initial schema for M6). The generated SQL is approved in the slice PR | M6 plan |
| D54 accepted (the approved plan covers deletes and moves; run-end plan check): add the plan lists and `runs.plan_check` to `domain-model.md`, and approve the schema design. The generated SQL is approved in the slice PR | Spec pass of the first plan consumer (`development-plan.md`, Shared plan approvals) |
| D57 accepted (the plan card shows the run's progress; `mark_step`, configurable reminders, mark sources, `check_done` evidence): build it with the plan card | Plan card slice (M5b, M5c or M6) |
| D58 and D59 accepted (cross-conversation reading on request, Send to conversation, save notice when project memory changed): approve the FTS5 schema design (initial schema for the slice after M5b, owner 2026-10-26), and the instructions/goal change time and D59 snapshot schema design (initial schema for M6). The generated SQL is approved in each slice PR; UI design of the inbox, information card and memory notice in the slice plans | Next slice plan, M6 plan, Inbox plan |
| D53 accepted (web through provider web tools): check the default limits and approve the schema design for the bot setting and the run flag (initial schema for that milestone). The generated SQL is approved in the slice PR | Web access milestone plan |
| Login providers ([ideas/login-providers.md](ideas/login-providers.md) §7): choose the first tool, the cap rule for a provider with no price for each token, and the place of the slice in the order after M3. Decide if the Claude rule for plan credentials needs a question to Anthropic | When M3 ends, before the slice plan |
| D66 accepted (2026-11-11; each bot compacts its old history into its own summary, [D66](decisions/D66-each-bot-compacts-its-old-history.md)). An agent writes the documents still missing: `conversation-rules.md` §4, §6 and §9, `domain-model.md` (the summaries, the checkpoints, the compact record, `model_requests`, the new settings), `architecture.md` §6 and §11, `security.md` §2.13, `realtime-events.md`, `api.md`, `testing.md`, `requirements/conversation.md` and the brief of the slice. The owner approves the schema design, and the UI design of the Compact action, the failure notice and the summary view. The generated SQL is approved in the slice PR | Plan of the Compact slice (after M4-3) |
| The P3 list (owner's order of 2026-11-12: one question after the third P3 PR). The builder advises to drop DQ-108, DQ-109, DQ-167, DQ-169 and the audit P3 "CLI changes do not wake the server's event stream". The builder advises to move to M3: DQ-107, DQ-200, the follow-up row "The Clone of a bot can fill its form from old data", and the audit P3 about the paths of the security review. The owner also decides DQ-170, the body of #86 (DQ-163, DQ-172, DQ-173), and the audit P3 items "An event that commits between the first GET and the first `ready`" and "A new assign can pin an older version" | After the third P3 PR |
| Approve the M3 schema design for D46 (auto title) before it is written. The generated SQL is approved in the slice PR | M3 plan |
| Specify the data of the bot Usage tab (`design/components/bot-page.md` §9.6): task verdict on runs, setup change record, tile targets, Group by, run timings. Needs a schema design approval (initial schema for M3 and M7). The generated SQL is approved in the slice PR | M3 and M7 plans |
| Approve the M5b schema design: `projects.instructions_md`, `instructions_version`, `colour`, `pinned_position`, goal ≤ 500 chars, `memory_items.seen_at`, `memory_proposals` and the `model_requests` change (D63) (initial schema for M5b, `domain-model.md` §14). Claude Code stops for this approval before it writes them. The generated SQL is approved in the M5b PR | M5b plan |

## Follow-ups

Known gaps that no PR has fixed yet. Each has a target; the slice plan that is the target takes
it in, and the row goes when its PR merges.
A P3 that has a DQ id is not in this table. Its state lives only in its row of the
[ledger](delivery-quality.md#5-live-issue-ledger) (`open` or `partial`), so that each P3 has one home (owner, 2026-11-10).

| Item | Found in | Target |
| --- | --- | --- |
| `pnpm e2e:serve` can die and leave its servers on the ports: a closed stdout (`EPIPE`) or SIGHUP stops the script without stopping them, and the marker stays. It fails safe, but its message says to stop a script that no longer runs, and no doc says to delete `.e2e-serve`. Stop the servers on those exits, and correct the message | [#60](https://github.com/binhle312/cty1ng/pull/60) review | The P3 PRs before M3 (owner, 2026-11-08) |
| No test runs `scripts/e2e-serve.ts` itself, so its guard and signal wiring have only manual evidence | [#60](https://github.com/binhle312/cty1ng/pull/60) review | The P3 PRs before M3 (owner, 2026-11-08) |
| Temporary CLI `skills trash` and `skills restore` (M1 spec gap pass, owner 2026-10-30): remove them when the Trash page exists | [#51](https://github.com/binhle312/cty1ng/pull/51) | M5b |
| P3 (`workflows/merge-bar.md`): late-answer rules still in refs: `create-bot-page.tsx` (`mounted`, `inFlight`), `crop-card.tsx` (`closed`, `lastFile`), and the skill pages' still-on-page check, now one hook (`on-page.ts`, [#78](https://github.com/binhle312/cty1ng/pull/78)). They are not card or dialog rules, so the owner left them out of the 2026-11-04 design; check them against `frontend-conventions.md` §1. The check for the skill pages, done in [#78](https://github.com/binhle312/cty1ng/pull/78): the hook holds one yes or no, and `takesServerText` owns the rule for server text, but the rest of the skill page's state rules are not in one pure module | [#59](https://github.com/binhle312/cty1ng/pull/59) review of `ec8faa7` | When those files next change (owner, 2026-11-04) |
| The `db_lock_wait_seconds` histogram (`architecture.md` §9, D29 switch trigger 3); there is no metrics output yet | #48 | M3 (the worker brings concurrent writes) |
| `esbuild` advisory (moderate, dev only, through `drizzle-kit` 0.31.11); no stable fix | #48 | Update `drizzle-kit` when 1.0 is stable (Dependabot) |
| First-run offer of the Guide bot in the app ("Add Guide" in the empty state, so a new owner needs no `make seed`); needs a design round (owner, 2026-11-01, M2 plan decision 15) | [#57](https://github.com/binhle312/cty1ng/pull/57) | M3 spec gap pass |
| Temporary CLI `bots trash` and `bots restore` (M2 spec gap pass, owner 2026-11-01): remove them when the Trash page exists | [#56](https://github.com/binhle312/cty1ng/pull/56) | M5b |
| Rail and bar 2 list scrolling (fade, ˄/˅ buttons, the list ends 24 px above the user panel, `left-bar.md` §1.3, §2): M0 has no lists yet | [#49](https://github.com/binhle312/cty1ng/pull/49) | M5b (projects) and M3 (conversations) |
| More visual snapshots: `themes.md` §5 asks for 8 key screens × 2 themes × 2 modes; M0 has one screen in Command dark | [#49](https://github.com/binhle312/cty1ng/pull/49) | Each slice adds its screens; light and Material with their values |
| Copy slug on the server: today the Clone page tries `-copy-2`, `-copy-3` … after a confirmed `slug_taken` (a skill in Trash keeps its slug). If many collisions make it slow, the server picks the suffix, for example a flag on `POST /skills`; `POST /skill-drafts/{id}/decision` already picks the next free suffix for a bot's slug (`api.md` §2a) (an API change; owner, 2026-10-31; `design/components/skills-page.md`, "Texts added in the M1b build") | [#54](https://github.com/binhle312/cty1ng/pull/54) | When collisions get slow; not planned before M5b |
| Object arguments in the code from before the `max-params` lint rule (104 places in `eslint-suppressions.json`, 2026-11-04): fix them, then prune the list | [#59](https://github.com/binhle312/cty1ng/pull/59) | One style-only PR after the P3 PRs ([Next](#next), item 3) |
| `uuid` advisory GHSA-w5hq-g745-h8pq (moderate, through `typeid-js` 1.2.0, which needs `uuid` ^10). **Accepted risk** (owner, 2026-10-30): the flaw is in v3/v5/v6 with a caller buffer; `typeid-js` uses only `stringify` and `v7`, and our code never calls `uuid`. No override | #48 | Update `typeid-js` when a version allows `uuid` ≥ 11.1.1 |
| Bar 2 on Home keeps its M0 state: `bar-two.tsx` always says "No bots yet" and shows the first-run button, also with bots (`left-bar.md` §3) | Docs audit 2026-11-04 | M3d |
| Test names: invariants 4, 6, 7 and 12 have no `invariant NN:` test (`testing.md`), and no schema test checks every primary key column (`domain-model.md` §1) | Docs audit 2026-11-04 | M3 plan |
| Small built-UI differences: the empty-state slime at 96 px (`bot-avatar.md` sizes), "⚠" on the card health line (`bots-page.md`), header arrows only over the roster (UI-2.9), Create errors on leaving a field, not after Next (`create-bot-page.md` E1, E2) | Docs audit 2026-11-04 | UI review after M3 |
| The Clone of a bot can fill its form from old data: its template read has `gcTime: 0`, and a read that is on its way when the page closes keeps the old template in the cache. A visit that returns before that answer fills the form from it (`frontend-conventions.md` §5, "A form that fills once"). Not run; from reading | [#92](https://github.com/binhle312/cty1ng/pull/92), DQ-191 | P3 list before M3 |
| A busy port stops the backend with a raw stack trace, after the migrations ran and the timed jobs started: `backend/src/app/main.ts` has no `error` listener on the server | Repository review of 2026-11-10 ([#94](https://github.com/binhle312/cty1ng/pull/94)) | The P3 PRs before M3 (owner, 2026-11-08) |
| A unit test with a time limit can fail on a busy machine: "scans a 1 MB line of short code-like words in well under a second" (`backend/src/core/guard/sensitive-data.rules.test.ts`) allows 1,000 ms. It took 1,130 ms in one of two runs of `pnpm test` on `c43278a`, with a load of 20 on 16 cores. The second run passed. A second case, from the local run for [#102](https://github.com/binhle312/cty1ng/pull/102): "random orders from a seed, with both tabs and another place" (`frontend/src/features/bots/bot-edit-sequences.test.ts`) passed its 30 s limit one time in a full `pnpm test`, with a load of 16. Its file alone took 8.7 s, and the next full run passed | Review fix of [#98](https://github.com/binhle312/cty1ng/pull/98), 2026-11-11 | The P3 PRs before M3 (owner, 2026-11-08) |
| The CLI commands `skills` and `bots` print a raw stack trace for a wrong path or a bad setting; `db migrate` prints one line (`backend/src/app/cli.ts`) | Repository review of 2026-11-10 ([#94](https://github.com/binhle312/cty1ng/pull/94)) | The P3 PRs before M3 (owner, 2026-11-08) |
| Backend cleanup with no change of behaviour: the service method `trashed` has no caller; "Export all" reads each latest version again; `liveSkill` and the purge loop have two copies; `modifiedAt` of the avatar port has only test callers. Two parts need approval: the 1 MB limit of `SKILL.md` is in three places (upload code), and `SkillDiff` is defined two times (the OpenAPI document changes) | Repository review of 2026-11-10 ([#94](https://github.com/binhle312/cty1ng/pull/94)) | The P3 PRs before M3 (owner, 2026-11-08) |
| A relative time ("5 min ago") does not change while a page stays open: `time-text.tsx` and three callers read the clock only in a render. The fix adds a shared hook, so its plan has a short design | Repository review of 2026-11-10 ([#94](https://github.com/binhle312/cty1ng/pull/94)) | The P3 PRs before M3 (owner, 2026-11-08) |
| The Skills index page shows the load error when a background refresh fails and the data is there (`skills-index-page.tsx` tests `isError` first) | Repository review of 2026-11-10 ([#94](https://github.com/binhle312/cty1ng/pull/94)) | The P3 PRs before M3 (owner, 2026-11-08) |
| History: the open folds of a diff stay open when the pair of versions changes (`DiffView` has no `key` in `skill-history.tsx`) | Repository review of 2026-11-10 ([#94](https://github.com/binhle312/cty1ng/pull/94)) | The P3 PRs before M3 (owner, 2026-11-08) |
| `aria-label` with no role: the "Unsaved changes" dot in `skill-list.tsx`, and the root of `DiffView` | Repository review of 2026-11-10 ([#94](https://github.com/binhle312/cty1ng/pull/94)) | The P3 PRs before M3 (owner, 2026-11-08) |
| Frontend cleanup with the same texts and screens: `changesLine` has no caller; the list of skill tabs is written three times; two `plural` helpers; `bar-two.tsx` copies the style of `MenuItem`; two links use `?tab=profile`; about 50 exports have no user outside their file | Repository review of 2026-11-10 ([#94](https://github.com/binhle312/cty1ng/pull/94)) | The P3 PRs before M3 (owner, 2026-11-08) |
| Specification gap: nothing limits the text that tools add during one run. The history budget (D32) is checked one time, when the prompt is built; a large `read_file` result or many tool results can then fill the window, and the retry with half the budget cuts only the history. Decide a size limit for one tool result and a token count during the run (both settings). From reading `conversation-rules.md` §4 and §9; no code exists yet | Owner's question, 2026-11-11 (with [D66](decisions/D66-each-bot-compacts-its-old-history.md)) | Specification work before M3a |
| A script in `scripts/` that moves the closed ledger rows to the archive and can run again, with a test. The script of #99 is only in its PR description, and it runs one time | Review of [#99](https://github.com/binhle312/cty1ng/pull/99) (owner, 2026-11-11) | Its own PR, before the next move of ledger rows |
| `@tanstack/react-query` stays at 5.105.0 (owner, 2026-11-09). With 5.105.3 and with 5.107.1, two tests fail: "leaves no listener on the cache after it ends" (`frontend/src/lib/api/query-reads.test.ts`) and "shows the new skill, not Page not found" (`frontend/src/features/skills/skill-page.test.tsx`); run on `ec41c39`, 2026-11-12. Each weekly Dependabot group PR has this update. The update needs the owner's decision on the Create rule of `frontend-conventions.md` §5 | [#81](https://github.com/binhle312/cty1ng/pull/81) | The P3 PRs before M3, the second PR (owner, 2026-11-12) |

## Slices

| Slice | State | PR | Notes |
| --- | --- | --- | --- |
| M0 | merged | [#46](https://github.com/binhle312/cty1ng/pull/46) (M0a), [#48](https://github.com/binhle312/cty1ng/pull/48) (M0b), [#49](https://github.com/binhle312/cty1ng/pull/49) (M0c), [#50](https://github.com/binhle312/cty1ng/pull/50) (Impeccable snapshot) | Three parts (M0a tooling, M0b backend, M0c frontend), all merged 2026-10-30 |
| M1 | merged | [#51](https://github.com/binhle312/cty1ng/pull/51) (spec gap pass), [#52](https://github.com/binhle312/cty1ng/pull/52) (plan and M1a backend), [#53](https://github.com/binhle312/cty1ng/pull/53) (M1c brief), [#54](https://github.com/binhle312/cty1ng/pull/54) (M1b Skills page), [#55](https://github.com/binhle312/cty1ng/pull/55) (M1c backend maintenance) | Plan approved 2026-10-31 ([plan](plans/M1-skill-hub.md)), split into M1a (backend), M1b (Skills page) and M1c (event pruning, SQLite writer guard), all merged. Design approved: `design/components/skills-page.md` (round 8); D49 accepted. Round 16 moves the page to the bot page layout (agreed, #38) |
| M1c | merged | see M1 | Part of the M1 row; its own row in the plan |
| M2 | merged | [#20](https://github.com/binhle312/cty1ng/pull/20) (spec), [#56](https://github.com/binhle312/cty1ng/pull/56) (spec gap pass), [#57](https://github.com/binhle312/cty1ng/pull/57) (plan, M2a), [#58](https://github.com/binhle312/cty1ng/pull/58) (M2b), [#59](https://github.com/binhle312/cty1ng/pull/59) (M2c), [#66](https://github.com/binhle312/cty1ng/pull/66) (close fixes) | Plan approved 2026-11-01 ([plan](plans/M2-bots.md)); M2a merged 2026-11-01; M2b merged 2026-11-02; M2c (bot page, upgrade and assign cards) merged 2026-11-04. Agreed: `design/components/bots-page.md`, `create-bot-page.md` (with Clone), `bot-page.md` and the standards (round 9). Usage tab design agreed, its data open (M2 shows its empty state). Spec gap pass answered 2026-11-01 |
| M3 | UI design agreed | [#26](https://github.com/binhle312/cty1ng/pull/26) (spec) | Round 10: `design/components/conversation-page.md`, `composer.md`, `conversation-cards.md` |
| Login providers | not written | [#104](https://github.com/binhle312/cty1ng/pull/104) (idea note) | Bots that run on a CLI login (Copilot, Claude Code, Codex), not an API key. Start: after M3 (owner, 2026-11-11). Notes and the steps before code: [ideas/login-providers.md](ideas/login-providers.md) |
| Compact | not written | [#102](https://github.com/binhle312/cty1ng/pull/102) (decision D66, research note) | Each bot compacts its old history into a summary: auto compact at the history budget, and a Compact action for one bot (D66). Start: after M4-3 (owner, 2026-11-11) |
| M4 | UI design agreed | [#34](https://github.com/binhle312/cty1ng/pull/34) (spec) | Round 12: `design/components/conversation-page.md` §2 |
| M5 | UI design agreed | [#35](https://github.com/binhle312/cty1ng/pull/35) (spec) | Round 14: `design/components/settings-page.md`, `conversation-page.md` §2.4; key `bot_discussion_enabled` |
| M5b | UI design agreed | [#37](https://github.com/binhle312/cty1ng/pull/37) (spec) | Brief: `tasks/M5b-projects-and-memory.md`. Round 15: `design/components/memory-page.md`, `trash-page.md`, `conversation-page.md` §2.1a; D62, D63 accepted |
| M5e | not written | | Cross-conversation reading (D58); the next slice after M5b |
| M5c | UI design agreed | [#38](https://github.com/binhle312/cty1ng/pull/38) (spec) | Skills drafted by bots (D41, D64, D65 accepted). Round 16: `design/components/skill-draft-card.md`, `skills-page.md` §2a, §13, §17. Brief not written |
| M5d | not written | [#39](https://github.com/binhle312/cty1ng/pull/39) (spec) | Bots improve their skills from the owner's feedback (D51). D51 amendment 2026-10-27: saved test cases for each skill, approved by the owner |
| M6 | UI design agreed | [#41](https://github.com/binhle312/cty1ng/pull/41) (spec) | Round 17: `design/components/library-page.md`, `library-cards.md` |
| Inbox | not written | | Project inbox (D58, D59) |
| M7 | not started | | |
| M8 | UI design agreed | [#33](https://github.com/binhle312/cty1ng/pull/33) (spec) | Round 11: `design/components/flow-timeline.md`; Timeline only |
| M8b | not written | | Board map in the Flow pane (D30) |
| M8c | proposed | | Project-wide Board, read-only, after M8b (`design/components/left-bar.md` §5) |
| Avatars | not written | | Jelly and Pixel avatar styles, and the motion of the Bot animations setting |
| T2 | not written | | Material theme (D30) |
| M9 | not written | | VPS milestone |

States: `not started`, `not written` (no brief yet) or `proposed` → `planning` → `UI design review` → `UI design agreed` → `building` → `in review` → `merged`.
A slice can also be `blocked` (say on what in Notes).

## Done

Each row has a date, 15 words or less, and the link of its PR (owner, 2026-11-10). The first row has no PR of its own. The detail is in the PR.

| Date | What |
| --- | --- |
| 2026-10-21 | Specification: requirements, design sketches, decisions D1–D29, briefs M0–M8 |
| 2026-10-21 | Repository created and spec merged; D31 and D32 accepted. [#1](https://github.com/binhle312/cty1ng/pull/1) to [#5](https://github.com/binhle312/cty1ng/pull/5) |
| 2026-10-21 | Owner review: D6, D11, D13, D33 accepted; D9 and D21 accepted with changes. [#6](https://github.com/binhle312/cty1ng/pull/6) |
| 2026-10-26 | M5b design round 15: Memory, Trash and Move to project; D62, D63 accepted. [#37](https://github.com/binhle312/cty1ng/pull/37) |
| 2026-10-27 | M5c design round 16: skill draft card, Edit on the Skills page; D64, D65 accepted. [#38](https://github.com/binhle312/cty1ng/pull/38) |
| 2026-10-27 | Eval and guardrail review: amendments of D51 and D42. [#39](https://github.com/binhle312/cty1ng/pull/39), [#40](https://github.com/binhle312/cty1ng/pull/40) |
| 2026-10-28 | Diagram gate step 1: system overview and component boundaries; D57 path amendment. [#42](https://github.com/binhle312/cty1ng/pull/42) |
| 2026-10-29 | Diagram gate step 2: four ERDs by domain, and schema fixes. [#43](https://github.com/binhle312/cty1ng/pull/43) |
| 2026-10-30 | Shell review: rail, header, user panel, battery focus, text size rules L1–L3. [#44](https://github.com/binhle312/cty1ng/pull/44) |
| 2026-10-30 | Prototype references and `porting-guide.md` removed (owner); its lessons moved to `testing.md` §3. [#45](https://github.com/binhle312/cty1ng/pull/45) |
| 2026-10-30 | M0 merged: tooling, backend, frontend shell, design snapshot. [#46](https://github.com/binhle312/cty1ng/pull/46), [#48](https://github.com/binhle312/cty1ng/pull/48), [#49](https://github.com/binhle312/cty1ng/pull/49), [#50](https://github.com/binhle312/cty1ng/pull/50) |
| 2026-10-30 | M1 spec gap pass: 28 gaps answered; D6 and D36 amended. [#51](https://github.com/binhle312/cty1ng/pull/51) |
| 2026-10-31 | M1 plan approved; M1a built and merged; M1c added. [#52](https://github.com/binhle312/cty1ng/pull/52) |
| 2026-10-31 | M1b built: the Skills page. [#54](https://github.com/binhle312/cty1ng/pull/54) |
| 2026-10-31 | M1b merged. [#54](https://github.com/binhle312/cty1ng/pull/54) |
| 2026-10-31 | M1c built: event pruning, and one SQLite writer for each file. [#55](https://github.com/binhle312/cty1ng/pull/55) |
| 2026-11-01 | M1c merged; M1 is complete. [#55](https://github.com/binhle312/cty1ng/pull/55) |
| 2026-11-01 | M2 plan approved: Gemini joins Anthropic, Guide seed bot, split M2a/M2b/M2c. [#57](https://github.com/binhle312/cty1ng/pull/57) |
| 2026-11-01 | M2a review items approved: migration 0002, upload code, Guide persona, tool lines. [#57](https://github.com/binhle312/cty1ng/pull/57) |
| 2026-11-01 | M2 spec gap pass merged: 30 gaps answered. [#56](https://github.com/binhle312/cty1ng/pull/56) |
| 2026-11-01 | M2a merged: bots backend. [#57](https://github.com/binhle312/cty1ng/pull/57) |
| 2026-11-02 | M2b merged: Bots page, header roster, Create bot with Clone. [#58](https://github.com/binhle312/cty1ng/pull/58) |
| 2026-11-04 | M2c merged; M2 is complete. [#59](https://github.com/binhle312/cty1ng/pull/59) |
| 2026-11-04 | Every plan now has a file in `docs/plans/` (owner). [#63](https://github.com/binhle312/cty1ng/pull/63) |
| 2026-11-04 | Docs audit: docs matched to the built code and the current decisions. [#61](https://github.com/binhle312/cty1ng/pull/61) |
| 2026-11-04 | Skill `typescript-best-practices` vendored; the 12 `principle-*` skills get shorter names. [#68](https://github.com/binhle312/cty1ng/pull/68) |
| 2026-11-04 | Three pstack principles adapted: `principle-remove-first`, `principle-script-the-work`, and the redesign rule. [#68](https://github.com/binhle312/cty1ng/pull/68) |
| 2026-11-04 | Automated security review on; it runs when the owner marks a PR Ready. [#64](https://github.com/binhle312/cty1ng/pull/64) |
| 2026-11-04 | Docs audit answers: the owner answered all the questions; no feature is built. [#65](https://github.com/binhle312/cty1ng/pull/65) |
| 2026-11-04 | M2 close fixes; the owner dropped DQ-018, DQ-019 and the remaining gaps of DQ-021. [#66](https://github.com/binhle312/cty1ng/pull/66) |
| 2026-11-04 | Two flaky e2e tests fixed: `csp.spec.ts` and J1. [#70](https://github.com/binhle312/cty1ng/pull/70) |
| 2026-11-05 | Repository audit recorded, with the owner's seven decisions. [#71](https://github.com/binhle312/cty1ng/pull/71) |
| 2026-11-06 | Audit PR 3, the Skills page, merged; `takesServerText` is the one rule for server text. [#78](https://github.com/binhle312/cty1ng/pull/78) |
| 2026-11-06 | Principle skill `principle-ask-with-options` merged. [#79](https://github.com/binhle312/cty1ng/pull/79) |
| 2026-11-06 | `principle-ask-with-options` also requires Simplified Technical English at 80%. [#80](https://github.com/binhle312/cty1ng/pull/80) |
| 2026-11-07 | Audit PR 4, the Bots page, merged; two new process rules. [#82](https://github.com/binhle312/cty1ng/pull/82) |
| 2026-11-08 | Audit method added: `docs/workflows/audit.md`. [#83](https://github.com/binhle312/cty1ng/pull/83) |
| 2026-11-08 | DQ-088 fixed: reads and saves run when the browser says it is offline. [#84](https://github.com/binhle312/cty1ng/pull/84) |
| 2026-11-08 | `principle-ask-with-options` asks about one decision in each question. [#85](https://github.com/binhle312/cty1ng/pull/85) |
| 2026-11-09 | Skill `arena` added; `principle-remove-first` gets two rules. [#87](https://github.com/binhle312/cty1ng/pull/87) |
| 2026-11-09 | Principle skill `principle-answer-first` added. [#89](https://github.com/binhle312/cty1ng/pull/89) |
| 2026-11-09 | Audit PR 5, tests only, merged on 2026-11-10; break lists with `pnpm check:breaks`. [#86](https://github.com/binhle312/cty1ng/pull/86) |
| 2026-11-10 | EGM trial workflow added: `docs/workflows/egm.md`. [#90](https://github.com/binhle312/cty1ng/pull/90) |
| 2026-11-10 | Skill `arena` gets a Claude Fable 5.2 seat for Fable areas. [#93](https://github.com/binhle312/cty1ng/pull/93) |
| 2026-11-10 | A Clone draft stays when its source skill goes away (DQ-180). [#92](https://github.com/binhle312/cty1ng/pull/92) |
| 2026-11-10 | One home for each settings default and range; merged on 2026-11-11. [#98](https://github.com/binhle312/cty1ng/pull/98) |
| 2026-11-10 | Audit PR 6, six tabs, merged: only a visible tab holds the event stream. [#91](https://github.com/binhle312/cty1ng/pull/91) |
| 2026-11-10 | The read of all data also covers a closed dialog (DQ-198). [#96](https://github.com/binhle312/cty1ng/pull/96) |
| 2026-11-10 | Closed ledger rows move to an archive file; merged on 2026-11-11. [#99](https://github.com/binhle312/cty1ng/pull/99) |
| 2026-11-10 | Root-cause review of repeated review findings; a §9 redesign gets its own PR. [#88](https://github.com/binhle312/cty1ng/pull/88) |
| 2026-11-10 | Repository review: stale lines fixed; the P3 plan and the P3 rule written down. [#94](https://github.com/binhle312/cty1ng/pull/94) |
| 2026-11-10 | The project moves to Node 26 LTS (owner). [#95](https://github.com/binhle312/cty1ng/pull/95) |
| 2026-11-10 | Tooling changes of the repository review; merged on 2026-11-11. [#97](https://github.com/binhle312/cty1ng/pull/97) |
| 2026-11-11 | Skill `arena`: two more rules for the brief of each candidate. [#100](https://github.com/binhle312/cty1ng/pull/100) |
| 2026-11-11 | A claim fits its proof: three rule changes after an arena. [#101](https://github.com/binhle312/cty1ng/pull/101) |
| 2026-11-11 | D66 accepted, merged on 2026-11-11: each bot compacts its old history into a summary. [#102](https://github.com/binhle312/cty1ng/pull/102) |
