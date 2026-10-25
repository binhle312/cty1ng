# D56. Memory in action runs: items not in the plan, and runs that fail

Status: accepted (2026-10-25, owner), options 1A and 2A. It comes from the docs cleanup of
2026-10-24: the memory table in `../requirements/projects-and-memory.md` had one row with "Not
decided", and D52 had a rule for the files of a failed run but not for its memory.
Amends: D38, D48, D52

Decision:

- **1A. An action run saves only the memory changes on its approved plan.** The memory tools
  (`remember`, `update_memory`, `forget`) accept only items on the plan card's Memory list. Other
  calls return the tool error `memory_not_in_plan`. The bot can offer such an item with a
  **Remember** button at the end of its reply; the owner's click saves it (D48).
- **2A. Memory that a failed or stopped run saved stays saved, and the card shows it.** The
  unsaved changes card of D52 also lists each memory item that the run saved, each with Undo:
  "BA stopped. 1 file is not saved. 1 memory item was saved."

## The two questions

**Question 1. An action run saves a memory item that is not in the approved plan.**
D48 lists memory changes on the plan card. No document says what happens when the bot saves an
item that the card did not list. For files, D52 saves the file and flags it "not in plan". For
skill drafts, the app refuses a draft that is not on the plan (`draft_not_in_plan`,
`../conversation-rules.md` §7).

**Question 2. An action run saves memory and then fails or stops.**
D52 keeps the run's files as unsaved changes, with Discard and Save to Library. But memory saves
at once, with "Remembered" and Undo (D38). So after a failed run, the memory items stay saved,
and the files do not. Nothing links the memory items to the failed run.

Example: The owner approves BA's plan "Write the price tiers. Memory: Pro tier is 20 USD". BA
saves the memory item, writes `tiers.md`, and then the run fails. Now `tiers.md` is not saved,
but project memory says "Pro tier is 20 USD", and every later run in the project reads it.

## Options for question 1

| Option | What happens | Trade-off |
| --- | --- | --- |
| **1A. Refuse (recommended)** | The memory tools save only items on the plan's Memory list. Other calls return the tool error `memory_not_in_plan`. The bot can offer the item with a **Remember** button at the end of its reply (D48), so the owner can still save it with one click | Same rule as skill drafts and as web-read runs (D53). The app enforces it. A useful item needs one more click |
| 1B. Save and flag | The item saves with "Remembered" and Undo, and the line also says "not in plan" | Same as files in D52. But memory goes into every later run's prompt, so a wrong item has a larger effect than a wrong file |

## Options for question 2

| Option | What happens | Trade-off |
| --- | --- | --- |
| **2A. Keep, show on the card (recommended)** | Memory items stay saved. The failed-run card from D52 also lists them: "BA stopped. 2 files are not saved. 1 memory item was saved." Each item has Undo | Small change: it uses the card that D52 has. If the owner ignores the card, the items stay |
| 2B. Hold memory like files | Memory items from an action run wait with the run. They save when the run ends well, or with Save to Library. Discard drops them | Files and memory act the same. But the bot cannot read its own new item during the run, and M6 needs more states |

With 1A, a run saves only items that the owner approved on the plan. So 2A keeps only approved
items, and the risk of 2A is small.

## Not changed

- The owner's "remember X" or "forget X" saves at once (D38, D48).
- The **Remember** button in a plain answer (D48).
- Web-read runs (D53): already only plan items or the Remember button.
- D52 file rules.

## What changes in other documents

- `../requirements/projects-and-memory.md`: memory table rows, UI-13.16 (1A) and UI-13.17 (2A).
- `../conversation-rules.md` §4: the error code `memory_not_in_plan`.
- `../tasks/M6-workspace-parity.md`: the parked question is closed.
- `../design/components/plan-card.md`: no change (the Memory list exists).
- The D52 card text gets the memory line when M6 designs that card.

Implemented in: `../requirements/projects-and-memory.md` (memory table, UI-13.16, UI-13.17),
`../tasks/M6-workspace-parity.md`. Built in M6, with the D52 card.
