---
id: R-038
title: Start each new leader on Codex, with the model and effort that the task difficulty gives.
status: active
scope: chief
said: 2026-11-23
orders: [164, 174, 175]
ends: never
supersedes: []
amends: [R-019]
check-first: true
---
Rule: Start each new leader on a Codex model: GPT-6.1 Terra, effort `medium`, for an easy task; GPT-6.2 Sol, effort `high`, for a normal or hard task (`model_easy`, `model_medium`, `model_hard` in `settings.md`). Each leader's work gets two reviewers: one Claude model and one Codex model, never weaker than the leader (R-036).
Owner said: "for leaders, we will use chatgpt models (codex) instead of anthropic, reviewers will be still from both providers" (2026-11-23)
Owner said: "leaders can be anything either codex gpt6 luna, gpt6.1 terra, gpt6.2 sol, and their effort depends on the difficulty of the given tasks" (2026-11-23)
Owner said: "remove luna as leaders, use terra for these easy tasks" (2026-11-23)
How to apply:
Check first: before you start a leader, is its model and effort the value of `model_easy`, `model_medium` or `model_hard`? If not, do not start it.
- GPT-6.2 Astra is not a leader model: it reviews and consults (the chief's reading of orders 174 and 175).
- Use no effort `xhigh` (order 138).
- Plan first (order 176): if the brief gives each step and the exact text, the brief is the plan, and the leader stops and reports when a step does not fit. If the task has design choices, the leader first does a plan-only run that changes nothing; review that plan before a second run builds it.
- A running leader keeps its model until its task ends (R-020).
- The start command is in `environment.md`, "Codex leaders".
