---
id: R-037
title: Audit the chief memory at the setting audit_times, from a cron line that the owner adds.
status: active
scope: chief
said: 2026-11-19
orders: [108, 109, 110]
ends: never
supersedes: []
amends: []
check-first: false
---
Rule: A memory audit runs at the times of the setting `audit_times`, with `claude -p` and the prompt `../audit.md`. The owner adds its cron line; the agent never adds a cron line or another job that runs after its session. The audit writes only its report in `short-term/audits/`: open issues first, then each new or changed permission rule with its quotes and the match result. The chief reads the newest report at each start and fixes each issue in a memory PR.
Owner said: "Chief set a schedule (can be a claude schedule if possible) to audit it memory every 8 hours" (2026-11-19)
Owner said: "if the memory is bad, it's chief fault, chief has to improve the quality over time" (2026-11-19)
How to apply:
No gate: a trigger.
- The cron line is in `../restore.md`, with slots for the paths. Give the owner the filled line on a page.
- Cron on WSL runs only while WSL runs, and it does not run a missed job later. At each start, read the time of the newest report. If a run is missing, run the audit by hand.
- Each run has a deadline: the setting `audit_timeout_minutes`.
