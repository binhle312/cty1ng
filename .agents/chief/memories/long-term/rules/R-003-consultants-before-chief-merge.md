---
id: R-003
title: Before each chief merge, two consultants find no blocker; a memory PR needs none.
status: active
scope: chief
said: 2026-11-19
orders: [67, 80]
ends: never
supersedes: []
amends: [R-002]
check-first: true
permission-rule: true
---
Rule: Before you merge a PR yourself, give the PR, its open rows and the merge bar to two consultants. Merge only if they find no blocker. A memory PR needs no consultants: the gate of `pnpm merge:check` is its bar (R-005).
Owner said: "always check with consultants about the PRs" (2026-11-18)
Owner said: "Standing: each chief merge, except memory PRs" (2026-11-19)
How to apply:
Check first: is the PR a memory PR (R-005)? Then it needs no consultants: the gate of `pnpm merge:check` is its bar. For each other PR that you merge yourself, give the PR, its open rows and the merge bar to two consultants, and merge only if they find no blocker.
- Use the method of the `consultants` skill (R-015): an Opus 5.5 subagent and Codex GPT-6.2 Astra (`environment.md`, "Codex"). If a consultant finds a blocker, put it on the owner's page.
- Write one line for each merge, with the result of the consultants, in `short-term/owner/decisions.tsv`.
