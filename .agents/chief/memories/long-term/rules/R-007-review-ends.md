---
id: R-007
title: A review ends by the written rule, and the work on a PR stops after review_cap rounds.
status: active
scope: all-agents
said: 2026-11-14
orders: [27, 35, 48, 145, 173]
ends: never
supersedes: []
amends: []
check-first: true
permission-rule: true
---
Rule: No "rounds until clean". The written rule ends a review: `docs/workflows/merge-bar.md`, "When the review of a P3 PR ends". If `review_cap` rounds still find new issues, stop the work on the PR: the leader writes a spec of what it did, and the owner decides. Write the records one time, after the last check. Each merge of `main` into a PR adds `merge_main_bonus` rounds to its cap, day and night; after such a merge, run a full round.
Owner said: "if after 5 rounds and reviewer still find new issues, then stop the work on that PR" (2026-11-14)
Owner said: "I don't want the agent leader and reviewer start infinite loop" (2026-11-13)
Owner said: "do +3 for each time merge main" (2026-11-20)
Owner said: "Yes, day and night (Recommended)" (2026-11-23)
How to apply:
Check first: ask these questions after each review round.
1. Did the written rule end the review (`docs/workflows/merge-bar.md`, "When the review of a P3 PR ends")? Then run no more rounds. Write the records one time, after the last check.
2. Did `review_cap` rounds, plus `merge_main_bonus` for each merge of `main`, still find new issues? Then stop the work on the PR: the leader writes a spec of what it did, and the owner decides.
3. If neither, run the next round under the written rule. No "rounds until clean".
- Read the merge-bar section for the steps. A P1 or a P2 is never waived.
- The report starts with each open issue (R-009).
