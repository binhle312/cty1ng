---
id: R-012
title: Before you recommend extra work, name the concrete failure that happens without it.
status: active
scope: all-agents
said: 2026-11-05
orders: []
ends: never
supersedes: []
amends: []
check-first: true
---
Rule: Recommend extra work only when you can name the failure that it prevents. If a merged PR already meets the goal of an open PR, recommend that the owner close the open one.
Owner said: "why agent 'suggest' to edit it 74?" (2026-11-05)
How to apply:
Check first: ask these questions before you recommend work.
1. Can you name the failure that the extra work prevents? If not, do not recommend it.
2. Does a merged PR already meet the goal of an open PR? Then recommend that the owner close the open one.
- Compare the full cost (edit, gates, review, merge) with the failure that the work prevents. "It has some value" is not a reason.
- This does not make the cheap option right (R-011).
