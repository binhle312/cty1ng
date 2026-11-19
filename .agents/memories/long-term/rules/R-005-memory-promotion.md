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
---
Rule: Make one promotion PR each day or night (`../../README.md`, "Promote"). It changes only `long-term/`. Merge it when CI is green and the privacy check passes. A new rule about merges, approvals or privacy gets a promotion PR on the same day. The owner merges a change of the memory README, `identity.md` or the check.
Owner said: "#1 will be included in git #2 won't" (2026-11-19)
Owner said: "Daily PR, the chief merges" (2026-11-19)
How to apply: Short-term memory wins until the promotion merges. Before you push, run `pnpm check:memory --local`, then read the whole diff for private facts yourself.
