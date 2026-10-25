# D57. The plan card shows the progress of the action run

Status: accepted (2026-10-25, owner). The owner approved each review item of PR #28 on 2026-10-25. The owner chose an app feature, not a skill, on a decision card in
the review thread "Show bot progress step by step" (2026-10-25 02:16), and chose the running card
P1 (02:25). It amends D48 (what the plan card does after Approve). It uses the plan data and the
run-end check of D54, and it amends D54's `check_done` (evidence, owner 2026-10-25 03:48).
The owner's review of 2026-10-25 07:06 added five rules: verified Done-when evidence, Skipped
steps, the Queued state, which tool calls count as evidence, and the mark rules.
Amends: D48, D54

Decision:

- **The plan card becomes the progress card.** After Approve, the plan card does not fold. While
  the action run works, it shows each approved step (`plan_steps`, D54) with one state:

  | State | Look |
  | --- | --- |
  | Done | Green check, muted text, the start time and the duration ("11:12:04 · 0:18") |
  | Current | Spinner in the bot colour, bold text, the start time and the duration so far, and one small line for each tool call of the step (tool, target, ok or error) |
  | Not started | Dashed circle |
  | Skipped | Arrow, muted text, the start time if the step started, the bot's note |
  | Stopped or failed | The stop square or the red !, at the step that was running |

  The pill says "Running · step 3 of 4". Each file in the plan shows "written" or "not yet".
- **A queued run shows Queued (owner review, 2026-10-25).** An approved action run can wait for
  a file claim of another run (D52). Until `run.started`, the pill is "Queued · waits for
  Pricing conversation", with the clock icon in `on-surface-muted` (the Queued standard,
  `bot-status.md`). It is never amber, because the owner has nothing to do. All steps show "not
  started".
- **The bot marks the steps with one tool.** The action run gets
  `mark_step({step, state: "started" | "done" | "skipped", note})`. `skipped` needs a note. The
  bot can mark only the steps of the approved plan: another number is a tool error
  (`{error: "not_in_plan", message}`). The tool cannot add, remove or change a step. The bot can
  call it in the same model turn as its next tool call, so it adds no model request.
- **One rule sets the step state (owner review, 2026-10-25).** The state of each step comes from
  its `mark_step` rows in call order. One pure function in `core/` (`plan-progress.rules.ts`)
  applies these rules:

  | Mark | Step state before | Result |
  | --- | --- | --- |
  | `started` | Not started | Current. The start time is the time of this mark |
  | `started` | Current | No change. The first start time stays. No error |
  | `done` or `skipped` | Not started or current | Done or skipped. With no `started` mark, the step shows the time of this mark and no duration |
  | Any mark | Done or skipped | Tool error `{error: "step_closed", message}`. Done and skipped are final |

  The bot can mark the steps in any order. More than one step can be current at the same time.
  The pill counts the steps that are done or skipped ("step 3 of 4" means that 2 are settled).
- **No new event.** A `mark_step` call is a tool call: it writes a `run_steps` row (kind
  `mark_step`) and its `run.step` event in one transaction (AGENTS.md §5 rule 3). The card state
  comes from these rows, so it is the same after a reload or an event replay.
- **Tool calls go under the current step.** Each other tool call shows under the current step
  that started last. Before the first `mark_step`, or when no step is current, they show under
  the step that was settled last, or under step 1.
- **At the end the card folds, or stays open.** The card folds to one line only when every step
  is done (none skipped) and nothing is open in the run-end check (`runs.plan_check`, D54):
  "**Plan** [Done] 11:15 · 4 of 4 steps · 2 files · Show". In the check, a Done-when item is
  open when it is `not_met`, `not_checked`, or `met` with `verified: false`. Otherwise the card
  stays open. A step with no `done` and no `skipped` mark shows "Not marked done" (red !). A
  skipped step keeps its arrow and note: the bot settled it, but it did not do it, so the pill
  says "Done · 3 of 4 · 1 skipped" (owner review, 2026-10-25). A block "Check after the run"
  lists what `plan_check` found, also each planned delete or move that the run did not do
  (`planned_ops_not_done`). The block says that it shows what happened in the run, before the
  save. What was saved shows on the D52 card and its notices (D54). A stopped or failed run keeps the card open with the pill "Stopped · 2 of 4"
  or "Failed · 2 of 4".
