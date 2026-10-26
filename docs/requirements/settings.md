# Settings

Global settings, and where each per-conversation setting lives (there is no conversation
settings page).

## Stories

- **ST-1.** As the owner, I want global defaults for bot discussion, limits and timezone, so that new conversations behave the way I expect.  
  Acceptance criteria: UI-8.1, UI-8.4.
- **ST-2.** As the owner, I want a daily spending cap with warnings, so that a runaway discussion cannot surprise me with a bill.  
  Acceptance criteria: UI-8.2, UI-8.3.
- **ST-3.** As the owner, I want to change a conversation's title, discussion settings, members and memory where I see them, so that each conversation fits its purpose without a separate settings page.  
  Acceptance criteria: UI-9.1, UI-9.3 to UI-9.7.
- **ST-4.** As the owner, I want to choose the theme, light or dark mode, density and whether the Flow pane opens by default, so that the app looks and reads the way I like to work. *(D30.)*  
  Acceptance criteria: UI-8.5.

## Acceptance criteria

Shared rules for every story: `README.md` §Applies to every story. Layouts referenced below are sketches in `../design/`, not final designs.

## Settings page (UI-8)

Design: `../design/components/settings-page.md` (round 14).

- UI-8.0: Layout: a Settings list at the left and one short page for each item: Profile,
  Spending, Bot discussion, Limits, New bots, Models, Appearance, Time, Memory, Trash, Skill
  improvement. Every setting is one row with its name, what the owner notices when it changes,
  and its range or default (owner 2026-10-26). A page saves with the save bar, except Models
  (read-only) and Appearance (saves at once).
- UI-8.1: Bot discussion: the global switch (default off) and turn limit (1–20, default 5). The
  turn limit stays on when the switch is off, because a conversation that turns discussion on
  uses it. Limits: runs per conversation per hour and the other conversation limits
  (`../conversation-rules.md` §9), `share_max_per_conversation_24h`, `cross_search_max_hits`,
  `copy_proposals_max_per_conversation_24h` and `plan_mark_reminders`. A row shows only when
  its slice ships.
- UI-8.2: Model catalog (read-only): label, id, efforts, available or the missing key's
  **name** (never its value), and the price per million tokens with its source
  ("genai-prices", "override" or "unknown", D21). Unknown prices are flagged with how to add an
  override in `config/models.yaml`.
- UI-8.3: Daily spending cap in USD (empty = off), today's estimated spend with a progress bar
  (D20, D21). Each provider with a key also has an
  optional cap of its own (empty = only the total applies), with its spend and progress bar
  (D42). Spend by bot and by model is on the Statistics page (UI-10.3, UI-10.4), not in
  Settings (owner 2026-10-26); the Spending page links to it. A run is refused when its provider's cap or the total is reached. At 75% and again at 90% of each cap (D40)
  the owner gets a banner across the app, a toast, and a system line in each conversation with
  a queued or running run; each fires once per day. At 100% a banner says bots have stopped. Note under the field: "Estimate only. Also set limits in your providers' consoles."
- UI-8.4: Time settings: timezone (Local / UTC / any IANA zone) used by every time range
  picker and by server-side bucketing (`time-range-picker.md`, contract with the backend).
- UI-8.5 *(D30)*: Appearance: theme (Command; Material appears when slice T2 ships), mode
  (Follow system / Light / Dark), density (Theme default / Compact), Flow pane default (Closed /
  Team / Timeline / Board; Board appears with M8b), and "Always reduce motion". Changes apply instantly without reload,
  are saved in this browser, and the page never flashes the wrong theme on load
  (`../design/themes.md` §1, §2).
- UI-8.6 *(D38)*: Memory: a global switch. When off, no bot reads or saves memory anywhere;
  saved items are kept and return when it is turned back on. A link opens the Memory page.
- UI-8.7: Profile: the owner's display name (`display_name`, default "Sir"). The user panel
  shows it, and its first letter is the owner avatar (`../design/components/user-panel.md`).
- UI-8.8: New bots: the start values of the Create bot page (`bot_default_history_pct`,
  `bot_default_request_limit`, `bot_default_max_reply_chars`, UI-5.8). A change does not change
  existing bots.
- UI-8.9 *(D49)* (M5b): Trash: `trash_days`, a whole number of days, at least 1 (0 would delete at once, with no restore), no upper limit, default 30.
- UI-8.10 *(D51)* (M5d): Skill improvement: the five `improve_*` settings.

## Conversation settings (UI-9)

There is no conversation settings page (round 12, owner 2026-10-25). Each setting is where the
owner sees it. Designs: `../design/components/conversation-page.md` §2 and
`../design/components/memory-pane.md` §1.1.

- UI-9.1: Title: a click on the title in the conversation header, or **Rename** in the
  conversation menu (UI-9.7), edits it in place.
- UI-9.2: *Removed (round 12).* No preset icons: the icon always comes from the bot avatars
  (UI-1.3).
- UI-9.3: Bot discussion (M5): a click on the discussion status in the header ("Discussion:
  on · 3/5 used") opens a popover with "Global (off)" / On / Off and the turn limit "Global (5)" /
  Custom, where Custom is a number input in place (1–20). A change saves at once and applies
  from the next bot message (`../design/components/conversation-page.md` §2.4).
- UI-9.4: Members: in the header, with the add slot and the members menu (UI-3.15).
- UI-9.5 (M5b): Delete: **Delete** in the conversation menu (UI-9.7) sends the conversation to Trash
  (D60, UI-1.6).
- UI-9.6 *(D38)* (M5b): "Don't use memory" toggle, at the top of the Memory pane for this
  conversation. When on, bots in this conversation neither read nor save memory of any scope,
  and the header shows a small "Memory off" badge.
- UI-9.7: The conversation menu opens from ⋯ on the bar 2 row (on hover or focus) and from ⋯ in
  the conversation header. Both have the same items: Rename, Memory (opens the Memory pane,
  D44), Move to project (only for a Home conversation: a project conversation stays in its
  project, D61), a divider, then **Delete** in `danger` text.
