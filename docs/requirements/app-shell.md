# App shell, conversation rail and bot header

The frame around every page: the rail of conversations on the left and the bar of bots at the top.

## Stories

- **SH-1.** As the owner, I want every conversation as a round icon in a rail with a "+" at the top, so that I can switch and start conversations in one click.  
  Acceptance criteria: UI-1.1 to UI-1.6.
- **SH-2.** As the owner, I want all my bots visible in a header with name tooltips, so that I always know who is available.  
  Acceptance criteria: UI-2.1 to UI-2.3, UI-2.6 to UI-2.8.
- **SH-3.** As the owner, I want to drag a bot from the header into the chat, so that adding a bot feels direct.  
  Acceptance criteria: UI-2.4, UI-2.5.
- **SH-6.** As the owner, I want the header to show my most active bots first, or an order I choose, and never to shuffle while I am using it, so that I can find a bot without chasing it.  
  Acceptance criteria: UI-2.1, UI-2.9, UI-2.10, UI-4.5.
- **SH-4.** As the owner opening the app for the first time, I want a short checklist of what to set up, so that I reach my first bot reply without reading documentation.  
  Acceptance criteria: UI-1.7 to UI-1.9.
- **SH-5.** As the owner, I want the app to reopen where I left off, so that closing it costs me nothing.  
  Acceptance criteria: UI-1.10 to UI-1.12.

## Acceptance criteria

Shared rules for every story: `README.md` §Applies to every story. Layouts referenced below are sketches in `../design/`, not final designs.

## App shell and conversation rail (UI-1)

Layout sketch: see `../design/screens.md` §1 (not final).

- UI-1.1: The rail is always visible. The top item is a round "+" button; clicking it creates a
  conversation titled "New conversation" and opens it.
- UI-1.2: Each conversation is a 48 px round icon with a tooltip showing its title.
- UI-1.3: Icon content when `icon_preset` is NULL, from **active** members' avatars:
  0 bots → title initials on a neutral background; 1 → that avatar; 2 → two halves side by
  side; 3–4 → 2×2 grid; 5+ → three avatars and a "+N" tile. Removed bots are left out; deleted
  bots are drawn grey. When `icon_preset` is set, the preset replaces it.
- UI-1.4: The open conversation has an active indicator (pill on the left edge, as Discord).
  Conversations with unread messages show a dot.
- UI-1.5: Sorted by last activity, newest first.
- UI-1.6: Right-click or "…" on an icon: Rename, Conversation settings, Delete (confirmation
  dialog naming the conversation).

## Header (bot bar) (UI-2)

- UI-2.1: Shows every non-deleted bot as a 36 px round avatar. The order follows the
  `bot_order` setting:
  - **Recent activity** (default): the bot with the latest message or run, in any
    conversation, comes first (`last_activity_at`, `../api.md` §4). Bots with no activity
    follow, by name. Clicking, hovering or opening a bot never changes the order.
  - **Custom**: the order the owner saved on the Bots page (UI-4.5). Activity never changes it.
    A bot created later goes to the end.
- UI-2.2: Tooltip with the bot name on hover or focus within 300 ms.
- UI-2.3: Unavailable bots show a small warning badge; tooltip adds the reason ("Model removed
  from catalog" / "API key not set").
- UI-2.4: Avatars are draggable (dnd-kit). While dragging over the chat area of an open
  conversation, the area shows a drop highlight and the text "Add <name> to this conversation".
  Bots already in the conversation, unavailable bots, and drops outside the chat area do
  nothing and show why ("Already here").
- UI-2.5: Dropping adds the bot (`../conversation-rules.md` §3); the history card appears within
  1 s.
- UI-2.6: Clicking an avatar opens the bot detail page.
- UI-2.7: When there are more bots than fit, the bar scrolls horizontally with fade edges.
- UI-2.8: Right side: links to Bots, Skills, Statistics, Settings.
- UI-2.9: Deferred reordering (Recent activity only). The order freezes when the pointer enters
  the header or focus moves into it, and stays frozen while the owner scrolls, drags, clicks or
  uses a bot's card; leaving with the pointer keeps it frozen. Activity that arrives meanwhile
  is recorded but no avatar moves. The next click or key press **outside** the header applies
  the pending order in one step (no avatar-by-avatar movement), does nothing when the order is
  unchanged, and keeps the scroll position where it can. Rule: avatars never move while the
  owner is engaging with the header.
- UI-2.10: Keyboard: Tab reaches each avatar in display order, and the focused avatar scrolls
  into view. Arrow-key navigation between avatars is not provided (a later option).

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

