# App shell, conversation rail and bot header

The frame around every page: the rail of conversations on the left and the bar of bots at the top.

## Stories

- **SH-1.** As the owner, I want every conversation as a round icon in a rail with a "+" at the top, so that I can switch and start conversations in one click.  
  Acceptance criteria: UI-1.1 to UI-1.6.
- **SH-2.** As the owner, I want all my bots visible in a header with name tooltips, so that I always know who is available.  
  Acceptance criteria: UI-2.1 to UI-2.3, UI-2.6 to UI-2.8.
- **SH-3.** As the owner, I want to drag a bot from the header into the conversation, so that adding a bot feels direct.  
  Acceptance criteria: UI-2.4, UI-2.5.
- **SH-6.** As the owner, I want the header to show my pinned bots first in my order, then the others by recent activity or creation time, and never to shuffle while I am using it, so that I can find a bot without chasing it.  
  Acceptance criteria: UI-2.1, UI-2.9, UI-2.10, UI-4.5.
- **SH-4.** As the owner opening the app for the first time, I want a short checklist of what to set up, so that I reach my first bot reply without reading documentation.  
  Acceptance criteria: UI-1.7 to UI-1.9.
- **SH-5.** As the owner, I want the app to reopen where I left off, so that closing it costs me nothing.  
  Acceptance criteria: UI-1.10 to UI-1.12.
- **SH-7.** As the owner, I want one Trash page for everything I deleted, so that I can restore a mistake or delete things for good in one place, one or many at a time.  
  Acceptance criteria: UI-1.14 to UI-1.19 (slice M5b, D62).

## Acceptance criteria

Shared rules for every story: `README.md` §Applies to every story. Layouts referenced below are sketches in `../design/`, not final designs.

## App shell and conversation rail (UI-1)

Layout sketch: see `../design/screens.md` §1 (not final).

- UI-1.1: The rail is always visible. The top item is a round "+" button; clicking it creates a
  conversation titled "New conversation" and opens it. After the first message, the app can
  give it a short title one time (UI-3.24, D46).
- UI-1.2: Each conversation is a 48 px round icon with a tooltip showing its title.
- UI-1.3: Icon content, from **active** members' avatars:
  0 bots → title initials on a neutral background; 1 → that avatar; 2 → two halves side by
  side; 3–4 → 2×2 grid; 5+ → three avatars and a "+N" tile. Removed bots are left out; deleted
  bots are drawn grey. Pending members are left out until the owner chooses their history. There
  are no preset icons (round 12).
- UI-1.4: The open conversation has an active indicator (pill on the left edge, as Discord).
  Conversations with unread messages show a dot.
- UI-1.5: Sorted by last activity, newest first.
- UI-1.6: Right-click or ⋯ on a conversation row: the conversation menu (UI-9.7). **Delete**
  (M5b) opens a dialog that names the conversation and gives the real counts (messages and runs,
  conversation memory items) and says that its files stay in the Library; a line says that a queued or running run stops first. **Cancel** is
  the default. **Delete** moves the conversation to Trash (D60). Then the newest other
  conversation in the same place opens, and a toast says "{title} is in Trash." with no Undo.

## Header (bot bar) (UI-2)

- UI-2.1: Shows every non-deleted bot as a 36 px round avatar, in the same order as the Bots page
  (`bots.md` UI-4.5):
  - **Pinned** bots first, in the owner's order, then a short divider, then the others. The
    pinned zone and the divider are always shown; with no pinned bot, the zone is a dashed pill
    "Drag a bot here to pin it". Header avatars have no pin mark
    (`../design/components/top-header.md` §3).
  - **Others** by the `bot_order` setting: *Recent activity* (default): the bot with the latest
    message or run, in any conversation, comes first (`last_activity_at`, `../api.md` §4); bots
    with no activity follow, newest created first. *Created*: by creation time. Either can be
    newest first or oldest first. Clicking, hovering or opening a bot never changes the order.
  - Drag an avatar across the divider to pin it at the drop place, out of the zone to unpin it
    (it goes to its sorted place), or inside the zone to reorder. Alt+← and Alt+→ on a focused
    pinned avatar move it. Each change saves at once (`PUT /bots/pins`).
