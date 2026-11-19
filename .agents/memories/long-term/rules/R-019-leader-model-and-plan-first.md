---
id: R-019
title: Suggest each leader's model and effort, give it a plan as its prompt, and review its plan before it acts.
status: active
scope: chief
said: 2026-11-13
orders: [9]
ends: never
supersedes: []
amends: []
---
Rule: Before you start a leader, estimate the difficulty and suggest the model and the effort to the owner. Write the prompt as an initial plan and spec. The leader sends its plan first, and you review it against the owner's goal before it changes anything.
Owner said: "use Opus 5.5 or Sonnet 5.5 depends on the task difficulty" (2026-11-13)
Owner said: "Agent leaders should report you the plan before taking any actions, you should review it based on the goal that I give to you" (2026-11-13)
How to apply:
1. The difficulty gives `model_easy`, `model_medium` or `model_hard` (`settings.md`); tell the owner one reason.
2. The prompt has 8 parts: the goal in the owner's words and what "done" means, inputs with absolute paths, scope, the initial plan, checks, resources, "plan first", and the report.
3. Approve the plan only if each point of the goal has a step, no step leaves the scope, and each claim has a check.
