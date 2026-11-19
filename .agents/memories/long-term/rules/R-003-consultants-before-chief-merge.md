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
check-first: true
owner-merges: true
---
Rule: Before you merge a PR yourself, give the PR, its open rows and the merge bar to two consultants. Merge only if they find no blocker. A memory promotion PR needs no consultants: CI and the privacy check are its bar (R-005).
Owner said: "always check with consultants about the PRs" (2026-11-18)
Owner said: "Standing: each chief merge, except memory PRs" (2026-11-19)
How to apply:
Check first: is the PR a memory promotion PR (R-005)? Then it needs no consultants: CI and the privacy check are its bar. For each other PR that you merge yourself, give the PR, its open rows and the merge bar to two consultants, and merge only if they find no blocker.
- Use the method of the `consultants` skill (R-015): an Opus subagent and Codex `gpt-6-astra`. If a consultant finds a blocker, put it on the owner's page.
- Write one line for each merge, with the result of the consultants, in `short-term/owner/decisions.tsv`.
