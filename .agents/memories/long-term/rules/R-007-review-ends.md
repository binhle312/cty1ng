---
id: R-007
title: A review ends by the written rule, and the work on a PR stops after review_cap rounds.
status: active
scope: all-agents
said: 2026-11-14
orders: [27, 35, 48]
ends: never
supersedes: []
amends: []
owner-merges: true
---
Rule: No "rounds until clean". The written rule ends a review: `docs/workflows/merge-bar.md`, "When the review of a P3 PR ends". If `review_cap` rounds still find new issues, stop the work on the PR: the leader writes a spec of what it did, and the owner decides. Write the records one time, after the last check.
Owner said: "if after 5 rounds and reviewer still find new issues, then stop the work on that PR" (2026-11-14)
Owner said: "I don't want the agent leader and reviewer start infinite loop" (2026-11-13)
How to apply: Read the merge-bar section for the steps. A P1 or a P2 is never waived. The report starts with each open issue (R-009).
