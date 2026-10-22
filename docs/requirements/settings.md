# Settings

Global settings and per-conversation settings.

## Stories

- **ST-1.** As the owner, I want global defaults for bot discussion, limits and timezone, so that new conversations behave the way I expect.  
  Acceptance criteria: UI-8.1, UI-8.4.
- **ST-2.** As the owner, I want a daily spending cap with warnings, so that a runaway discussion cannot surprise me with a bill.  
  Acceptance criteria: UI-8.2, UI-8.3.
- **ST-3.** As the owner, I want per-conversation title, icon, discussion settings and members, so that each conversation fits its purpose.  
  Acceptance criteria: UI-9.1 to UI-9.5.
- **ST-4.** As the owner, I want to choose the theme, light or dark mode, density and whether the Flow pane opens by default, so that the app looks and reads the way I like to work. *(D30.)*  
  Acceptance criteria: UI-8.5.

## Acceptance criteria

Shared rules for every story: `README.md` §Applies to every story. Layouts referenced below are sketches in `../design/`, not final designs.

## Settings page (UI-8)

- UI-8.1: Global defaults: bot discussion on/off, turn limit (1–20, default 5), runs per
  conversation per hour.
- UI-8.2: Model catalog (read-only): label, id, efforts, available or the missing key's
  **name** (never its value), and the price per million tokens with its source
  ("genai-prices", "override" or "unknown", D21). Unknown prices are flagged with how to add an
  override in `config/models.yaml`.
- UI-8.3: Daily spending cap in USD (empty = off), today's estimated spend with a progress bar,
  and a breakdown by provider and by bot (D20, D21). Each provider with a key also has an
  optional cap of its own (empty = only the total applies), with its spend and progress bar
  (D42). A run is refused when its provider's cap or the total is reached. At 75% and again at 90% of each cap (D40)
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

## Conversation settings (UI-9)

Opened from the conversation header or the rail menu.

- UI-9.1: Title.
- UI-9.2: Icon: "Default (bot avatars)" plus 10 presets as round tiles: rocket, lightbulb,
  code, palette, chart, book, flask, briefcase, chat bubble, star. Each has its own background
  colour. Choosing saves immediately; the rail updates. Presets are static SVGs in the
  frontend (Lucide glyphs, ISC licence). Upload is a later milestone.
- UI-9.3: Bot discussion: "Use global (off)" / On / Off, and the turn limit (inherit or 1–20).
- UI-9.4: Members with Remove.
- UI-9.5: Danger zone: Delete conversation.
- UI-9.6 *(D38)*: "Don't use memory" toggle. When on, bots in this conversation neither read nor
  save memory of any scope, and the header shows a small "Memory off" badge.
