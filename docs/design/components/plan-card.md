# Plan card

> **Status: agreed in the M0 UI design review (2026-10-22)**, canvas round 6.3, board V2 cards
> S4b–S4e. Preview: `../previews/command-dark/plan-card.png` (and `.html`), cards S4b–S4e,
> regenerated with the round 10 parts (owner review, 2026-10-25). Follows D48 and D43. The labels and messages use Simplified Technical English.
> **Changed in the M3 UI design review, round 10 (2026-10-24 and 2026-10-25):** the place in the
> reply, the button order and icons, the folded line, and the conflict question in two lines.
> Preview: `../previews/command-dark/conversation-cards.*` (card S3).
> **Progress after Approve (D57, accepted 2026-10-25):** §4 and §6. Preview:
> `../previews/command-dark/plan-progress.*` (P0–P5).

A bot shows a plan card before each task that changes something (D48): it writes files, saves
memory, hands off or drafts a skill. A plain answer or question has no plan card.

## 1. The card

The card is part of the bot's reply, under the line "Here is my plan. I do not change anything
until you approve it.", indented like the reply text. The card look (border, fill, section
titles, file rows) is in `conversation-cards.md` §3. Top to bottom:

1. **Plan**, then "· version {n}" from version 2, and the pill **Waiting for you**
   (`primary-tint`).
2. The numbered steps.
3. **Files:** each file the bot will write, with "new" or "changed". Then each delete and move,
   for example "`drafts/old-tiers.md` · delete" and "`notes.md` → `pricing/notes.md` · move".
   Approve covers these, so the save shows no second card for them (D54).
4. **Memory:** each memory change, or "No changes".
5. **Skill drafts:** one entry for each skill the bot will draft: the slug, then "New skill" or
   "New version", and "Needs your final review", for example
   "`write-login-stories` · New skill · Needs your final review". A draft has no target bot,
   so the line names no bot (D65). A new version of a skill that is not assigned to the bot
   says so: "`design-review` · New version · Not assigned to BA · Needs your final review".
   The whole section
   shows only when the plan has at least one draft (owner, 2026-10-24).
6. **Done when:** the items of the `## Done when` section of each skill that the plan uses,
   numbered 1..n across all of them. Each item keeps its source skill and version. The section
   shows only when at least one skill has one (D54).
7. **Question before I start**, one block for each conflict (§2).
8. A divider, then the buttons in the `buttons.md` order: **× Reject** (secondary, × icon),
   **Request changes** (secondary, pencil icon) and **✓ Approve** (primary, check icon, far right;
   owner, 2026-10-25 01:58).

While the card waits, the bot has read-only tools. Only Approve starts the action run, with the
write tools and the approved plan.

The steps, Files (with deletes and moves), Memory, Skill drafts and Done when lists are data in
the plan, not only text (`plan_steps`, `plan_files`, `plan_file_ops`, `plan_done_when`, D54). The app uses the
Skill drafts list to decide if the action run gets `propose_skill` (`../../conversation-rules.md`
§7).

## 2. Conflict questions (D43)

For each conflict between the task and a project rule, the card has a block with a `primary`
left edge. The heading is one line: **Question before I start: which one do I follow?** Then one
line for each text (owner, 2026-10-24):

- Project memory says "Show prices without currency codes."
- Instructions, line 3, say "Prices are in USD and EUR."

- Buttons: **Follow instructions** and **Follow memory**. The app selects **Follow
  instructions** first, so Approve is on at once (owner, 2026-10-22).
- Under the buttons: "The app selects Follow instructions first. Your answer also settles the
  open conflict in Memory."
- The app gives each run the list of open conflicts (`memory-pane.md` §4), so the bot does not
  need to find them. The bot decides only if the task touches one. That part is best effort.

## 3. Request changes

- Request changes opens a note box inside the card, in place of the three buttons. The focus
  goes into the box. The plan stays open above it.
- Title "Request changes", then "Markdown". Placeholder: "What must BA change in the plan?
  Example: Also add a yearly price."
- The box takes Markdown. A Preview tab is nice to have, not in the first build (owner,
  2026-10-22).
