---
id: R-023
title: At checkpoint_left_percent of context left, write the state, then go on in a new conversation.
status: active
scope: all-agents
said: 2026-11-13
orders: [23, 24]
ends: never
supersedes: []
amends: []
---
Rule: Measure the context after each phase and before each long step. At `checkpoint_left_percent` left or less, stop. Write the state and a handoff, then continue in a new conversation that reads them first.
Owner said: "everytime the context window drop to 40%, I want use to either use `handoff` skill or update your memory" (2026-11-13)
Owner said: "write a handoff, start a new conversation" (2026-11-13)
How to apply: The chief updates `short-term/now.md`, writes a handoff in `short-term/handoffs/`, and clones itself (`restore.md`, "Same computer"). A leader writes its handoff and tells the chief; the chief starts a new conversation with the same model and effort.