- **Show and Hide.** The owner can fold the card with **Hide** and open it with **Show** at any
  time, also while the run works. A card hidden during the run keeps the progress on its line,
  updated live: "**Plan** [Running · step 2 of 4] · Show" (owner, 2026-10-25 03:44). After the
  run, the open card shows the step marks as they were at the end of the run.
- **The app reminds the bot once before the run ends (owner, 2026-10-25 03:48).** When the bot
  sends its final reply, the app checks for steps with no `done` or `skipped` mark and for
  Done-when items with no `check_done`. If any are open, the run does not end yet. The app sends
  the bot one more turn: "Before you reply: step 4 and Done-when item 2 have no mark. Mark each
  step done or skipped (with a note), and check each Done-when item. Mark done only what you
  really did." The number of reminders is the setting `plan_mark_reminders` (default 1, 0 = off).
  A reminder is one model request, and it counts toward `request_limit`.
- **The app shows which marks it checked (owner, 2026-10-25 03:48).** A model can claim work that
  it did not do, so each mark shows its source:

  | Mark | App check | Shows |
  | --- | --- | --- |
  | Step `done` with at least one tool call under it that succeeded | Tool calls exist | Green check |
  | Step `done` with no tool call under it that succeeded | None | "Done · no action recorded", `on-surface-muted` with a ! icon (not amber: amber is only for "Waiting for you") |
  | Planned file | The run wrote it (D54) | "written" · **checked by app** |
  | Done-when `met` with evidence | The quote is in the file, in the run's version | **checked by app** |
  | Done-when `met`, quote not found | Failed | **not verified** (`danger`) |
  | Anything else | None | **bot says** |

  `mark_step`, `check_done` and tool calls that gave an error do not count as evidence for a
  step (owner review, 2026-10-25). The step shows the count, for example "2 tool calls · 1 error".

- **Done-when needs evidence (amends D54).** `check_done` with `state: "met"` must have
  `evidence: {path, quote}`. With no evidence, the call gives `invalid_arguments`. At run end, the
  app looks for the quote, as plain text, in that file in the run's final version. It stores the
  evidence and the result in `runs.plan_check.done_when` (`evidence`, `verified`: true, false, or
  null when there is no evidence). A `met` item with `verified: false` is open, so the card stays
  open (owner review, 2026-10-25). While the run works, a `met` item shows **bot says**. A real quote that does not prove
  the point still passes; that needs judgment, which is the optional judge call that D54 parks
  for after M6, and the owner's Bad answer feedback (D51).
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
- `conversation-rules.md` §4: the `mark_step` tool and its error, the reminder, and the evidence
  on `check_done`.
- `domain-model.md` settings: `plan_mark_reminders = 1`. When D57 is accepted, the `check_done`
  line in D54 points to this evidence rule.
- `domain-model.md` §3.8: `run_steps.kind` gets `mark_step`. No migration of its own: the plan
  tables come with D54 and the plan card slice. `plan_check.done_when` gets `evidence` and
  `verified`; `plan_check` is JSON, so this needs no migration either.
- `core/plan-progress.rules.ts`: the step state from the `mark_step` rows (pure function).
- `requirements/conversation.md`: UI-3.29 to UI-3.31; UI-3.5 shows only the times while a
  progress card is open.
- The slice that builds the plan card (D48: M5b, M5c or M6, whichever comes first) builds the
  progress states with it.
- Tests with the fake model: `mark_step` with a step that is not in the plan gives `not_in_plan`;
  `skipped` with no note gives `invalid_arguments`; a run with no mark for a step shows "Not
  marked done"; tool calls go under the current step; the card state is the same after a reload;
  a plain answer has no card; a final reply with an open step gets one reminder, and a second
  final reply ends the run; `plan_mark_reminders = 0` sends none; `done` with no tool call shows
  "no action recorded"; `met` with a quote that is not in the file shows "not verified"; `met`
  with no evidence gives `invalid_arguments`; a `met` item with `verified: false` keeps the card
  open; a skipped step keeps its note, is not "Not marked done", and keeps the card open; a run
  that waits for a claim shows Queued; a step whose only tool call gave an error shows "no action
  recorded"; a mark on a done or skipped step gives `step_closed`; a second `started` keeps the
  first start time; `done` with no `started` is accepted.

Implemented in: `../design/components/plan-card.md`, `../conversation-rules.md`, the slice brief
that builds the plan card.
