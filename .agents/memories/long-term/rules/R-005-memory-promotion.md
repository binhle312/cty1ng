---
id: R-005
title: Promote short-term facts in a daily PR that the chief merges after CI and the privacy check.
status: active
scope: chief
said: 2026-11-19
orders: [72, 78, 80]
ends: never
supersedes: []
amends: []
check-first: true
owner-merges: true
---
Rule: Make one promotion PR each day or night (`../../README.md`, "Promote"). It changes only `long-term/`. Merge it when CI is green and the privacy check passes. A new rule about privacy gets a promotion PR on the same day. A new or changed rule about merges, approvals or permissions has `owner-merges: true` and its own PR on the same day. The owner merges it, and a change of the memory README, `identity.md` or the check.
Owner said: "#1 will be included in git #2 won't" (2026-11-19)
Owner said: "Daily PR, the chief merges" (2026-11-19)
How to apply:
Check first: ask these questions in this order before you merge a promotion PR.
1. Does the PR add or change a rule about merges, approvals or permissions, `identity.md`, the memory README or the memory check? Then it is not a promotion PR: the rule has `owner-merges: true`, it gets its own PR on the same day, and the owner merges that PR. Stop.
2. Does the PR change a file outside `long-term/`? Then it is not a promotion PR. Stop.
3. Is CI green, and does the privacy check pass? Then merge it. If not, do not merge.
- Short-term memory wins until the promotion merges.
- Before you push, run `pnpm check:memory --local`, then read the whole diff for private facts yourself.
