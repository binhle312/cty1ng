# Status

Where the project is right now. This file owns delivery state, next work, and owner decisions.
[delivery-quality.md](delivery-quality.md) tracks issue counts, review rounds, and prevention evidence.
The plan ([development-plan.md](development-plan.md)) says what and in which order, and carries no delivery state beyond whether a brief file exists.

**Who updates it:** the builder agent, in the same PR that finishes a step (part of the
definition of done in `AGENTS.md` §9). The owner updates it for owner-only steps (reviews,
approvals). Keep it short: link to PRs and briefs instead of describing work.

## Now

The repository audit of 2026-11-05 found 55 issues. After the owner's decisions, 15 are P2, 39 are P3, and the owner accepted one case; none is P1. Its fixes come before M3 in the owner's order. #69 is closed, and the owner watches more PRs before deciding whether to bring it back. Findings, decisions and progress are in [audits/2026-11-05-repo-audit.md](audits/2026-11-05-repo-audit.md). PR 2 of 7, the security fixes, merged in [#73](https://github.com/binhle312/cty1ng/pull/73) on 2026-11-06. [#76](https://github.com/binhle312/cty1ng/pull/76) merged on 2026-11-06 and records the guard decisions. PR 3 of 7, the Skills page, merged in [#78](https://github.com/binhle312/cty1ng/pull/78) on 2026-11-06. PR 4 of 7, the Bots page, merged in [#82](https://github.com/binhle312/cty1ng/pull/82) on 2026-11-08. PR 5 of 7, tests only, is draft [#86](https://github.com/binhle312/cty1ng/pull/86).

