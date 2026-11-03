# Pin

> **Status: agreed in the M2 Bots UI design review, round 9 (2026-10-23), step 2c.** Preview:
> `../previews/command-dark/pin.png` (and `.html`). Standard: every place that pins an item uses
> this file. `left-bar.md` §1.1 and §1.2 (projects) and `bots-page.md` (bots) follow it.

A pin puts an item at the top of its list, in an order that the owner sets. Activity never moves
a pinned item.

## 1. Look

One glyph and four states, the same in every place. Only the position changes.

| State | Look | Tooltip |
| --- | --- | --- |
| Pinned, at rest | Small pin mark, `on-surface-muted` | none |
| Hover an unpinned item | Faded pin badge | none |
| Pointer on the badge | Solid `primary` badge | "Pin to top" |
| Hover a pinned item | Unpin badge (pin with a slash) | "Unpin" |

Where the pin shows:

| Place | Position |
| --- | --- |
| Rail project tile | Badge on the top-right corner of the tile |
| Bots page card | Badge on the top-right corner of the card |
| Header bot card | 22 px button beside the gear. `primary` glyph when pinned, muted when not |
| Header avatar | **No pin mark.** The avatar's top-right slot shows the bot state (`bot-avatar.md` §3). The pinned group is the place left of the divider (`top-header.md` §3) |

Rule: a pin badge is never on a bot avatar.

## 2. Rules

| Action | Result |
| --- | --- |
| Pin | The item goes to the end of the pinned group (the first pin is at the top) and glows `primary` for a moment. Saves at once |
| Unpin | The item goes back to its sorted place in the others (projects: creation time; bots: the `bot_order` sort). Saves at once |
| Reorder | Drag a pinned item inside the pinned group only. Its old place becomes a gap and a drop line shows where it lands (`dashed-slot.md` §3). Esc cancels |
| Keyboard | Alt+← and Alt+→ (Alt+↑ and Alt+↓ on the rail) move a focused pinned item one place. On the rail, the tile menu also has Move up, Move down, Pin to top and Unpin (`left-bar.md` §1.2) |
| Undo | None. Pin and unpin are one click to reverse (`buttons.md`, Undo rule) |
| Search on | Pin and unpin still work. Drag is off, so the owner never reorders a part of the list |

A pin change shows at once and stays while its request is on its way, also when a refresh
(another request's, an event's, focus) lands before its answer. At the answer the page takes the
server's order again with the refresh after it; a refused change goes back at once, so a refresh
that also fails does not leave it on the page. A newer pin change replaces an older one on the
page, so an older request that answers last never brings its order back. The same holds for the
sort of the others; the pinned order on its way keeps the sort the page shows, also after a sort
that failed (M2c audit, 2026-11-03; `frontend/src/lib/api/optimistic.ts`).

A pinned item shows the grab cursor (closed hand while it moves). An unpinned item shows the
normal arrow. A click opens the item in both cases.

## 3. Data

A nullable position on the item, 1 = first, NULL = not pinned:
`projects.pinned_position` and `bots.pinned_position` (`../../domain-model.md`). One call saves
the whole pinned order, so a gap or a duplicate cannot occur.
