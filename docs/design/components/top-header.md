# Top header

> **Status: agreed in the M0 UI design review (2026-10-22).** Pinned zone (§3) agreed in the M2
> Bots review, round 9 (2026-10-23), steps 2c and 2e. Previews:
> `../previews/command-dark/top-header.png` (and `.html`), `header-pins.png` (HD1–HD6), `bot-card-v3.png` (H1).
> Focus and touch in states 3 and 5, and §4, from the shell review (2026-10-30). Requirements: `../../requirements/app-shell.md`
> UI-2 (see "Requirement changes" below for items not yet written there).

The header is the **bot roster only**: no navigation links and no Settings in it. It is 52 px tall,
sticky on every page (UI-2.11), background `surface`, bottom line `outline`.

## 1. Layout

- The page width is split into 12 columns. The roster uses the **middle 6**; the 3 columns on each
  side stay empty, so the bots never fill the whole bar.
- Avatars are 36 px circles (`bot-avatar.md` §2), 8 px apart, centred in the zone. No names under
  them.
- Order: the pinned bots in the owner's order, a short divider, then the others by the `bot_order`
  sort, Recent activity (default) or Created. The same order as the Bots page (UI-2.1, §3). UI-2.9
  deferred reordering holds changes that come from activity.

## 2. States

| # | State | Behaviour |
| --- | --- | --- |
| 1 | Bots fit | Centred in the middle zone |
| 2 | More bots than fit | Extra bots stay inside the zone; the zone edge fades (`surface` to transparent, 30 px) on each side that has more. Always visible |
| 3 | Pointer over the header, or keyboard focus inside it | ‹ › buttons (28 px, `surface-raised`, `outline-strong`) appear just outside the zone, only on a side with more bots; one click moves about one zone width. The wheel scrolls sideways. On touch, a swipe scrolls sideways (a long press still starts a drag, HD6) |
| 4 | Hover an avatar | The circle lightens, `cursor: pointer`, the bot name shows in a tooltip under it |
| 5 | Keyboard focus | Tab reaches each avatar in order and scrolls it into view; 2 px `primary` ring. The same tooltip as hover (state 4, H1) shows within 300 ms (UI-2.2). No arrow-key moves (later) |
| 6 | Bot states | Faces and badges of `bot-avatar.md` §3, for the open conversation only |
| 7 | Click an avatar | Opens the bot card (`bot-card.md`). Only one card is open at a time |
| 8 | Drag an avatar into the conversation | The conversation area becomes an active dashed slot (`dashed-slot.md`, "Drop to add Researcher to this conversation") as soon as the avatar leaves the header; the dragged bot is dimmed in the roster. Bots that cannot join say why ("Already here") |
| 9 | Deferred reordering | While the pointer is in the header, activity moves nothing; after a click elsewhere the new order applies in one step. The owner's own pin, unpin or drag applies at once |
| 10 | Page scrolls | The header stays; only the content moves |
| 11 | No bots yet | A dashed slot (`dashed-slot.md`): 36 px circle with "+" and the text "Hey, add your bot here 👋" (`on-surface-muted`); opens the Create bot page. Gone once a bot exists |
| 12 | Uploaded image | Never animates; same badges |

## 3. Pinned zone (round 9)

| # | Item | Behaviour |
| --- | --- | --- |
| HD1 | Zone | Always shown. Pinned bots sit left of a short divider, the others right of it. With no pinned bot, the zone is a dashed slot pill "Drag a bot here to pin it" with the pin glyph |
| H1 | Pin and state | Header avatars have **no pin mark**: the top-right slot shows the state (`bot-status.md`), and "pinned" is the place left of the divider. Tooltip: "BA · pinned · Running"; the bot card pin button is lit |
| HD2 | Drag to pin | Drag an avatar from the others across the divider: the zone becomes an active dashed slot and a drop line shows where it lands. The drop pins the bot at that place |
| HD3 | Drag to unpin | Drag a pinned avatar out of the zone and drop it right of the divider: the bot is unpinned and goes to its sorted place, not to the drop spot. The tooltip says "Unpin" |
| HD4 | Reorder | A drag inside the zone reorders: the old place is a gap, a drop line shows the new place (`dashed-slot.md` §3) |
| HD5 | Drop place decides | In the header a drop pins, unpins or reorders; in the conversation it adds the bot (state 8, UI-2.4). A drag that starts on an avatar never scrolls the header; the wheel and a drag on empty header space still scroll it |
| HD6 | Rules | `pin.md`. Each change saves at once; the header and the Bots page always show the same order (event `bots.reordered`). Keyboard: Alt+← and Alt+→ on a focused header avatar move a pinned bot; the bot card pin button pins and unpins. Screen readers hear "Designer, pinned, 2 of 3". Touch: a long press starts the drag, a short tap opens the bot card. Esc cancels any drag |

This replaces the M0 rule "no drag-reorder in the header" for pinned bots only.

## 4. Later: a list of all bots

A "+N" chip at a faded edge that opens a list of every bot with its name and state. Not agreed
(owner, 2026-10-30): test the header with 12–15 bots when M2 is built, and add the list only if
finding a bot by its avatar is slow. The Bots page already lists every bot by name.

## Requirement changes

Written into `app-shell.md` UI-2.6, UI-2.7 and UI-2.8 (PR #11), including the empty-state text
of state 11. The pinned zone (§3) is in UI-2.1, UI-2.4 and UI-2.9.
