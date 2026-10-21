# Settings

Global settings and per-conversation settings.

## Stories

- **ST-1.** As the owner, I want global defaults for bot discussion, limits and timezone, so that new conversations behave the way I expect.  
  Acceptance criteria: UI-8.1, UI-8.4.
- **ST-2.** As the owner, I want a daily spending cap with warnings, so that a runaway discussion cannot surprise me with a bill.  
  Acceptance criteria: UI-8.2, UI-8.3.
- **ST-3.** As the owner, I want per-conversation title, icon, discussion settings and members, so that each conversation fits its purpose.  
  Acceptance criteria: UI-9.1 to UI-9.5.
- **ST-4.** As the owner, I want to choose the theme, light or dark mode, density and the default conversation view, so that the app looks and reads the way I like to work. *(Proposed, D30.)*  
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
  and a breakdown by provider and by bot (D20, D21). A banner across the app appears at 80% and
  at 100%. Note under the field: "Estimate only. Also set limits in your providers' consoles."
- UI-8.4: Time settings: timezone (Local / UTC / any IANA zone) used by every time range
  picker and by server-side bucketing (`time-range-picker.md`, contract with the backend).
- UI-8.5 *(proposed, D30)*: Appearance: theme (Command / Material), mode (Follow system /
  Light / Dark), density (Theme default / Compact), default conversation view (Chat /
  Chat + Board / Board), and "Always reduce motion". Changes apply instantly without reload,
  are saved in this browser, and the page never flashes the wrong theme on load
  (`../design/themes.md` §1, §2).

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
