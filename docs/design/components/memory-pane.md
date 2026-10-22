# Memory pane

> **Status: agreed in the M0 UI design review (2026-10-22)**, canvas round 6.1 cards M1–M6 (left
> bar and right pane only). Preview: `../previews/command-dark/left-bar.png` (and `.html`).
> Depends on the proposed decisions D43 and D44.

## 1. Where it lives

- The side pane holds **Flow or Memory, one at a time** (D44, proposed). It is on the right by
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
- When the owner's message disagrees with project memory (D43), the bot asks a question before it
  acts. The memory item gets a mark and the `primary` link **"Conflicts with your last message"**.
  The link shows an underline only on hover. A click opens the chat from any page. The chat
  scrolls to the question of the bot, and the question flashes `primary` one time.
- After the owner answers, a different answer adds the line "This differs from project memory"
  with an **Update project memory** button. The line does not stop the work.

## Requirement changes (requirements PR)

- D43 (memory precedence and the conflict stop), proposed in this PR.
- `flow-view.md` and UI-12: the right pane is shared with Memory (D44).