- **Send** stays off until the box has text. Enter sends. Alt+Enter adds a line, and Shift+Enter
  does too. Esc or **Cancel** closes the box and brings the buttons back.
- A normal message that the owner sends while the plan waits counts as a change request for that
  plan.
- After Send, the old plan folds to one line: **Plan**, the pill **Changes requested**, "Show
  ›", and the note rendered as Markdown. A folded line never repeats the word in its pill
  (`conversation-cards.md` §3). The bot makes a new plan, still with read-only tools,
  with the next version number. Only the newest version can be approved. Each version is one more
  model call.

## 4. Approve

The action run starts. The card does not fold: it shows the progress of the run (§6, D57). The
buttons go away, because the plan is decided. The result comes as a new reply under the card.

At the end of the action run, the app compares the run with the plan (`runs.plan_check`, D54):
planned files not written, planned deletes and moves not done, files not in the plan, and each
Done-when item that is `not_met` or `not_checked`. The check shows what happened on the run's
branch, not what was saved, and it never changes after the run ends. The Done-when marks are the bot's own check, so the card says so. The
plan card shows the result in its block "Check after the run" (D57; the owner approved
this place on board P3).

## 5. Reject

- The task ends. The app does not start the action run, so no file and no memory changes.
- The plan folds to one line with the pill **Rejected** and "Nothing changed. No files, no
  memory."
- The bot sends one line: "OK, I stopped. Tell me when you want me to try again."
- A reason is optional. To try again, the owner sends a new message. An open conflict in the plan
  stays open.

## 6. Progress of the action run (D57)

After Approve, the card shows each approved step (`plan_steps`, D54) with its state. The bot
marks the steps with the `mark_step` tool (`../../conversation-rules.md` §4). The card state comes
from the run's `run_steps` rows, so it is the same after a reload. Preview:
`../previews/command-dark/plan-progress.*`.

**Queued (P0, owner review, 2026-10-25).** When the approved run waits for a file claim of another
run (D52), the pill is "Queued · waits for {conversation}" with the clock icon, in
`on-surface-muted` on `surface-raised` (`bot-status.md`). Never amber: the owner has nothing to
do. Every step shows the dashed circle. The card changes to Running at `run.started`.

**Running (P1, owner 2026-10-25 02:25).**

- Head: **Plan**, the pill "Running · {done} of {total} done", plus "· {n} skipped" when a step
  was skipped (owner review, 2026-10-25 07:42) (`on-surface` text on
  `surface-raised`, with the spinner in the bot colour; Running is never amber, `bot-status.md`),
  "Approved 11:12 · version {n}" in `on-surface-muted`, and **Hide**.
- Steps, one line each, 13 px icon, then "{n}. {text}", and at the right in 11 px
  `on-surface-muted` the start time and the duration of the step: "11:12:04 · 0:18" (owner,
  2026-10-25 03:55). The start time is local clock time with seconds, because steps are often
  seconds apart; a tooltip gives the full date and time ("2026-10-25 11:12:04"). The current step's
  duration counts up. A step that has not started shows no time:

  | State | Icon | Text |
  | --- | --- | --- |
  | Done | Check in `success` | `on-surface-muted`, start time · duration |
  | Current | Spinner in the bot colour | `on-surface`, weight 600, start time · duration so far |
  | Not started | Dashed circle in `on-surface-faint` | `on-surface-soft`, no time |
  | Skipped | Arrow in `on-surface-muted` | `on-surface-muted`, start time · duration if the step started, else the time of the mark with no duration; the bot's note at the right |

- Under the current step, one line for each tool call of that step: "└ {tool} {target} ok" in
  mono 11 px `on-surface-muted`, with "ok" in `success` or "error" in `danger`. A tool call goes
  under the current step that started last. Before the first mark, it goes under step 1. After
  that, a call made when no step is current goes to one line under the steps, "Other tool calls ·
  {n}" in 11 px `on-surface-muted`, with the call lines under it.
- The step state follows the mark rules of D57 (`plan-progress.rules.ts`): done and skipped are
  final, a second `started` keeps the first start time, and more than one step can be current.
