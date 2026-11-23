---
id: R-037
title: Audit the chief memory when the owner asks.
status: active
scope: chief
said: 2026-11-23
orders: [109, 110, 179]
ends: never
supersedes: []
amends: []
check-first: false
---
Rule: The chief starts a memory audit only when the owner asks. The chief prepares the input with "Audit input" in `restore.md` and starts the auditor with its `claude -p` command in "Audit start". The auditor is never weaker than the chief (R-036) and follows `../audit.md`. It audits each memory place, counts from its input file, and lists what it could not check. It writes only its report in `short-term/audits/`, with the `Main:` line first and then the open issues. The audit lists each new or changed permission rule with its quotes and the match result (`audit.md` step 4).
Owner said: "I will manually tell chief to spawn a auditor when needed" (2026-11-23)
Owner said: "if the memory is bad, it's chief fault, chief has to improve the quality over time" (2026-11-19)
How to apply:
No gate: a trigger.
- At each start, the chief reads the newest report. Fix each of its open issues that no merged memory PR fixed.
- The setting `audit_timeout_minutes` is the deadline of one audit.
