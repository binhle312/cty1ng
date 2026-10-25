# D59. A save shows a notice when project memory changed after the plan was approved

Status: accepted (2026-10-25, owner). The owner chose option A on a decision card in the project
thread and approved every review item of PR #29.
Amends: D52

Decision:

- **When an action run saves (D52), the app checks the project memory.** It lists the project
  memory items that changed or were deleted after the plan card's `decided_at`. It also checks
  the project instructions and goal (D45).
- **No change: the save is as before.** No extra line, no extra cost.
- **The check runs at each real Library save, not at run end.** The D52 save queue can save a run
  some time after it ends, and the owner can use "Save to Library" on a failed or stopped run much
  later. A check at run end would miss memory that changed in that time.
- **A change: the app saves, then shows a notice.** The notice uses the same pattern as the D52
  save notices (a system line under the reply). Its title names the kind of change, and its link
  opens the right page:

  | Kind | Example | Link |
  | --- | --- | --- |
  | Memory item, changed by a bot on its own | "Project memory changed after plan approval: "Skip Task 3" · BA · Conversation B · 10:03" | **View item** (Memory page) |
  | Memory item, changed by a bot on the owner's request ("remember …", D38) | "… · BA · Conversation B · requested by you · 10:03" | **View item** |
  | Memory item, edited by the owner on the Memory page | "… · You · Memory page · 10:03" | **View item** |
  | Project instructions or goal (D45, only the owner) | "Project instructions changed after plan approval · You · Project settings · 10:03" | **View instructions** or **View goal** (Project settings) |

  Each notice also has **View saved files** (opens the Library history of the save). "Requested
  by you" shows only when the change can be traced to an owner message.
- **A run's own memory changes give no notice.** Under D56 an action run can save memory that is
  on its approved plan. The app leaves out a memory item when its latest change is a step of this
  same run (D38: each memory tool call is a run step). A change on the owner's request in the
  same conversation is not left out: it is not a step of the run.
- **Known limit: the latest change decides.** If conversation B changes item X at 10:02 and run A
  changes X again at 10:03, the latest change is A's, so no notice shows for B's change. Version
  history does not close this gap: a version row stores the bot, not the run, and history can be
  off. This is an accepted first trade-off (owner, 2026-10-25). A full change log per run would close it.
- **No model call.** The check compares times in the database. It is exact for "changed". It
  does not say if the change contradicts the work; the owner decides that.
- **The notice names who changed the item.** Bots save project memory without approval (D38),
  so a changed item is not always the owner's decision. `memory_items.last_changed_by_bot_id`
  and `last_change_message_id` give the bot and the source. Both are NULL for an owner edit on
  the Memory page. Instructions and goal have no item and no message: the source is Project settings.
- **The notice is a snapshot.** The save records each detected change with the save result, as
  D52 records overlaps: the kind (`memory_item`, `project_instructions` or `project_goal`), the
  item id (memory items only), the text at the save, the change (changed or deleted), who changed
  it (bot or owner), the source (conversation and message, Memory page, or Project settings), and
  the time. The notice and the inbox show this record, so they stay the same after a reload, also
  when the item changes again later. **View item** opens the current item and its version history,
  also for a deleted item. When history is off for the project, it shows the saved snapshot and
  "History is off for this project", so the owner can tell the snapshot from missing history.
- **It is not part of the plan check.** `runs.plan_check` (D54) stays the fixed record of what
  the run did on its own branch, shown in "Check after the run" (D57). A memory change is about
  the project context, not about the run's work: a run can be Done with all steps done and still
  get this notice. The P3 rule of the plan card does not change.
- **The same check runs on "Save to Library"** from the unsaved changes card of a failed or
  stopped run (D52, D56).
- **A hold can come later.** As with file overlaps (D52), the checks are recorded. If the
  notices show a need, a card that holds the save can replace the notice. That adds a waiting state.

Example:

| Time | What happens |
| --- | --- |
| 10:00 | Conversation A: the owner approves BA's plan for Tasks 1, 2 and 3. The action run starts |
| 10:03 | Conversation B: the owner says "remember: skip Task 3 in this project". BA in B saves it to project memory (actor BA, requested by the owner) |
| 10:05 | A: the run ends. The save queue saves its files. The check finds one item changed after 10:00. The notice shows under A's reply |
| 10:06 | The owner opens the item, decides Task 3 is out, and asks BA in A to remove it. That is a new plan (D48) |

Options (the owner chose A):

| Option | What happens | Trade-off |
| --- | --- | --- |
| **A. Save, then notice (chosen)** | Save as D52 does. The notice lists the changed items and who changed them | Same rule as file overlaps. No cost, easy to test. Git keeps every version, so a revert is cheap |
| B. Model check, hold on conflict | A model call on each save with a change. A material conflict holds the save | Catches real conflicts sooner. Adds a cost per save, a waiting state and a resume path to D52 |
| C. Hold on any change | Every change holds the save for the owner | Safe, but many false alarms: most changes do not touch the plan |

Why: Without a check, A's work can rest on memory that changed while it ran. D43 checks conflicts
before the plan, and D52 checks file overlaps at the save. Neither looks at memory that changed
during the run. A notice closes that gap at no cost, and the owner keeps the judgement.

Rejected: options B and C (above); a check at run end stored in `runs.plan_check` (it misses
changes between run end and the save, and it mixes the run's own result with its context); a
stored memory revision per run (the plan card's `decided_at` and the item times already give
the answer, and the owner rejected per-item memory attribution in D51).

Consequences:
- No new column on `memory_items`: `updated_at`, `deleted_at` and the plan card's `decided_at`
  find the changes. The project instructions and goal need a change time. The save result needs
  a place for the snapshot, beside the D52 overlap records. The M6 plan adds both (migration).
- A new system line kind. It needs a UI design round with the D52 notices.
- The notice can come after the work is saved. The owner must read it to act.

Implemented in: `../requirements/project-inbox.md` (PI-2, UI-14.5 to UI-14.8); `D52-each-run-writes-on-its-own-branch.md`
and `../tasks/M6-workspace-parity.md` when the owner accepts.
