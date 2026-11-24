# Plans

This folder keeps every plan of a slice: what the owner and the builder agreed before the build
(owner, 2026-11-04). [The planning workflow](../workflows/planning.md#plan) says what a
plan holds and when the owner approves it.

A plan is a record, not spec. If a plan and an owning document differ, the owning document wins.

## Rules

1. Name the file `<slice>-<name>.md`, with the slice and name of its brief in `docs/tasks/`.
   A plan for one part uses the name of the part, for example `M3a-storage-and-queue.md`.
   A plan for one issue uses the id of the issue, for example `dq-180-clone-draft.md`.
2. Start the file with the title, then the lines `Brief:`, `Checkpoint:` and `Approval:`.
   `Approval:` says `waiting` until the owner approves the plan.
3. Commit the plan to the draft PR before any code. The first comment of the PR links to the file.
4. Commit each revision to the same file. Git history keeps the old revisions.
5. When the owner approves, write the date, the revision and the owner's decisions in the file.
   Do this before the first build commit.
6. After the approval, a change of the design or a new owner decision needs its approval. Change
   the design text in place, and add a line under `Approval:` with the date, the revision and who
   approved it. A correction that changes no design and no decision, such as a typo, a link or a
   claim made smaller (not a criterion: `AGENTS.md` §9), needs no approval. A new plan in the same
   slice, such as a redesign after a review, gets its own file.
   A plan holds no build facts: the red runs, the test names and counts as built, the proof logs
   and commands, and each difference between the plan and the build. They go only in the PR
   description ([pull-request.md](../workflows/pull-request.md#one-home-for-each-fact)). A
   difference that changes the design or an owner decision is a change of the plan, and it needs
   the approval first.
7. Put a change in behaviour in the owning document, in the same PR.
8. Add the file to the table below in the same commit. `pnpm check:index` fails if the table and
   the folder differ.

Plans written before rule 6 (#133), also the plans of PRs that were open then, can have a section
of build facts, such as "What the build changed" or "Build notes". That section is history, and
nobody keeps it up to date.

## Plans

Plans up to M2 started as PR comments or PR descriptions. The header of each file names its source.

| File | Slice | Approval record |
| --- | --- | --- |
| `M0-skeleton.md` | M0, first attempt | Superseded: the owner closed #10 on 2026-10-29 |
| `M0a-tooling-and-ci.md` | M0a | No approval line; owner's decision of 2026-10-30 |
| `M0b-backend-core.md` | M0b | Owner's review of 2026-10-30, revision 1 |
| `M0c-frontend-shell.md` | M0c | Summary only: decisions A-H as #49 records them |
| `M1-skill-hub.md` | M1a, M1b | Approved 2026-10-31 |
| `M1c-backend-maintenance.md` | M1c | No approval line; owner's review of 2026-10-31 |
| `M2-bots.md` | M2a, M2b, M2c | Approved 2026-11-01, revision 4 |
| `M2c-state-modules.md` | M2c, two plans made during the review | Summary only: owner-approved 2026-11-04, as #59 records it |
| `audit-pr6-six-tabs.md` | Audit PR 6 (row 14, six tabs) | Approved 2026-11-10, revision 1 |
| `p3-migration-foreign-keys.md` | P3 list PR 6 (item 22, the migration runner) | Approved 2026-11-13, revision 3 |
| `p3-shell-error-boundary.md` | P3 list PR 16 (items 65 and 66, errors that keep the shell) | Accepted by the owner, 2026-11-15 ("P-16: approve"), revision 2 |
| `dq-180-clone-draft.md` | DQ-180, the Clone draft (before audit PR 6) | Approved 2026-11-10 |
| `dq-198-closed-dialog-read.md` | DQ-198, a closed dialog and the read of all data (after audit PR 6) | Owner, 2026-11-10 |
| `p3-backend-data-purge.md` | P3 list PR 9 (items 27 to 31, the docs of item 37) | Lead agent, 2026-11-15; accepted by the owner, 2026-11-15 |
| `p3-security-headers.md` | P3 PR 11, security headers (items 35, 36) | Lead agent, 2026-11-15, revision 1; accepted by the owner, 2026-11-15 |
| `p3-skills-pages-small.md` | P3 list PR 15, Skills pages small fixes (items 57 to 64) | Lead agent, 2026-11-15, under the owner's order of 2026-11-14; accepted by the owner, 2026-11-15 |
| `p3-bots-pages.md` | P3 PR E: items 40 to 46 (Bots pages, small fixes; bot page Esc) | Lead agent, 2026-11-15, revision 1; accepted by the owner, 2026-11-15 |
| `p3-unknown-keys-field.md` | DQ-385, a real `field` for unknown keys in a body | Lead agent, 2026-11-18, revision 1, against the owner's answer q4 Q4 A; owner review pending |
| `p3-frontend-cleanup.md` | P3 PR K (list PR 21, item 68): frontend cleanup with the same texts and screens | Lead agent, 2026-11-15, under the owner's order of 2026-11-14; accepted by the owner, 2026-11-15 |
| `p3-tests-only.md` | P3 PR 18, tests only (items 70, 71, 72) | Lead agent, 2026-11-15, under the owner's order of 2026-11-14; accepted by the owner, 2026-11-15 |
| `p3-tooling-gates.md` | P3 list PR 19, tooling gates (items 73 to 76) | Lead agent, 2026-11-15; accepted by the owner, 2026-11-15 |
| `p3-skills-page-orders.md` | P3 list PR 14, Skills page orders (items 51 to 56) | Accepted by the owner, 2026-11-15 ("P-14: approve"), revision 2; Q1 takes the plan's answer (lead agent's reading, owner review pending); Q2 approved by the owner, 2026-11-18 (UI-4: A) |
| `p3-relative-time.md` | P3 list PR 17 (item 67): relative times that update | Accepted by the owner, 2026-11-15 (P-17: approve), revision 3; Q1 and Q2 by the lead agent's reading |
| `p3-limits-strict-inputs.md` | P3 PR C: list PR 7 (diff and changelog limits) and list PR 10 (API strict inputs) | Lead agent, 2026-11-15, revision 1; accepted by the owner, 2026-11-15 |
| `p3-ci-break-static.md` | DQ-517 D and DQ-448 B: a CI check of the break list rules | Plan OK by the lead agent, 2026-11-18, against the owner's answers DQ-517 D and DQ-448 B; revision 1 |
| `p3-runner-tmpdir.md` | DQ-618: the break runner keeps the local changes when TMPDIR is inside a git repository | Plan OK by the lead agent, 2026-11-18, against the owner's answer q3 Q1 A, revision 1; owner review pending |
| `p3-check-status.md` | DQ-571: a CI check that each merged PR has its Done row in `docs/status.md` | Plan OK by the lead agent, 2026-11-18, against the owner's answer q2 Q2 A, revision 1; owner review pending |
| `p3-plans-design-only.md` | Owner's answer q2 Q1 A: plans hold the design and the owner's decisions; build facts go only in the PR description | Lead agent, 2026-11-18, against the owner's answer q2 Q1 A, revision 2; owner review pending |
| `p3-small-owner-answers.md` | Small fixes from the owner's answers of 2026-11-18 (DQ-442, DQ-500, DQ-485, DQ-411, item 61, #123, DQ-426) | UI texts and scope: the owner's answers of 2026-11-18; plan OK by the lead agent, 2026-11-18; item 8 approved by the owner, 2026-11-18 (Q2 A) |
| `p3-breaks-static-test-time.md` | The pnpm links test of the static break check times out in the full suite (#128's test, found by the gates of #134 and #135) | Plan OK by the lead agent, 2026-11-18, revision 1; revision 2 (`lib` and the break list) after the round 1 review; owner review pending |
| `p3-break-list-decision.md` | Redesign of DQ-782 in #136: CI checks the break-list decision of each PR that adds or changes a test | Owner, 2026-11-18, q5 Q1 A (the design); plan review: lead agent, revision 1; owner review pending |
| `p3-flaky-bots-drop.md` | The flaky e2e test of the pinned card drop line (`bots.spec.ts:101`, CI run 44228267962) | Plan OK by the lead agent, 2026-11-18 (owner rule: fix the flaky test at its cause), revision 3; owner review pending |
| `p3-guard-speed-test.md` | DQ-455, the 1 MB line test of the guard | Lead agent, 2026-11-18, under the owner's order of 2026-11-14; owner review pending |
| `p3-timed-tests.md` | DQ-805, the redesign of timed tests (owner's q5 Q5 A), built in #137 | Owner, 2026-11-18, q5 Q5 A (the design); plan review: lead agent; owner review pending |
| `p3-clock-one-timer.md` | DQ-537, a check that the app keeps one clock timer | Lead agent, 2026-11-18, against the owner's answer q5 Q4 A; owner review pending |
| `one-home-status-check.md` | F4 of #151 round 1: a check for typed measures in `docs/status.md`, and the rule "one home" in `AGENTS.md` §10 (owner, 2026-11-24, Q1 A and Q3 A) | Owner, 2026-11-24, revisions 1 to 4 |
| `ledger-split.md` | The owner's answers Q1 A and Q2 C of #151: §2 to §4 and the prevention actions of `docs/delivery-quality.md` move to files of their own | Owner, 2026-11-24, revisions 1 to 3 |
| `p3-records-counts.md` | Owner's answers q4 Q3 A and Q6 A: one home for record facts; a records script writes the counts | Plan OK by the lead agent, 2026-11-18, against the owner's answers q4 Q3 A and Q6 A, revision 5; revision 6: owner, 2026-11-19, morning Q4 A, plan OK by the lead agent; owner review pending |

If the task names a plan, open it. Otherwise, find the slice in [status.md](../status.md), then open its plan.
For current behaviour, read the owning documents.
