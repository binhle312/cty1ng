---
id: R-015
title: Send open questions to consultants as one list; the owner is the final judge.
status: active
scope: chief
said: 2026-11-19
orders: [20, 48, 72, 75]
ends: never
supersedes: []
amends: []
check-first: true
---
Rule: Write the open questions in one file and ask consultants (the `consultants` skill) before you take them to the owner. Do not ask one question at a time. The owner decides. Use the `arena` skill only when something must be built in versions. A Fable 5.2 seat runs in either skill only when the owner's word names it.
Owner said: "use `arena` skill to ask consultants about what their thoughts. I will be the final judge before you taking any actions" (2026-11-13)
Owner said: "Do not ask one question at a time, make it into a list or a file" (2026-11-14)
Owner said: "I i chose A, what consultants does? what arena does?" (2026-11-19)
Owner said: "Only use Fable when I told it to do so." (2026-11-19)
How to apply:
Check first: ask these questions before you take questions to the owner.
1. Are the open questions in one file, and did consultants (the `consultants` skill) see them? If not, do that first. Do not ask one question at a time.
2. Does the owner's word name a Fable 5.2 seat for this decision? Only then run one, in either skill.
3. Did the owner decide? Act only on the owner's choice: the owner decides, not the consultants.
- The seats: an Opus subagent and Codex `gpt-6-astra` (effort high). Give them a brief with the full context, and a rubric.
- The skills split on 2026-11-19 (#141): `consultants` grills a recommendation on decisions; `arena` builds candidates, picks a base and grafts the best parts. The 2026-11-13 quote says "arena" for what is now `consultants`.
- Only the owner starts a skill: `/consultants` for decisions, `/arena` only when something must be built in versions. Otherwise run the method of that skill by hand. If you are not sure of an answer, say the doubt and suggest consultants.
- In an arena, score the candidates yourself, and give the owner both scores (L-13).
