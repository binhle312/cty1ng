# Top header

> **Status: agreed in the M0 UI design review (2026-10-22).** Preview:
> `../previews/command-dark/top-header.png` (and `.html`). Requirements: `../../requirements/app-shell.md`
> UI-2 (see "Requirement changes" below for items not yet written there).

The header is the **bot roster only**: no navigation links and no Settings in it. It is 52 px tall,
sticky on every page (UI-2.11), background `surface`, bottom line `outline`.

## 1. Layout

- The page width is split into 12 columns. The roster uses the **middle 6**; the 3 columns on each
  side stay empty, so the bots never fill the whole bar.
- Avatars are 36 px circles (`bot-avatar.md` §2), 8 px apart, centred in the zone. No names under
  them.
- Order: Recent activity (default) or Custom (UI-2.1, UI-2.9 deferred reordering).

## 2. States

| # | State | Behaviour |
| --- | --- | --- |
| 1 | Bots fit | Centred in the middle zone |
| 2 | More bots than fit | Extra bots stay inside the zone; the zone edge fades (`surface` to transparent, 30 px) on each side that has more. Always visible |
| 3 | Pointer over the header | ‹ › buttons (28 px, `surface-raised`, `outline-strong`) appear just outside the zone, only on a side with more bots; one click moves about one zone width. The wheel scrolls sideways |
| 4 | Hover an avatar | The circle lightens, `cursor: pointer`, the bot name shows in a tooltip under it |
| 5 | Keyboard focus | Tab reaches each avatar in order and scrolls it into view; 2 px `primary` ring. No arrow-key moves (later) |
| 6 | Bot states | Faces and badges of `bot-avatar.md` §3, for the open conversation only |
| 7 | Click an avatar | Opens the bot card (`bot-card.md`). Only one card is open at a time |
| 8 | Drag an avatar into the chat | The chat area becomes a drop zone (2 px dashed `primary`, "Drop to add Researcher to this chat"); the dragged bot is dimmed in the roster. Bots that cannot join say why ("Already here") |
| 9 | Deferred reordering | While the pointer is in the header nothing moves; after a click elsewhere the new order applies in one step |
| 10 | Page scrolls | The header stays; only the content moves |
| 11 | No bots yet | A dashed 36 px circle with "+" and the text "Hey, add your bot here 👋" (`on-surface-muted`); opens the Create bot page. Gone once a bot exists |
| 12 | Uploaded image | Never animates; same badges |

## Requirement changes

These were agreed in the review and will be written into `app-shell.md` in the requirements PR:
- UI-2.6: clicking an avatar opens the bot card, not the bot page.
- UI-2.7: the roster sits in the middle 6 of 12 columns; overflow buttons as in state 3.
- UI-2.8: removed (no links in the header; navigation moves to the left bar and user panel).
- New: the empty-state text of state 11.
