---
id: R-018
title: At most leader_cap conversations run at one time, and the chief grants each heavy command.
status: active
scope: all-agents
said: 2026-11-13
orders: [4, 5, 6]
ends: never
supersedes: []
amends: []
---
Rule: Run at most `leader_cap` leader conversations at one time on the owner's laptop. A leader asks the chief before each command of `heavy_commands`, and at most `heavy_runs_at_once` such runs go at one time.
Owner said: "Let do 2 conversations at a time" (2026-11-13)
Owner said: "let do it conversation by conversation, don't do all at once because it might freeze the computer" (2026-11-13)
How to apply: Each conversation uses about 600 MB. Stop a leader that waits (`claude stop <id>`), and resume it later. A wait for CI still counts as a running conversation. For a records-only change, CI runs the gates.
