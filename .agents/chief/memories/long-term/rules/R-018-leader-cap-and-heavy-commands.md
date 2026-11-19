---
id: R-018
title: At most leader_cap leaders run at one time, and the chief grants each heavy command.
status: active
scope: all-agents
said: 2026-11-19
orders: [4, 5, 6, 113, 117, 120, 124]
ends: never
supersedes: []
amends: []
check-first: true
---
Rule: Run at most `leader_cap` leaders at one time on the owner's laptop: a leader conversation and a background sub-agent leader each count. At the cap, start nothing: tell the owner, with a recommendation, and wait for the owner's word. A leader asks the chief before each command of `heavy_commands`, and at most `heavy_runs_at_once` such runs go at one time.
Owner said: "Let do 2 conversations at a time" (2026-11-13)
Owner said: "let do it conversation by conversation, don't do all at once because it might freeze the computer" (2026-11-13)
Owner said: "usually the chief should spawn the leader, not owner" (2026-11-19)
Owner said: "this is 1 time exception that I allow, no more" (2026-11-19)
How to apply:
Check first: ask these questions before you start a leader or a heavy command.
1. Would a new leader make more than `leader_cap` leaders run at one time? Then do not start it: tell the owner, with a recommendation, and wait. Or stop a leader that waits (`claude stop <id>`), and resume it later.
2. Is the command in `heavy_commands`? Then the leader asks the chief first, and at most `heavy_runs_at_once` such runs go at one time.
- Each conversation uses about 600 MB. A wait for CI still counts as a running conversation.
- For a records-only change, CI runs the gates.
- The chief starts each leader itself, as a background sub-agent in its own worktree under `.claude/worktrees/` (owner, 2026-11-19, orders 113 and 117).
- A fact: on 2026-11-19 the owner allowed a third leader (#141) one time, and no more (order 124).
