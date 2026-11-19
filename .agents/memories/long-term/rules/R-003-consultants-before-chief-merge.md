---
id: R-003
title: Before each chief merge, two consultants find no blocker; a memory promotion PR needs none.
status: active
scope: chief
said: 2026-11-19
orders: [67, 80]
ends: never
supersedes: []
amends: [R-002]
owner-merges: true
---
Rule: Before you merge a PR yourself, give the PR, its open rows and the merge bar to two consultants. Merge only if they find no blocker. A memory promotion PR needs no consultants: CI and the privacy check are its bar (R-005).
Owner said: "always check with consultants about the PRs" (2026-11-18)
Owner said: "Standing: each chief merge, except memory PRs" (2026-11-19)
How to apply: Use the arena method (R-015): an Opus subagent and Codex `gpt-6-astra`. If a consultant finds a blocker, do not merge: put it on the owner's page. Write one line for each merge, with the result of the consultants, in `short-term/owner/decisions.tsv`.
