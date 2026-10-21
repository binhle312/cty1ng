# D18. Handoff targets and who decides the workflow

Status: accepted (2026-10-21)
Decision: The workflow is implicit in phase 1. The owner shapes it by writing personas and
skills (for example the `write-user-stories` skill ends with "hand off to the Designer"); the
bot chooses the target; the owner approves every handoff. To let a bot choose sensibly, every
bot has a one-line `description` ("Turns user stories into UI screens"), and each prompt
contains a **team directory** listing the other bots' names and descriptions. A bot may hand
off to any non-deleted, available bot or to `human`. If the target is not a member of the
conversation, the approval card offers "Add <bot> and start". Limit: 5 handoffs per
conversation per 24 hours.
Why: Approval is already the gate, so a fixed target list mostly adds configuration. The team
directory gives the bot the information a human teammate would have.
Rejected: Per-bot allow-list of targets (prototype behaviour); an explicit workflow editor
(BA → Designer → Dev as data the app enforces) — more predictable, but a sizeable feature;
a candidate for a later milestone if implicit workflows prove too loose.
Implemented in: `../conversation-rules.md` §5.
