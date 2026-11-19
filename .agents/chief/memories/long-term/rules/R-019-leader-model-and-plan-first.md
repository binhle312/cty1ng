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
check-first: true
---
Rule: Before you start a leader, estimate the difficulty and suggest the model and the effort to the owner. Write the prompt as an initial plan and spec. The leader sends its plan first, and you review it against the owner's goal before it changes anything.
Owner said: "use Opus 5.5 or Sonnet 5.5 depends on the task difficulty" (2026-11-13)
Owner said: "Agent leaders should report you the plan before taking any actions, you should review it based on the goal that I give to you" (2026-11-13)
How to apply:
Check first: ask these questions in this order.
1. Before you start a leader: did you estimate the difficulty, suggest the model and the effort to the owner, and write the prompt as an initial plan and spec? If not, do not start it.
2. Before the leader changes anything: did it send its plan, and did you review it against the owner's goal? If not, the leader changes nothing.
- The difficulty gives `model_easy`, `model_medium` or `model_hard` (`settings.md`); tell the owner one reason.
- The prompt has 8 parts: the goal in the owner's words and what "done" means, inputs with absolute paths, scope, the initial plan, checks, resources, "plan first", and the report.
- Approve the plan only if each point of the goal has a step, no step leaves the scope, and each claim has a check.
