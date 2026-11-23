---
id: R-037
title: Audit the chief memory when the owner asks.
status: active
scope: chief
said: 2026-11-19
orders: [108, 109, 110, 179]
ends: never
supersedes: []
amends: []
check-first: false
---
Rule: The chief starts a memory audit only when the owner asks. The auditor is one read-only subagent, never weaker than the chief (R-036), with `../audit.md` as its checklist; the chief makes its input file first with the commands in `restore.md`, "Audit input". The audit writes only its report in `short-term/audits/`: open issues first. The chief reads the newest report at each start and fixes each issue in a memory PR.
Owner said: "No cronline need for now, I will manually tell chief to spawn a auditor when needed" (2026-11-23)
Owner said: "if the memory is bad, it's chief fault, chief has to improve the quality over time" (2026-11-19)
How to apply:
No gate: a trigger.
- The audit of 2026-11-23 is the model: it audits each memory place, counts from its input file, and lists what it could not check.
- The setting `audit_timeout_minutes` is the deadline of one audit.
