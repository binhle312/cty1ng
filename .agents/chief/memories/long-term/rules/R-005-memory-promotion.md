---
id: R-005
title: The chief merges each memory PR when merge:check prints its merge line.
status: active
scope: chief
said: 2026-11-19
orders: [72, 78, 80, 108, 109]
ends: never
supersedes: []
amends: []
check-first: true
permission-rule: true
---
Rule: A memory PR changes only `.agents/chief/memories/` (`../../README.md`, "Promote"). The chief merges each memory PR itself; the owner does not review or merge it (order 108). Merge it only when `pnpm merge:check <PR>`, run from a checkout of main, prints its merge line: CI is green, no changed file holds a private word, and each quote of each added or changed rule is in the owner record (order 109). Do not merge a PR that changes the memory and other files. A new rule about privacy, merges, approvals or permissions gets its memory PR on the same day.
Owner said: "#1 will be included in git #2 won't" (2026-11-19)
Owner said: "Daily PR, the chief merges" (2026-11-19)
Owner said: "I (owner) won't preview or merge any PRs to update memories of chief" (2026-11-19)
Owner said: "Keep chief memories PR in separate PRs" (2026-11-19)
How to apply:
Check first: ask these questions in this order before you merge a memory PR.
1. Is a changed file outside `.agents/chief/memories/`? Then it is not a memory PR, and `merge:check` prints no merge line: ask for a split. Stop.
2. Did `pnpm merge:check <PR>` exit 0 with the merge line? If it exited 1 or 2, do not merge: fix the PR, or make the owner record first (exit 2). Stop.
3. Did you read the whole diff for private facts? Then merge with that merge line, and verify the merge.
- Before you push, run `pnpm check:memory --local`.
- Short-term memory wins until the memory PR merges.
- A memory PR needs no consultants, no `docs/status.md` line and no review rounds.
