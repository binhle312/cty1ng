# D47. Delete sends the whole project to Trash; the owner picks what wins in a memory check

Status: accepted (2026-10-22, owner). The owner gave these rules in the UI design review, round 6.3. It amends D37 (projects) and D43 (memory check).
Decision:
- **Delete project.** A delete sends the project to Trash as one item, with all its chats,
  memory items and Library files. Runs in the project stop first.
- **Restore.** For 30 days, the owner can restore the project from Trash. A restore brings back
  the project with all its chats, memory and Library, as they were. The owner cannot restore one
  chat of a deleted project alone. After 30 days, the app deletes the item.
- **Undo.** After the delete, a toast has Undo for 10 seconds.
- **Keep a chat.** To keep a chat, the owner moves it out of the project before the delete. The
  confirm dialog says this.
- **Memory check: the owner picks.** In the check card after an instruction save (D43), each
  item that disagrees has three choices:
  - **Instructions win.** The app updates or deletes the memory item. The app selects this choice
    first.
  - **Memory wins.** The app changes the instruction line.
  - **Decide later.** Nothing changes yet.
  Nothing changes until the owner applies the card.
- **Open conflicts.** An item from Decide later stays marked in the Memory pane and on the Memory
  page, with Decide. The app gives each run in the project the list of open conflicts. Until the
  owner decides, runs follow the instructions. A bot asks about an open conflict in its plan
  (D48).
- **No loops.** A change to the instructions from the check card does not start a new check.
  Only the owner's own save of the instructions starts one. A project has at most one queued
  check. Bots have no tool that starts a check or changes the instructions.
Example: The owner deletes "Pricing page" with 4 chats, 21 memory items and 12 files. Home opens,
and the toast says "Pricing page and its 4 chats are in Trash." with Undo. Two weeks later, the
owner restores the project from Trash. The 4 chats, the memory and the files come back.
Not chosen:
- **The chats move to Home, and only the memory goes to Trash** (D37). Outside the project, the
  chats lose the project's memory and Library, so they are only partly useful. Two places to look
  in after a delete is also harder to understand.
- **The chats can be restored one by one.** A chat without its project memory and Library is
  not complete, and the restore rules become harder to test.
- **Instructions always win in the check card** (D43). The owner sometimes wants the memory item,
  and must then edit the instructions by hand.
Consequences: UI-13.3 changes. The Trash page needs a design. `domain-model.md` links the
conversations and memory items of a deleted project to that delete, so a restore brings back
exactly that set; the workspace moves to `data/trash/`. The API gets delete and restore endpoints
for a project, and the check card actions. Tests: a restore brings back every chat, item and
file; a chat of a deleted project cannot be restored alone; the check card never queues a check
run; no bot tool queues one.
Why: A project is one piece of work. The owner wants it to go away as one unit and come back as
one unit. The owner, not the app, knows which of two rules that disagree is correct.
Implemented in: `../design/components/project-settings-page.md`, `../design/components/memory-pane.md` §4, M5b.
