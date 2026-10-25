# Plan card

> **Status: agreed in the M0 UI design review (2026-10-22)**, canvas round 6.3, board V2 cards
> S4b–S4e. Preview: `../previews/command-dark/memory-check-plan.png` (and `.html`). Follows D48
> and D43. The labels and messages use Simplified Technical English.
> **Changed in the M3 UI design review, round 10 (2026-10-24 and 2026-10-25):** the place in the
> reply, the button order and icons, the folded line, and the conflict question in two lines.
> Preview: `../previews/command-dark/conversation-cards.*` (card S3).

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
   Approve covers these, so the save shows no second card for them (D54, proposed).
4. **Memory:** each memory change, or "No changes".
5. **Skill drafts:** one entry for each skill the bot will draft: the slug, then "New skill" or
   "New version", "For <bot>" and "Needs your final review", for example
   "`write-login-stories` · New skill · For BA · Needs your final review". The whole section
   shows only when the plan has at least one draft (owner, 2026-10-24).
6. **Done when:** the items of the loaded skill's `## Done when` section, numbered. The section
   shows only when the skill has one (D54, proposed).
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

The plan folds to one line: "**Plan** [Approved] 11:12 · 3 steps · 2 files · Show". The
action run starts, and its result comes as a new reply under the folded line.

At the end of the action run, the app compares the run with the plan (`runs.plan_check`, D54,
proposed). The reply shows one line, for example "Plan check: 2 of 2 files written · 0 not in
plan · Done when 2 of 3", and one line for each planned file not written and each Done-when item
that is `not_met` or `not_checked`. The Done-when marks are the bot's own check, so the line
says so. The look of this line goes to the M6 design round.

## 5. Reject

- The task ends. The app does not start the action run, so no file and no memory changes.
- The plan folds to one line with the pill **Rejected** and "Nothing changed. No files, no
  memory."
- The bot sends one line: "OK, I stopped. Tell me when you want me to try again."
- A reason is optional. To try again, the owner sends a new message. An open conflict in the plan
  stays open.

## Requirement changes (requirements PR)

- D48 in `conversation-rules.md`: plan first for tasks that change something, the two-phase run
  (planning run with read-only tools, then the action run), versions, Reject.
- `realtime-events.md`: events for a plan proposed, changes requested, approved and rejected.
- `domain-model.md`: plans and their versions, linked to the run.
- UI-3.14 changes: "Enter sends. Alt+Enter or Shift+Enter adds a line." in every message and note
  box. The main message box takes Markdown (already rendered, UI-3.1). A Preview toggle there is
  nice to have.
