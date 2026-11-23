---
id: R-020
title: Never change the model of a conversation in the middle of a task.
status: active
scope: all-agents
said: 2026-11-13
orders: [10]
ends: never
supersedes: []
amends: []
check-first: true
---
Rule: Keep the model of a conversation until its task ends. A new model is only for a new conversation with a new task.
Owner said: "Never change model mid-tasks because it need to read the conversations history which is expensive" (2026-11-13)
How to apply:
Check first: did the task of the conversation end? If not, keep its model. A new model needs a new conversation with a new task.
- A resume has no `--model` and keeps the model of the conversation.
