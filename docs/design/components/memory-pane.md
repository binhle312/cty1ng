# Memory pane

> **Status: agreed in the M0 UI design review (2026-10-22)**, canvas round 6.1 cards M1–M6 (left
> bar and right pane only), and round 6.3 board V2 cards S4 and S4b (§4). Previews:
> `../previews/command-dark/left-bar.png` and `memory-check-plan.png` (each with a `.html`).
> Follows D43, D44, D47 and D48.

## 1. Where it lives

- The side pane holds **Flow or Memory, one at a time** (D44). It is on the right by
  default. The ⇄ button (UI-12.1) swaps it to the left, and Flow and Memory share that side.
- It opens from the Memory row in bar 2 (`left-bar.md` §2). The chat header keeps only its Flow
  button; there is no Memory button there.
- Opening: the pane slides in from its side over 200 ms ease-out, animating only `transform` and `opacity`. The
  chat narrows once, at the end, so text does not reflow during the slide. Reduced motion: no
  slide.

## 2. Content

Order follows D43 (project memory wins over bot memory):

1. **Project memory**, labelled "wins on conflict".
2. Each bot's own memory, one group per bot, with its avatar.

Each item: text, "last changed by", a "New" tag for saves the owner has not seen. Buttons: Add, and
"Memory page ›" at the bottom.

Outside projects: a 1:1 shows that bot's own memory; a group chat shows the conversation memory,
then each bot's own.

## 3. Conflicts

- A bot memory item overridden by project memory is shown struck through, with the reason.
- When the owner's message disagrees with project memory (D43), the bot asks a question in its
  plan before it acts (`plan-card.md` §2). For a plain answer with no plan, it asks a normal
  question. The memory item gets a mark and the `primary` link **"Conflicts with your last message"**.
  The link shows an underline only on hover. A click opens the chat from any page. The chat
  scrolls to the question of the bot, and the question flashes `primary` one time.
- After the owner answers, a different answer adds the line "This differs from project memory"
  with an **Update project memory** button. The line does not stop the work.

## 4. Memory check card (D43, D47)

After the owner saves new instructions, the check run compares them with all project memory items.
If items disagree, the Memory pane opens from **Review in Memory** (`project-settings-page.md` §4)
with a card at the top:

- Title "Memory check · {n} items disagree", then "Pick what wins for each item. Nothing changes
  until you apply."
- One block per item: "Memory" with the item text, "Line {n}" with the instruction line, a
  three-part choice and a result line.
  - **Instructions win** (selected first): the app updates or deletes the memory item. The result
    line shows the new item text, for example "The memory item becomes "Prices are in USD and
    EUR."".
  - **Memory wins:** the app changes the instruction line, for example "Line 3 becomes "Prices are
    in USD and EUR. Show prices without currency codes."".
  - **Decide later:** nothing changes yet.
- Buttons: **Apply {n} choices** (`primary`) and **Not now**. Not now is Decide later for every
  item.
- A change to the instructions from this card does not start a new check. Only the owner's own
  save of the instructions starts one, and a project has at most one queued check.

**Open conflicts.** An item from Decide later keeps a `primary` mark in the pane and on the Memory
page: "Disagrees with instructions, line {n}" and **Decide**, which opens the three choices for
that item. The app gives each run in the project the list of open conflicts. When a task touches
one, the bot asks about it in its plan (`plan-card.md` §2). Until the owner decides, runs follow
the instructions.

## Requirement changes (requirements PR)

- D43 (memory precedence and the conflict question) in `conversation-rules.md`.
- `flow-view.md` and UI-12: the right pane is shared with Memory (D44).
- D47: the check card choices, Decide later and the open conflicts list. Tests: the check card
  never queues a check run, and no bot tool queues one.