- **Files:** each file, then "written" (`success`) or "not yet" (`on-surface-faint`).
  **Memory** as in §1.
- The live line under the reply (UI-3.5) shows only the times ("2:10 · last step 0:04 ago"),
  because the card names the step.

**Who checked a mark (D57).** Only tool calls that succeeded count, and not `mark_step` or
`check_done`. A call counts only for a step that was open when the call began: calls shown under
step 1 before the first mark, and calls in "Other tool calls", are not evidence. A step marked done with no such tool call under it shows "Done · no
action recorded" in `on-surface-muted` with a ! icon, not the green check (never amber: amber is
only for "Waiting for you"). Planned files and Done-when items with a quote that the app found
show **checked by app** in 11 px `success`. A Done-when `met` whose quote is not in the file shows
**not verified** in `danger`. A Done-when `not_met` shows **bot says** in 11 px
`on-surface-muted`, with the bot's note under it. Steps have no source label: each step shows
its tool-call count under it ("2 tool calls", or "2 tool calls · 1 error") as the evidence
(board P5). The app checks Done-when quotes at run end and stores the result in
`plan_check.done_when` (`evidence`, `verified`), so the card shows the same label after a reload.
While the run works, a Done-when `met` shows **bot says**; at run end it changes to **checked by
app** or **not verified**.

**Done, all steps done (P2).** Only when every step is done (none skipped) and nothing is open
in `plan_check`, the card folds to one line (`conversation-cards.md` §3):
"**Plan** [Done] 11:15 · 4 of 4 steps · 2 files · Show".

**Done, with something open (P3).** The card stays open. Open means: a step with no final mark,
a skipped step, or an open item in `plan_check` (a Done-when item `not_met`, `not_checked`, or
`met` with `verified: false`). The pill is "Done · 3 of 4" in `danger` text on a `danger` tint,
with "· 1 skipped" when a step was skipped. Each step with no `done` and no `skipped` mark has the
red ! and "Not marked done" at the right. A skipped step keeps its arrow and the bot's note.
Under Files, a block with a `danger` left edge: **Check after the run**, then in 11 px
`on-surface-muted` "What happened in this run, before the save" (the check never shows what was
saved: a failed run or a rejected delete can differ, D54). One line with the red ! for each item
of `runs.plan_check`: a step not marked done, "Planned, not written: {path}", "Planned, not done:
delete {path}" or "move {path} → {to_path}" (`planned_ops_not_done`), "Not in plan: {path}", a
delete or move not in the plan; then the Done-when result in 11 px `on-surface-muted` ("Done when
(the bot's own check): 2 of 3 met · 1 not checked").

**Stopped or failed (P4).** The card stays open. The pill is "Stopped · 2 of 4"
(`on-surface-muted` on `surface-raised`) or "Failed · 2 of 4" (`danger`). The done steps keep
their check. The step that was running shows the stop square or the red !, and "11:13:27 · stopped 11:14:08"
at the right. The steps after it stay not started.

**Show and Hide.** The owner can hide or show the card at any time, also while the run works
(owner, 2026-10-25 03:44). **Hide** folds the card to its line; **Show** opens it again
(`conversation-cards.md` §3). A card hidden during the run keeps the progress on its line, and the
line updates live: "**Plan** [⟳ Running · 1 of 4 done] · Show", then "2 of 4 done", and so on.
After the run, the open card shows the step marks as they were at the end of the run.

A plain answer has no plan, so it has no progress card (owner, 2026-10-25 02:13).

## Requirement changes (requirements PR)

- D48 in `conversation-rules.md`: plan first for tasks that change something, the two-phase run
  (planning run with read-only tools, then the action run), versions, Reject.
- `realtime-events.md`: events for a plan proposed, changes requested, approved and rejected.
- `domain-model.md`: plans and their versions, linked to the run.
- UI-3.14 changes: "Enter sends. Alt+Enter or Shift+Enter adds a line." in every message and note
  box. The main message box takes Markdown (already rendered, UI-3.1). A Preview toggle there is
  nice to have.
