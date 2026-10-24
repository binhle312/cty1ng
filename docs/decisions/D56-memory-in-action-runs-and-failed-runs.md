# D56. Memory in action runs: items not in the plan, and runs that fail

Status: proposed (2026-10-24). Not accepted. The owner picks one option for each question below.
It comes from the docs cleanup of 2026-10-24: the memory table in
`../requirements/projects-and-memory.md` has one row with "Not decided", and D52 has a rule for
the files of a failed run but not for its memory.
Amends: D38, D48

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

## If accepted

- `../requirements/projects-and-memory.md`: the row "Action run, the item is not in the plan" gets
  the chosen rule; a new criterion for the failed-run card.
- `../conversation-rules.md`: the memory tool rule and the error `memory_not_in_plan` (1A).
- `../design/components/plan-card.md`: no change for 1A (the Memory list exists).
- D52 failed-run card text (2A), built in M6.
- A fake-model test for each chosen rule (`../testing.md`).

Implemented in: nothing yet (proposed).
