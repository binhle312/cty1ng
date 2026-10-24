# Dashed slot

> **Status: agreed in the M2 Bots UI design review, round 9 (2026-10-23), step 2g.** Preview:
> `../previews/command-dark/dashed-slot.png` (and `.html`). Standard: every empty place that the
> owner can fill uses this component.

A dashed slot marks an empty place that the owner can fill, by a click (New project, add a bot)
or by a drop (pin a bot, add a bot to a conversation).

## 1. States

| State | Border | Text | Fill |
| --- | --- | --- | --- |
| Rest | 1.5 px dashed `outline-strong` | `on-surface-muted` | none |
| Active | 1.5 px dashed `primary` | `primary` | `primary-tint` |

The shape follows the item that it stands for: tile, circle, pill or card. The change between
rest and active is a 120 ms fade, and there is no other animation. The dashed border never
carries meaning alone: a text or a "+" says what the place is for. A slot that takes a click has
the standard focus ring (`buttons.md`).

## 2. Where it is used

| Place | Rest | Active when |
| --- | --- | --- |
| Rail: New project tile | "+" tile | The New project page is open |
| Header: empty pinned zone | Pill "Drag a bot here to pin it" with the pin glyph | A bot is dragged over it |
| Header: no bots yet | "+" circle, "Hey, add your bot here 👋" | The Create page is open |
| Conversation: drop to add a bot | Not shown | An avatar is over the conversation: "Drop to add {bot} to this conversation" |
| Empty seat in an empty state | Decoration only | Never |

## 3. Two drag helpers (not slots)

While an item moves:

- **Gap:** its old place has a dashed `outline` border (the faint one), no text and no fill.
- **Drop line:** where the item will land, a 2 px `primary` line at 80 % opacity.

Nothing can be clicked on a gap or a drop line.
