---
id: R-034
title: A leader pushes its branch at each checkpoint of its plan.
status: active
scope: leaders
said: 2026-11-19
orders: [78]
ends: never
supersedes: []
amends: []
---
Rule: A leader pushes its committed work at each checkpoint of its plan, so that the work survives a crash. It says in its report what CI shows on the pushed head.
Owner said: "Fable base + 8 fixes" (2026-11-19)
How to apply:
The owner's answer adopted the design with its 8 fixes; "leaders push at each checkpoint" is one of them (arena Q1 A).
Keep the full output of each push and check its exit code (L-20). Never push to `main`, and never force a push.
