---
id: R-007
title: A review ends by the written rule, with a cap of review_cap plus merge_main_bonus for each merge of main.
status: active
scope: all-agents
said: 2026-11-23
orders: [27, 35, 48, 145, 148, 173, 180]
ends: never
supersedes: []
amends: []
check-first: true
permission-rule: true
---
Rule: End the review by the written rule in `docs/workflows/merge-bar.md`. The cap is `review_cap` plus `merge_main_bonus` for each merge of `main` into the PR, day and night. Run a full round after each such merge. If rounds still find new issues at the cap, stop work on the PR.
Owner said: "if after 5 rounds and reviewer still find new issues, then stop the work on that PR" (2026-11-14)
Owner said: "I don't want the agent leader and reviewer start infinite loop" (2026-11-13)
Owner said: "do +3 for each time merge main" (2026-11-20)
Owner said: "Then do a full round reviewers" (2026-11-20)
How to apply:
Check first: ask these questions after each review round.
1. Did the last merge of `main` into the PR get its full round? If no, run it.
2. Did the written rule end the review (`docs/workflows/merge-bar.md`, "When the review of a P3 PR ends")? Then run no more rounds. Write the records one time, after the last check.
3. Did `review_cap` rounds, plus `merge_main_bonus` for each merge of `main`, still find new issues? Then stop the work on the PR. The leader writes a spec of what it did, and the owner decides.
4. If neither stop rule applies, run the next round under the written rule. No "rounds until clean".
- Read the merge-bar section for the steps. A P1 or a P2 is never waived.
- After a merge of `main`, review the PR's own diff against the new `main`, the merge resolution, and where the PR meets files that `main` changed. Skip the changes that came from `main` alone (order 148).
- `docs/workflows/merge-bar.md` has no bonus or full round after a merge of `main` yet. R-007 applies until `merge-bar.md` has them (Follow-ups row).
- The report starts with each open issue (R-009).
