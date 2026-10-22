# Memory pane

> **Status: agreed in the M0 UI design review (2026-10-22)**, canvas round 6.1 cards M1–M6 (left
> bar and right pane only). Preview: `../previews/command-dark/left-bar.png` (and `.html`).
> Depends on the proposed decisions D43 and D44.

## 1. Where it lives

- The right pane holds **Flow or Memory, one at a time** (D44, proposed).
- It opens from the Memory row in bar 2 (`left-bar.md` §2). The chat header keeps only its Flow
  button; there is no Memory button there.
- Opening: the pane slides in over 200 ms ease-out, animating only `transform` and `opacity`. The
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
- When project memory conflicts with the owner's last message (D43), the item is marked and shows
  the `primary` link **"Conflicts with your last message"**, underlined only on hover, like a
  normal link. Clicking it opens the chat (from any page) and scrolls to the bot's waiting message,
  which flashes `primary` once. The buttons there are "Follow my instruction this time" and
  "Update project memory".

## Requirement changes (requirements PR)

- D43 (memory precedence and the conflict stop), proposed in this PR.
- `flow-view.md` and UI-12: the right pane is shared with Memory (D44).
