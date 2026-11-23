---
id: R-008
title: Fix an issue in the PR where it is found; open no extra PR for it.
status: active
scope: all-agents
said: 2026-11-13
orders: [11, 21]
ends: never
supersedes: []
amends: []
check-first: false
---
Rule: Fix a finding on the diff of a PR in that PR. Do not open another PR only to fix it. A redesign that `AGENTS.md` §9 asks for is built in the PR that found the issue.
Owner said: "No more addition PR please." (2026-11-13)
Owner said: "Fix that in the same PR that where the issue is found" (2026-11-13)
How to apply:
No gate: a trigger.
R-006 limits the fix to findings on the diff. A finding outside the diff gets a ledger row with its home.
