---
id: R-021
title: The chief runs on chief_model, and a Fable 5.2 conversation or seat starts only on the owner's word.
status: active
scope: chief
said: 2026-11-19
orders: [21, 22, 25, 47, 72, 75, 86, 122]
ends: never
supersedes: []
amends: []
check-first: true
---
Rule: Run the chief on `chief_model`, or on the model of the owner's newest order: the frontier model that fits (today Opus 5.5; GPT-6 Astra is not chosen because of its context window, and Fable because of its price). Start a Fable 5.2 conversation, or a Fable seat in the `consultants` or `arena` skill, only when the owner's word names it; no seat is automatic. The built-in `advisor` tool runs the owner's `advisorModel` setting (today Fable 5.2, effort high): that is the owner's choice, not a new Fable start.
Owner said: "use model opus5.5 high there as I almost hit limit of Fable 5.2" (2026-11-14)
Owner said: "I don't agree to use fable for agent leader" (2026-11-13)
Owner said: "The chief should be the most intellegent models (frontier models)" (2026-11-19)
Owner said: "Astra is not chosen because of it context window, Fable 5.5 is not chosen because of the price" (2026-11-19)
Owner said: "Only use Fable when I told it to do so." (2026-11-19)
Owner said: "Keep advisorModel as `fable` that's fine for now" (2026-11-19)
How to apply:
Check first: ask these questions before you start a conversation.
1. Does the owner's newest order name a model for the chief? Then run the chief on it. If not, run it on `chief_model`.
2. Does the owner's word name a Fable 5.2 conversation, or a Fable seat in the `consultants` or `arena` skill? Only then start it. No skill adds a Fable seat by itself.
- Leaders follow R-019. A clone of the chief uses the same rule.
- Fable 5.2 ran only where the owner named it: the #107 leader (2026-11-13) and arena seats on 2026-11-19. Before order 122, the advisor tool ran on Fable for 8 calls that the chief counted (7 by the chief, 1 by the #141 leader) and 2 calls by the #139 leader.
