# Plan card

> **Status: agreed in the M0 UI design review (2026-10-22)**, canvas round 6.3, board V2 cards
> S4b–S4e. Preview: `../previews/command-dark/memory-check-plan.png` (and `.html`). Follows D48
> and D43. The labels and messages use Simplified Technical English.
> **Changed in the M3 UI design review, round 10 (2026-10-24 and 2026-10-25):** the place in the
> reply, the button order and icons, the folded line, and the conflict question in two lines.
> Preview: `../previews/command-dark/conversation-cards.*` (card S3).
> **Progress after Approve (D57, proposed 2026-10-25):** §4 and §6. Preview:
> `../previews/command-dark/plan-progress.*` (P1–P4).

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
   "New version", "For <bot>" and "Needs your final review", for example
   "`write-login-stories` · New skill · For BA · Needs your final review". The whole section
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
plan card shows the result in its block "Check after the run" (D57, proposed; the owner approved
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

**Running (P1, owner 2026-10-25 02:25).**

- Head: **Plan**, the pill "Running · step {n} of {total}" (`on-surface` text on
  `surface-raised`, with the spinner in the bot colour; Running is never amber, `bot-status.md`),
  "Approved 11:12 · version {n}" in `on-surface-muted`, and **Hide**.
- Steps, one line each, 13 px icon, then "{n}. {text}", and the time at the right in 11 px
  `on-surface-muted`:

  | State | Icon | Text |
  | --- | --- | --- |
  | Done | Check in `success` | `on-surface-muted`, time the step took |
  | Current | Spinner in the bot colour | `on-surface`, weight 600, time on this step |
  | Not started | Dashed circle in `on-surface-faint` | `on-surface-soft`, no time |
  | Skipped | Arrow in `on-surface-muted` | `on-surface-muted`, the bot's note at the right |

- Under the current step, one line for each tool call of that step: "└ {tool} {target} ok" in
  mono 11 px `on-surface-muted`, with "ok" in `success` or "error" in `danger`. A tool call goes
  under the newest started step; before the first mark, under step 1.
- **Files:** each file, then "written" (`success`) or "not yet" (`on-surface-faint`).
  **Memory** as in §1.
- The live line under the reply (UI-3.5) shows only the times ("2:10 · last step 0:04 ago"),
  because the card names the step.

**Done, all steps marked (P2).** The card folds to one line (`conversation-cards.md` §3):
"**Plan** [Done] 11:15 · 4 of 4 steps · 2 files · Show".

**Done, with something open (P3).** The card stays open. The pill is "Done · 3 of 4" in `danger`
text on a `danger` tint. Each step with no `done` has the red ! and "Not marked done" at the
right. Under Files, a block with a `danger` left edge: **Check after the run**, one line with the
red ! for each item of `runs.plan_check` (D54): a step not marked done, "Planned, not written:
{path}", "Not in plan: {path}", a delete or move not in the plan; then the Done-when result in
11 px `on-surface-muted` ("Done when (from the skill): 2 of 3 met · 1 not checked").

**Stopped or failed (P4).** The card stays open. The pill is "Stopped · 2 of 4"
(`on-surface-muted` on `surface-raised`) or "Failed · 2 of 4" (`danger`). The done steps keep
their check. The step that was running shows the stop square or the red !, and "Stopped 11:14"
at the right. The steps after it stay not started.

**Show and Hide.** **Hide** folds an open card to its line; **Show** opens it again with the step
marks as they were at the end of the run (§3 of `conversation-cards.md`).

A plain answer has no plan, so it has no progress card (owner, 2026-10-25 02:13).

## Requirement changes (requirements PR)

- D48 in `conversation-rules.md`: plan first for tasks that change something, the two-phase run
  (planning run with read-only tools, then the action run), versions, Reject.
- `realtime-events.md`: events for a plan proposed, changes requested, approved and rejected.
- `domain-model.md`: plans and their versions, linked to the run.
- UI-3.14 changes: "Enter sends. Alt+Enter or Shift+Enter adds a line." in every message and note
  box. The main message box takes Markdown (already rendered, UI-3.1). A Preview toggle there is
  nice to have.
