# D48. Bots plan first and wait for approval before they change anything

Status: proposed (2026-10-22). The owner gave this rule in the UI design review, round 6.3, and chose its scope on a decision card. It amends D43 (check before action) and D38 (memory saves).
Decision:
- **Scope.** A task that changes something starts with a plan. "Changes something" means: write
  or change a file, save or change memory, propose a handoff, or draft a skill. A plain answer or
  question has no plan.
- **The plan card.** The bot replies with a plan card: the steps, the files it will write, the
  memory changes, and one question for each conflict. The card has Approve, Request changes and
  Reject (`../design/components/plan-card.md`).
- **The app enforces it.** A run that makes a plan has read-only tools. Only Approve starts the
  action run, with the write tools and the approved plan. So the rule does not depend on the
  prompt.
- **Conflicts go into the plan.** The D43 check before action happens in the planning run. A
  conflict with the instructions or project memory, or an open conflict (D47), is a question in
  the plan. The app selects "Follow instructions" first.
- **Request changes.** The owner writes a note, in Markdown. The bot makes a new plan version,
  still with read-only tools. Only the newest version can be approved. A normal message that the
  owner sends while a plan waits counts as a change request.
- **Reject.** The task ends, and nothing changes.
- **The owner's direct request is the approval.** "Remember X" or "forget X" from the owner saves
  or removes at once, with Remembered and Undo (D38). In a plain answer, a bot can offer a memory
  item with a **Remember** button. The owner's click is the approval.
- **Other approvals stay.** A handoff card (`../conversation-rules.md` §5) and a skill draft card
  (D41) still need their own approval, because they show the finished work.
Example: The owner writes "Write the price table for the three tiers." BA replies with a plan:
three steps, the file `out/ba/tiers.md` (new), no memory changes, and the question "Project memory
says 'Show prices without currency codes.' Instructions, line 3, say 'Prices are in USD and EUR.'
Which one do I follow?" The owner keeps "Follow instructions" and presses Approve. BA writes the
file.
Not chosen:
- **A plan for every reply.** A plan for "What does this term mean?" adds a wait and a model call,
  and it protects nothing.
- **A plan only in the prompt.** The model can skip it. The read-only tools make it a guarantee.
- **The bot acts and reports at the end.** The owner wants to see conflicts and changes before
  they happen.
Consequences: Each task that changes something costs one more model call, and the owner waits
once per task. In bot-to-bot work, each bot plans, so the owner approves more often. The run
model gets two phases (planning and action) and plan versions. `conversation-rules.md`,
`realtime-events.md` and `domain-model.md` change. The first slice that gives a bot a tool that
changes something (M5b, M5c or M6, whichever comes first) builds the plan card; the other slices
reuse it. Tests with the fake model: a planning run cannot call a write tool; Approve starts the
action run with the approved plan; Reject starts no run; a conflict gives a question in the plan.
Why: The owner wants to see what a bot will change, and to settle conflicts, before the bot acts.
A question in a plan costs less than work that the owner must undo.
Implemented in: `../design/components/plan-card.md`, `../conversation-rules.md`, the slice briefs.