The automated security review is off for now (owner, 2026-11-06, [security.md §2.11](security.md#211-supply-chain-and-review)).

M0, M1 and M2 are merged. M2c merged in [#59](https://github.com/binhle312/cty1ng/pull/59) on 2026-11-04.
M2c adds the bot page and the Skills page's upgrade and assign cards.
Its evidence and remaining limits are in [delivery-quality.md](delivery-quality.md), DQ-011–DQ-021.
The plans of each slice are in [plans/](plans/README.md).

The [Slices table](#slices) records delivery state and PRs.
The [design index](design/README.md) identifies agreed designs and open design work.

## Next

1. Close M2. The P3 follow-ups with target M2 close are fixed or dropped in [#66](https://github.com/binhle312/cty1ng/pull/66), except the rows from the [#60](https://github.com/binhle312/cty1ng/pull/60) review, which the owner has not decided yet.
   The PR population is confirmed. Exact totals are not possible: three PRs are unmeasured and 11 of the 17 issue rows are `partial` or `unknown` (`delivery-quality.md` §2).
2. Prepare the [M3 part briefs and specification work](development-plan.md#specification-work-before-m3a).
   M3 follows M2c and has seven delivery parts. Resolve the open schema, Usage and Guide questions before dependent code.
3. Complete the owner's whole-UI review after M3. The deferred items remain in the table below.

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
| Approve the M3 schema design for D46 (auto title) before it is written. The generated SQL is approved in the slice PR | M3 plan |
| Specify the data of the bot Usage tab (`design/components/bot-page.md` §9.6): task verdict on runs, setup change record, tile targets, Group by, run timings. Needs a schema design approval (initial schema for M3 and M7). The generated SQL is approved in the slice PR | M3 and M7 plans |
| Approve the M5b schema design: `projects.instructions_md`, `instructions_version`, `colour`, `pinned_position`, goal ≤ 500 chars, `memory_items.seen_at`, `memory_proposals` and the `model_requests` change (D63) (initial schema for M5b, `domain-model.md` §14). Claude Code stops for this approval before it writes them. The generated SQL is approved in the M5b PR | M5b plan |

## Follow-ups

Known gaps that no PR has fixed yet. Each has a target; the slice plan that is the target takes
it in, and the row goes when its PR merges.

| Item | Found in | Target |
| --- | --- | --- |
| `pnpm e2e:serve` can die and leave its servers on the ports: a closed stdout (`EPIPE`) or SIGHUP stops the script without stopping them, and the marker stays. It fails safe, but its message says to stop a script that no longer runs, and no doc says to delete `.e2e-serve`. Stop the servers on those exits, and correct the message | [#60](https://github.com/binhle312/cty1ng/pull/60) review | M2 close |
| No test runs `scripts/e2e-serve.ts` itself, so its guard and signal wiring have only manual evidence | [#60](https://github.com/binhle312/cty1ng/pull/60) review | M2 close |
| Temporary CLI `skills trash` and `skills restore` (M1 spec gap pass, owner 2026-10-30): remove them when the Trash page exists | [#51](https://github.com/binhle312/cty1ng/pull/51) | M5b |
| P3 (`workflows/merge-bar.md`): late-answer rules still in refs: `create-bot-page.tsx` (`mounted`, `inFlight`), `crop-card.tsx` (`closed`, `lastFile`), and the skill pages' still-on-page check, now one hook (`on-page.ts`, [#78](https://github.com/binhle312/cty1ng/pull/78)). They are not card or dialog rules, so the owner left them out of the 2026-11-04 design; check them against `frontend-conventions.md` §1. The check for the skill pages, done in [#78](https://github.com/binhle312/cty1ng/pull/78): the hook holds one yes or no, and `takesServerText` owns the rule for server text, but the rest of the skill page's state rules are not in one pure module | [#59](https://github.com/binhle312/cty1ng/pull/59) review of `ec8faa7` | When those files next change (owner, 2026-11-04) |
| P3 (`workflows/merge-bar.md`): the Skills page orders that [#78](https://github.com/binhle312/cty1ng/pull/78) leaves open, DQ-070 to DQ-073, DQ-077 and DQ-081: an old Apply and a newer preview, the bar during a Save with text typed back, Discard with a slow refresh, Make active again during a slow refresh, a pick during a Restore, and a second Delete on a return visit | [#78](https://github.com/binhle312/cty1ng/pull/78) review of `274f118` | Audit PR 7 or P3 triage, as the owner decides |
| Found during audit PR 4, in the audit file under "Found during PR 4": pages stay loading after an `offline` event (DQ-088, P2 by the owner on 2026-11-08: fixed in [#84](https://github.com/binhle312/cty1ng/pull/84), merged on 2026-11-08), Esc outside the edit form on the bot page (P3), the cached name limit of the skill Clone (P3), three older items with no test that fails without them (DQ-095: Esc's `contains` and `defaultPrevented` checks, the template's `retry: false`; P3), a live event during a first-load read of the Create form (DQ-107, P3), the wait of Create for its refresh when a read keeps failing (DQ-108, P3), and a longer skeleton when live events come during a failing read (DQ-109, P3), and a test client that `heldAnswer` does not check (DQ-115, P3), and CI failures of `skills.spec.ts` "deleting the last skill" (DQ-116, P3: the test's own `route.fetch()` handler; fixed in [#84](https://github.com/binhle312/cty1ng/pull/84), merged on 2026-11-08) | [#82](https://github.com/binhle312/cty1ng/pull/82) | The owner decides |
| The `db_lock_wait_seconds` histogram (`architecture.md` §9, D29 switch trigger 3); there is no metrics output yet | #48 | M3 (the worker brings concurrent writes) |
| `esbuild` advisory (moderate, dev only, through `drizzle-kit` 0.31.11); no stable fix | #48 | Update `drizzle-kit` when 1.0 is stable (Dependabot) |
| First-run offer of the Guide bot in the app ("Add Guide" in the empty state, so a new owner needs no `make seed`); needs a design round (owner, 2026-11-01, M2 plan decision 15) | [#57](https://github.com/binhle312/cty1ng/pull/57) | M3 spec gap pass |
| Temporary CLI `bots trash` and `bots restore` (M2 spec gap pass, owner 2026-11-01): remove them when the Trash page exists | [#56](https://github.com/binhle312/cty1ng/pull/56) | M5b |
| Rail and bar 2 list scrolling (fade, ˄/˅ buttons, the list ends 24 px above the user panel, `left-bar.md` §1.3, §2): M0 has no lists yet | [#49](https://github.com/binhle312/cty1ng/pull/49) | M5b (projects) and M3 (conversations) |
| More visual snapshots: `themes.md` §5 asks for 8 key screens × 2 themes × 2 modes; M0 has one screen in Command dark | [#49](https://github.com/binhle312/cty1ng/pull/49) | Each slice adds its screens; light and Material with their values |
| Copy slug on the server: today the Clone page tries `-copy-2`, `-copy-3` … after a confirmed `slug_taken` (a skill in Trash keeps its slug). If many collisions make it slow, the server picks the suffix, for example a flag on `POST /skills`; `POST /skill-drafts/{id}/decision` already picks the next free suffix for a bot's slug (`api.md` §2a) (an API change; owner, 2026-10-31; `design/components/skills-page.md`, "Texts added in the M1b build") | [#54](https://github.com/binhle312/cty1ng/pull/54) | When collisions get slow; not planned before M5b |
| Object arguments in the code from before the `max-params` lint rule (104 places in `eslint-suppressions.json`, 2026-11-04): fix them when their module changes, then prune the list | [#59](https://github.com/binhle312/cty1ng/pull/59) | Each slice, for the modules it touches |
| `uuid` advisory GHSA-w5hq-g745-h8pq (moderate, through `typeid-js` 1.2.0, which needs `uuid` ^10). **Accepted risk** (owner, 2026-10-30): the flaw is in v3/v5/v6 with a caller buffer; `typeid-js` uses only `stringify` and `v7`, and our code never calls `uuid`. No override | #48 | Update `typeid-js` when a version allows `uuid` ≥ 11.1.1 |
| Bar 2 on Home keeps its M0 state: `bar-two.tsx` always says "No bots yet" and shows the first-run button, also with bots (`left-bar.md` §3) | Docs audit 2026-11-04 | M3d |
| Test names: invariants 4, 6, 7 and 12 have no `invariant NN:` test (`testing.md`), and no schema test checks every primary key column (`domain-model.md` §1) | Docs audit 2026-11-04 | M3 plan |
| Small built-UI differences: the empty-state slime at 96 px (`bot-avatar.md` sizes), "⚠" on the card health line (`bots-page.md`), header arrows only over the roster (UI-2.9), Create errors on leaving a field, not after Next (`create-bot-page.md` E1, E2) | Docs audit 2026-11-04 | UI review after M3 |

## Slices

| Slice | State | PR | Notes |
| --- | --- | --- | --- |
| M0 | merged | [#46](https://github.com/binhle312/cty1ng/pull/46) (M0a), [#48](https://github.com/binhle312/cty1ng/pull/48) (M0b), [#49](https://github.com/binhle312/cty1ng/pull/49) (M0c), [#50](https://github.com/binhle312/cty1ng/pull/50) (Impeccable snapshot) | Three parts (M0a tooling, M0b backend, M0c frontend), all merged 2026-10-30 |
| M1 | merged | [#51](https://github.com/binhle312/cty1ng/pull/51) (spec gap pass), [#52](https://github.com/binhle312/cty1ng/pull/52) (plan and M1a backend), [#53](https://github.com/binhle312/cty1ng/pull/53) (M1c brief), [#54](https://github.com/binhle312/cty1ng/pull/54) (M1b Skills page), [#55](https://github.com/binhle312/cty1ng/pull/55) (M1c backend maintenance) | Plan approved 2026-10-31 ([plan](plans/M1-skill-hub.md)), split into M1a (backend), M1b (Skills page) and M1c (event pruning, SQLite writer guard), all merged. Design approved: `design/components/skills-page.md` (round 8); D49 accepted. Round 16 moves the page to the bot page layout (agreed, #38) |
| M1c | merged | see M1 | Part of the M1 row; its own row in the plan |
| M2 | merged | [#20](https://github.com/binhle312/cty1ng/pull/20) (spec), [#56](https://github.com/binhle312/cty1ng/pull/56) (spec gap pass), [#57](https://github.com/binhle312/cty1ng/pull/57) (plan, M2a), [#58](https://github.com/binhle312/cty1ng/pull/58) (M2b), [#59](https://github.com/binhle312/cty1ng/pull/59) (M2c) | Plan approved 2026-11-01 ([plan](plans/M2-bots.md)); M2a merged 2026-11-01; M2b merged 2026-11-02; M2c (bot page, upgrade and assign cards) merged 2026-11-04. Agreed: `design/components/bots-page.md`, `create-bot-page.md` (with Clone), `bot-page.md` and the standards (round 9). Usage tab design agreed, its data open (M2 shows its empty state). Spec gap pass answered 2026-11-01 |
| M3 | UI design agreed | [#26](https://github.com/binhle312/cty1ng/pull/26) (spec) | Round 10: `design/components/conversation-page.md`, `composer.md`, `conversation-cards.md` |
| M4 | UI design agreed | [#34](https://github.com/binhle312/cty1ng/pull/34) (spec) | Round 12: `design/components/conversation-page.md` §2 |
| M5 | UI design agreed | [#35](https://github.com/binhle312/cty1ng/pull/35) (spec) | Round 14: `design/components/settings-page.md`, `conversation-page.md` §2.4; key `bot_discussion_enabled` |
| M5b | UI design agreed | [#37](https://github.com/binhle312/cty1ng/pull/37) (spec) | Brief: `tasks/M5b-projects-and-memory.md`. Round 15: `design/components/memory-page.md`, `trash-page.md`, `conversation-page.md` §2.1a; D62, D63 accepted |
| M5c | UI design agreed | [#38](https://github.com/binhle312/cty1ng/pull/38) (spec) | Skills drafted by bots (D41, D64, D65 accepted). Round 16: `design/components/skill-draft-card.md`, `skills-page.md` §2a, §13, §17. Brief not written |
| M5d | not written | [#39](https://github.com/binhle312/cty1ng/pull/39) (spec) | Bots improve their skills from the owner's feedback (D51). D51 amendment 2026-10-27: saved test cases for each skill, approved by the owner |
| M6 | UI design agreed | [#41](https://github.com/binhle312/cty1ng/pull/41) (spec) | Round 17: `design/components/library-page.md`, `library-cards.md` |
| Inbox | not written | | Project inbox (D58, D59) |
| M7 | not started | | |
| M8 | UI design agreed | [#33](https://github.com/binhle312/cty1ng/pull/33) (spec) | Round 11: `design/components/flow-timeline.md`; Timeline only |
| M8b | not written | | Board map in the Flow pane (D30) |
| M8c | proposed | | Project-wide Board, read-only, after M8b (`design/components/left-bar.md` §5) |
| T2 | not written | | Material theme (D30) |
| M9 | not written | | VPS milestone |

States: `not started`, `not written` (no brief yet) or `proposed` → `planning` → `UI design review` → `UI design agreed` → `building` → `in review` → `merged`.
A slice can also be `blocked` (say on what in Notes).

## Done

| Date | What |
| --- | --- |
| 2026-10-21 | Specification: requirements, design sketches, decisions D1–D29, briefs M0–M8 |
| 2026-10-21 | Repository created; spec merged (PRs #1–#5): send states and research notes, security checklist, frontend conventions, `ui-ux-pro-max` skill; D31, D32 accepted |
| 2026-10-21 | Owner review: D6, D11, D13, D33 accepted; D9 accepted with a replaceable transport; D21 accepted with price overrides |
| 2026-10-26 | M5b design round 15: Memory page with Tidy, Trash page with multi-select, Move to project dialog; D62, D63 accepted; M5b brief and API contracts written |
| 2026-10-27 | M5c design round 16: skill draft card, float card for the bots after Approve, Edit on the Skills page, Skills page in the bot page layout; D64, D65 accepted |
| 2026-10-27 | Eval and guardrail review: D51 amendment, saved test cases for each skill (#39); D42 amendment, no price means no request under a cap, and the security review gate for new ways out, with the residual prompt-injection risk accepted by the owner (#40) |
| 2026-10-28 | Pre-coding diagram gate step 1: system overview and component boundaries in Mermaid; D57 path amendment |
| 2026-10-29 | Pre-coding diagram gate step 2: four ERDs by domain and the schema fixes from the owner's review |
| 2026-10-30 | Shell review: keyboard reorder and tile menu on the rail, focus and touch in the header, collapsed user panel tooltip and budget, battery focus, text size rules L1–L3 |
| 2026-10-30 | Removed the prototype references and `porting-guide.md` (owner); its run and handoff lessons moved to `testing.md` §3 |
| 2026-10-30 | M0 merged: tooling (#46), backend (#48), frontend shell (#49), Impeccable design snapshot with its colour check (#50) |
| 2026-10-30 | M1 spec gap pass: 28 gaps answered (skill `row_version`, rename without a version, slug rule, import preview rules, skill limit settings, the guard on skills, URLs, temporary CLI restore); D6 and D36 amended |
| 2026-10-31 | M1 plan approved: split into M1a (backend) and M1b (UI); a `SKILL.md` over 1 MB replaces the 100:1 zip ratio; `GET`/`PATCH /settings` for the skill limits and `trash_days`. M1a built and merged in #52. M1c added: event pruning and the SQLite writer guard, after M1b and before M2 |
| 2026-10-31 | M1b built: the Skills page (list, Skill, Bots and History tabs, new skill and Clone, import, Export card, deprecate and delete) in #54 |
| 2026-10-31 | M1b merged (#54) |
| 2026-10-31 | M1c built in #55: event pruning (`EVENT_RETENTION_DAYS`, `EVENT_PRUNE_INTERVAL_HOURS`), the hub waits for a new notify (no busy loop after a complete prune), one SQLite writer per file in a thread. Cross-review fixes: the gap rule also during a replay, and intervals longer than Node's timer limit |
| 2026-11-01 | M1c merged (#55); M1 is complete |
| 2026-11-01 | M2 plan approved (#57): Gemini joins Anthropic, Guide seed bot, split M2a/M2b/M2c |
| 2026-11-01 | M2a review items approved (#57): migration 0002, upload code, Guide persona and skill, tool lines |
| 2026-11-01 | M2 spec gap pass merged (#56): 30 gaps answered (bot `row_version` and `name_key`, the slug rule (D19 amendment), expected-state checks for pins and the pinned order, effective tool settings, avatar limits and cleanup, the guard on bots, clone and restore exceptions to invariant 6, the Create retry snapshot, bot setting ranges, bot restore and purge events, the Skills page with real bots, Anthropic only, two fake models, seed bots, URLs) |
| 2026-11-01 | M2a merged (#57): bots backend |
| 2026-11-02 | M2b merged (#58): Bots page, header roster, Create bot with Clone |
| 2026-11-04 | M2c merged (#59); M2 is complete |
| 2026-11-04 | Every plan now has a file in `docs/plans/` (owner); the plans up to M2 are copied from their PRs |
| 2026-11-04 | Docs audit ([#61](https://github.com/binhle312/cty1ng/pull/61)): docs matched to the built code and to the current decisions; open questions and code gaps moved to the tables above |
| 2026-11-04 | The `typescript-best-practices` skill is vendored as a project skill ([#68](https://github.com/binhle312/cty1ng/pull/68), owner); `frontend-conventions.md` wins where they differ. The 12 `principle-*` skills have shorter names (owner), and `principle-fix-root-cause` takes the diagnosis steps of the upstream `principle-fix-root-causes` |
| 2026-11-04 | Three pstack principles adapted (owner): new `principle-remove-first` and `principle-script-the-work`; `principle-design-first` takes the redesign rule, and the code design step now also runs for a new requirement that changes an existing design (owner) |
| 2026-11-04 | Automated security review on: the owner added the `ANTHROPIC_API_KEY` secret, and the review also watches the log, avatar and sensitive data guard code. It runs when the owner marks a PR Ready, on Haiku 5.5; PRs open as drafts |
| 2026-11-04 | Docs audit answers ([#65](https://github.com/binhle312/cty1ng/pull/65)): the owner answered all the questions; the specs, decisions and tokens match them, and no feature is built |
| 2026-11-04 | M2 close fixes ([#66](https://github.com/binhle312/cty1ng/pull/66)): strict `/health`, `/stream` and import upload, the missing security tests, DQ-020. The owner dropped DQ-018, DQ-019, DQ-021's remaining gaps, and the change to `sameColour`, `isUnder` and `Pct` (working code with no wrong result) |
| 2026-11-04 | Two flaky e2e tests fixed: `csp.spec.ts` waits for the menu before its Escape, and a local `pnpm e2e` uses 4 workers, so J1 no longer times out on a busy machine |
| 2026-11-05 | Repository audit recorded, with the owner's seven decisions. Rule changes: Trash in another tab takes a skill page's unsaved text, as on the bot page; the touch swipe on the header roster is dropped, and the touchpad and the wheel are the requirement (owner) |
| 2026-11-06 | Audit PR 3, the Skills page, merged in [#78](https://github.com/binhle312/cty1ng/pull/78). Rule change: `takesServerText` is the one rule for when the editor takes server text. Failures after the owner left show as toasts, and late answers move nothing. The new texts wait for the UI review after M3 |
| 2026-11-06 | Principle skill `principle-ask-with-options` merged in [#79](https://github.com/binhle312/cty1ng/pull/79): each question for a person has a real example, options with gain, cost and risk, and a recommendation (owner, 2026-11-06) |
| 2026-11-06 | `principle-ask-with-options` now also requires Simplified Technical English at an 80% target, with a check of the text (owner, 2026-11-06). Merged in [#80](https://github.com/binhle312/cty1ng/pull/80) |
| 2026-11-07 | Audit PR 4, the Bots page, merged in [#82](https://github.com/binhle312/cty1ng/pull/82). Esc on a bot page asks and the question stays. A Clone and the defaults of a new bot read the data as it is now. New process rules (owner): a PR has an edge case table for each changed screen, and a fix record names the general rule and the search of old fixes |
| 2026-11-08 | Audit method added in [#83](https://github.com/binhle312/cty1ng/pull/83), merged on 2026-11-08: an audit has a coverage table, a real browser for browser behaviour, a general rule and a search for each finding, a comparison with old fixes, and a short list of bad conditions. The plan's second audit uses it first |
| 2026-11-08 | DQ-088 fixed in [#84](https://github.com/binhle312/cty1ng/pull/84), merged on 2026-11-08: the app's reads and saves run when the browser says that it is offline, because the app runs on 127.0.0.1. One function, `createQueryClient`, makes the query client for the app and the tests. DQ-117 (owner, 2026-11-08, option A): each step has its own offline test that fails on the old code, and `testing.md` §5 has the rule. DQ-124 (owner, 2026-11-08, option A): lint keeps every read and save on the one default, and the e2e tests are a sample. DQ-125 (owner, 2026-11-08, option A): before each push, the records are checked against the commit (`docs/workflows/pull-request.md`) |
| 2026-11-08 | `principle-ask-with-options` asks about one decision in each question, and a question asked again gives its example and options again (owner, 2026-11-08, after the DQ-117 question mixed three decisions). Merged in [#85](https://github.com/binhle312/cty1ng/pull/85) on 2026-11-08 |
| 2026-11-09 | Audit PR 5, tests only, draft [#86](https://github.com/binhle312/cty1ng/pull/86): real tests for audit rows 8 to 13 (invariant 21, API keys in the answers, the stream frames and the log (the stream headers are an open gap, DQ-154), the guard on a bot's name and description, CL2, the pointer over the header avatars, the wheel on the roster). Each new test fails on a break of its rule, and the old tests pass on it. No production code changes, only one comment. The reviews found DQ-139 to DQ-163 ([delivery-quality.md](delivery-quality.md)). The owner chose a break list with a runner (`pnpm check:breaks`), its scope and one claim per test name (`testing.md` §5); the header docs say "over the bot avatars"; records follow [one home for each fact](workflows/pull-request.md#one-home-for-each-fact) |