- UI-2.2: Tooltip with the bot name on hover or focus within 300 ms.
- UI-2.3: Unavailable bots show a small warning badge; tooltip adds the reason ("Model removed
  from catalog" / "API key not set").
- UI-2.4: Avatars are draggable (dnd-kit). While dragging over the area of an open
  conversation, the area shows an active dashed slot and the text "Drop to add <name> to this
  conversation", and the add slot (+) in the conversation header is active too. Bots already in
  the conversation and unavailable bots get no slot, and a tooltip says why ("Already here",
  "Researcher cannot run: API key not set"). A drop outside the conversation area does nothing.
  The drop place decides: in the header a drop pins, unpins or reorders (UI-2.1); in the
  conversation it adds the bot. The keyboard and touch alternative is **Add here** on the bot
  card (UI-2.6).
- UI-2.5: Dropping adds the bot (`../conversation-rules.md` §3); the history card appears within
  1 s.
- UI-2.6: Clicking an avatar opens the bot card (`../design/components/bot-card.md`). Only one
  card is open at a time. The card links to the bot's settings.
- UI-2.7: The roster uses the middle 6 of 12 page columns. When there are more bots than fit, the
  zone scrolls horizontally with fade edges, and ‹ › buttons show on hover and while keyboard
  focus is inside the header. On touch, a swipe scrolls it (`../design/components/top-header.md`).
- UI-2.8: The header holds the bot roster only, with no navigation links. Bots, Skills, Memory,
  Statistics and Settings open from the user panel menu (`../design/components/user-panel.md`).
  With no bots, the header shows a dashed "+" with "Hey, add your bot here 👋".
- UI-2.9: Deferred reordering (changes that come from activity). The order freezes when the pointer enters
  the header or focus moves into it, and stays frozen while the owner scrolls, drags, clicks or
  uses a bot's card; leaving with the pointer keeps it frozen. Activity that arrives meanwhile
  is recorded but no avatar moves. The pending order applies in one step at the next of these events:
  a click or key press **outside** the header; focus moves out of the header (for example to
  another window or tab); or the page or route changes. A pointer, keyboard or drag interaction
  in the header always keeps it frozen. The update moves no avatar one by one, does nothing when the order is
  unchanged, and keeps the scroll position where it can. Rule: avatars never move while the
  owner is engaging with the header. The owner's own pin, unpin or drag applies at once.
- UI-2.10: Keyboard: Tab reaches each avatar in display order, and the focused avatar scrolls
  into view. Arrow-key navigation between avatars is not provided (a later option).
- UI-2.11: The header is sticky: it stays at the top of the window on every page while the
  content below it scrolls (the conversation, the bot and skill pages, Settings, Statistics).
  Only the content area scrolls; the header and the conversation rail never scroll away.
- UI-1.13: The left navigation bar is sticky too: it fills the window height on every page and
  never scrolls with the content. When its list of projects and conversations is longer than
  the window, only that list scrolls inside the bar; the "+" button at the top and the user
  panel at the bottom stay in place. (A sticky bottom bar may come later; not specified.)

## First open and reopening (UI-1, continued)

- UI-1.7: When no conversation is open and setup is not finished, the main area shows a
  **Get started** checklist:
  1. *Model key*: "Anthropic key found ✓" for each provider with a key, or, when none is found,
     "Add a key: set `ANTHROPIC_API_KEY` (or another provider's) in `.env` and restart". Keys
     come only from the environment (`../security.md` §2.6), so there is no input box. The
     status comes from `GET /api/models`.
  2. *Skills*: "Create a skill", or "Load the examples", which imports the example skills and
     creates the BA and Designer bots (the same content as `make seed`).
  3. *Bot*: "Create a bot".
  4. *Conversation*: "Start a conversation" (the same as "+").
- UI-1.8: Each step ticks itself off from server state (a key is available, a skill exists, a
  bot exists, a conversation exists), not from clicks, so it is right after a reload or when
  the work was done elsewhere. When all four are done, the checklist is replaced by the
  normal empty state ("Pick a conversation or press +"). "Hide" dismisses it early, and Settings
  can show it again.
- UI-1.9: "Load the examples" is safe to press twice: existing example skills or bots are left
  as they are and reported ("BA already exists").
- UI-1.10: Opening the app at `/` opens the last conversation the owner had open in this
  browser. A link to a specific page (for example `/c/conv_…` or `/stats?…`) always wins. If
  the last conversation was deleted or never existed, the newest conversation opens; with none,
  the Get started checklist or the empty state shows.
- UI-1.11: An opened conversation scrolls to the "New" divider when there are unread messages
  (from the server's `last_read_seq`, UI-3.10), otherwise to the bottom.
- UI-1.12: Each conversation keeps the owner's unsent draft text in this browser until it is
  sent or cleared, so switching conversations or closing the app does not lose it. Attachments
  in a draft are not kept. Drafts never leave the browser and are never logged.

Where the reopen state lives in phase 1:

| State | Behaviour | Stored in |
| --- | --- | --- |
| Last open conversation | Opened at `/`; a link URL wins | Browser (`localStorage`) |
| Scroll position | "New" divider if unread, else bottom | Server (`last_read_seq`) |
| Draft text | Kept per conversation until sent | Browser (`localStorage`) |
| Flow pane (open, side, width, tab) | As left | Browser (`../flow-view.md` §2) |
| Theme, mode, density | As set | Browser (UI-8.5) |

Browser storage is wrapped in try/catch, parsed with Zod on read (`../frontend-conventions.md`),
and the app works without it. At M9, with several users, the first two browser rows move to the
server per user so they follow the user across devices.

## Trash page (UI-1, continued; M5b, D62)

Design: `../design/components/trash-page.md`.

- UI-1.14: **Trash** in the user panel menu opens the Trash page. It lists projects,
  conversations, bots, skills and memory items in Trash, newest delete first, with a kind
  filter and a count per kind. Items that went to Trash with their project are part of the
  project's row, not rows of their own.
- UI-1.15: Each row shows its kind, name, real counts, "Deleted {time}" and "Deletes on
  {date}", where the date is `deleted_at + trash_days` in local time. The buttons are
  **Restore** and **Delete**.
- UI-1.16: Restore puts the item back in its place (D47, D49, D50, D60, D62) and the toast links
  to it. A skill restore offers to assign the skill again to its active bots; a bot restore
  offers to add the bot again to its conversations that are not in Trash. Nothing is added
  without the owner's click.
- UI-1.17: When an item's place is in Trash, Restore is off with the tooltip "Restore {place}
  first" and a link to the place's row. The server refuses the restore with 409
  `place_in_trash` and changes nothing. A test calls the endpoint directly.
- UI-1.18: Delete removes the row and shows "{name} is deleted for good. Undo". The page sends
  the delete only when the toast closes, after `undo_seconds`. Undo sends nothing and the row
  comes back. A test checks that closing the page before the toast ends leaves the item in
  Trash.
- UI-1.19: With rows ticked, a bar shows "{n} selected · Clear · Restore {r} · Delete {d}". An
  item whose place is in Trash and not ticked is not counted in {r}. Ticking the place too
  restores the place first, then the item. One Undo toast covers a multi-delete. Each item is
  its own transaction: when one fails, the others still go through, and the toast names the one
  that failed.
