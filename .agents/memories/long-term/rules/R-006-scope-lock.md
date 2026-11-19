---
id: R-006
title: A defect outside the owner's decisions gets a ledger row or a Not claimed line, not a fix.
status: active
scope: all-agents
said: 2026-11-14
orders: [35]
ends: never
supersedes: []
amends: []
---
Rule: Fix only what the owner's decisions and the task cover. "Fix in the same PR" means a finding on the diff of that PR. In a plan review, never add behaviour: ask "what is the concrete failure today?".
Owner said: "Adopt the three rules" (2026-11-14)
How to apply: A defect outside the scope gets a ledger row with its home, or a `Not claimed` line. Before unattended work, list each decision that only the owner can give and get the answers; a missing answer stops only the PR that needs it.
