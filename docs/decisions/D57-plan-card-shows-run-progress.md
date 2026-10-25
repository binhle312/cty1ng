# D57. The plan card shows the progress of the action run

Status: proposed (2026-10-25). The owner chose an app feature, not a skill, on a decision card in
the review thread "Show bot progress step by step" (2026-10-25 02:16), and chose the running card
P1 (02:25). It amends D48 (what the plan card does after Approve). It uses the plan data and the
run-end check of D54.
Amends: D48

Decision:

- **The plan card becomes the progress card.** After Approve, the plan card does not fold. While
  the action run works, it shows each approved step (`plan_steps`, D54) with one state:

  | State | Look |
  | --- | --- |
  | Done | Green check, muted text, the time the step took |
  | Current | Spinner in the bot colour, bold text, the time on this step, and one small line for each tool call of the step (tool, target, ok or error) |
  | Not started | Dashed circle |
  | Skipped | Arrow, muted text, the bot's note |
  | Stopped or failed | The stop square or the red !, at the step that was running |

  The pill says "Running · step 3 of 4". Each file in the plan shows "written" or "not yet".
- **The bot marks the steps with one tool.** The action run gets
  `mark_step({step, state: "started" | "done" | "skipped", note})`. `skipped` needs a note. The
  bot can mark only the steps of the approved plan: another number is a tool error
  (`{error: "not_in_plan", message}`). The tool cannot add, remove or change a step. The bot can
  call it in the same model turn as its next tool call, so it adds no model request.
- **No new event.** A `mark_step` call is a tool call: it writes a `run_steps` row (kind
  `mark_step`) and its `run.step` event in one transaction (AGENTS.md §5 rule 3). The card state
  comes from these rows, so it is the same after a reload or an event replay.
- **Tool calls go under the current step.** Each other tool call shows under the newest step with
  `started` and no `done`. Before the first `mark_step`, they show under step 1.
- **At the end the card folds, or stays open.** When the run ends with every step done and
  nothing open in the run-end check (`runs.plan_check`, D54), the card folds to one line:
  "**Plan** [Done] 11:15 · 4 of 4 steps · 2 files · Show". Otherwise it stays open: each step
  with no `done` shows "Not marked done" (red !), and a block "Check after the run" lists what
  `plan_check` found, also each planned delete or move that the run did not do
  (`planned_ops_not_done`). The block says that it shows what happened in the run, before the
  save. What was saved shows on the D52 card and its notices (D54). A stopped or failed run keeps the card open with the pill "Stopped · 2 of 4"
  or "Failed · 2 of 4".
- **Show and Hide.** A folded card opens with **Show** and folds with **Hide**. The open card
  shows the step marks as they were at the end of the run.
- **Only runs with a plan.** A plain answer has no plan, so it has no progress card. It keeps the
  live line (UI-3.5). The bot does not write its own checklist (owner, 2026-10-25 02:13).
- **Skills give the steps, the app shows them.** A skill's `## Steps` section helps the bot write
  the plan steps. The card is an app guarantee: it shows data that the app has. How fine the steps
  are is process, so it stays in skills (D16, `requirements/skill-hub.md`).

Example: the owner approves BA's plan with four steps. BA calls `mark_step(1, "started")` with
`read_file`, then `mark_step(1, "done")` and `mark_step(2, "started")` with `write_file`. The card
shows step 1 done, step 2 current with the `write_file` line under it, and steps 3 and 4 not
started. BA ends the run without a mark for step 4. The card stays open: step 4 "Not marked
done", and "Planned, not written: README.md" from `plan_check`.

Why:

- **The owner wants to see where the bot is.** Done, now and next, the same way the Claude thread
  checklist shows them (owner, 2026-10-25).
- **A skill cannot draw or update a card.** A skill is text in the prompt. A Markdown checklist
  needs a new message for each change (messages are never edited in place, AGENTS.md §5 rule 5),
  and nothing checks that a ✓ is true.
- **The approved plan is the list.** The owner checks the approved steps, not a list that
  the bot can change during the run.

Not chosen:

- **A skill only.** No live card, a new message for each change, and no check at the end.
- **Steps made from tool calls only.** The owner sees "write_file", not the plan language. Tool
  calls stay, as lines under the current step.
- **A free checklist tool** (the bot writes the whole list each time). The bot could change the
  list during the run.
- **A second card under the plan card.** Two cards for one task.
- **Tool calls only in the Flow pane** (P1b). Calmer, but the owner sees less of the current
  step.

Consequences:

- `design/components/plan-card.md` §4 and §6, `conversation-cards.md` §3: the running and
  finished states, Show and Hide.
- `conversation-rules.md` §4: the `mark_step` tool and its error.
- `domain-model.md` §3.8: `run_steps.kind` gets `mark_step`. No migration of its own: the plan
  tables come with D54 and the plan card slice.
- `requirements/conversation.md`: UI-3.29 to UI-3.31; UI-3.5 shows only the times while a
  progress card is open.
- The slice that builds the plan card (D48: M5b, M5c or M6, whichever comes first) builds the
  progress states with it.
- Tests with the fake model: `mark_step` with a step that is not in the plan gives `not_in_plan`;
  `skipped` with no note gives `invalid_arguments`; a run with no mark for a step shows "Not
  marked done"; tool calls go under the current step; the card state is the same after a reload;
  a plain answer has no card.

Implemented in: `../design/components/plan-card.md`, `../conversation-rules.md`, the slice brief
that builds the plan card.
