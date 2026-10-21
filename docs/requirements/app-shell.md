# App shell, conversation rail and bot header

The frame around every page: the rail of conversations on the left and the bar of bots at the top.

## Stories

- **SH-1.** As the owner, I want every conversation as a round icon in a rail with a "+" at the top, so that I can switch and start conversations in one click.  
  Acceptance criteria: UI-1.1 to UI-1.6.
- **SH-2.** As the owner, I want all my bots visible in a header with name tooltips, so that I always know who is available.  
  Acceptance criteria: UI-2.1 to UI-2.3, UI-2.6 to UI-2.8.
- **SH-3.** As the owner, I want to drag a bot from the header into the chat, so that adding a bot feels direct.  
  Acceptance criteria: UI-2.4, UI-2.5.

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

- UI-2.1: Shows every non-deleted bot as a 36 px round avatar, sorted by name.
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
