# Bots

Creating, cloning, deleting and configuring bots, including skill pins and avatars.

## Stories

- **BT-1.** As the owner, I want a list of my bots with model, skills and availability, so that I can manage them at a glance.  
  Acceptance criteria: UI-4.1 to UI-4.3.
- **BT-2.** As the owner, I want to create a bot with a fixed model and effort, so that its behaviour stays stable.  
  Acceptance criteria: UI-5.1 to UI-5.3.
- **BT-3.** As the owner, I want to clone a bot into a prefilled form I can change, so that I can try another model or retire an old one.  
  Acceptance criteria: UI-4.4, UI-5.4, UI-6.1, UI-6.2.
- **BT-4.** As the owner, I want to pin, upgrade, downgrade and always-load skills per bot, so that skill changes never surprise me.  
  Acceptance criteria: UI-6.3 to UI-6.6.
- **BT-5.** As the owner, I want to change a bot's avatar, name and persona and see its usage, so that I can shape and monitor it.  
  Acceptance criteria: UI-6.1, UI-6.7, UI-6.8.
- **BT-6.** As the owner, I want to choose how bots are ordered in the header, and set my own order, so that the bots I care about are where I expect them.  
  Acceptance criteria: UI-4.5 (header behaviour: `app-shell.md` UI-2.1, UI-2.9).

## Acceptance criteria

Shared rules for every story: `README.md` §Applies to every story. Layouts referenced below are sketches in `../design/`, not final designs.

## Bots page (UI-4)

- UI-4.1: Grid of cards: avatar, name, model label, effort, number of skills (and "n updates
  available"), availability badge.
- UI-4.2: Actions per card: Open, Clone, Delete. Page action: "Create bot".
- UI-4.3: Delete asks for confirmation ("Messages from BA will stay, greyed"), soft-deletes,
  and the bot disappears from the header and this page (a "Show deleted" filter shows it).
- UI-4.4: Clone opens the create page prefilled from `clone-template`: name "<name> (copy)",
  persona, avatar, model, effort, pins (with versions and always-load), write paths. All
  editable before saving. Cancel creates nothing.
- UI-4.5: **Header order**: a choice of *Recent activity* (default) or *Custom*, saved in the
  `bot_order` setting. With Custom, the page lists the bots in their header order; the owner
  reorders them by dragging or with Move up / Move down buttons (the keyboard and touch
  alternative to dragging), then **Save order** writes the whole order at once
  (`PUT /bots/order`). If a bot was created or deleted meanwhile, saving fails with "The bot
  list changed. Review the order and save again" and the list reloads. Switching back to
  Recent activity keeps the saved custom order for next time. The layout is decided at the M2
  UI checkpoint.

## Create bot page (UI-5)

- UI-5.1: Fields: name; one-line description (≤ 160 chars, "shown to other bots"); avatar (upload with preview, or the generated default); persona
  (Markdown editor with preview); model (only available catalog models); effort (shown only if
  the model has efforts, defaulting to `default_effort`); skills (multi-select of
  non-deprecated skills, each pinned to its latest version, with an always-load toggle); write
  paths (default `out/<slug>/`, slug previewed from the name); advanced limits (collapsed): model requests per run,
  max reply length. History share is a slider, not hidden: "History: 40 % of context" (10–80 %,
  step 5, default 40), with a live label from the model's context window ("≈ 400k tokens of
  1M; 600k left for work"). Arrow keys move it by 5 and the value can also be typed (D32).
- UI-5.2: Model and effort show the note "Cannot be changed after creation. To switch later,
  clone this bot."
- UI-5.3: Validation errors per field (unique name, effort supported, sizes).
- UI-5.4: When opened from Clone, a banner says "Cloning BA" and links to the original.

## Bot detail page (UI-6)

- UI-6.1: Header: avatar (click to change: upload PNG/JPEG/WebP ≤ 2 MB, preview, save), name
  and persona editable inline, model and effort read-only with "Clone with another model".
- UI-6.2: Unavailable bots show a banner with the reason and the clone action.
- UI-6.3: Skills table: name, description, pinned version, always-load toggle, Remove.
  Changes save immediately and apply to the next run.
- UI-6.4: When a newer version exists, the row shows "v3 → v5 available"; clicking opens a diff
  (body and description) with changelogs of the versions in between, and "Upgrade to v5". A
  version menu allows choosing any version (downgrade).
- UI-6.5: Deprecated skills show a badge and tooltip "Deprecated by its author; keeps working".
- UI-6.6: "Add skills" opens a picker of non-deprecated skills not yet assigned; adding pins
  the latest version.
- UI-6.7: Lists the conversations this bot is in (links).
- UI-6.8: Usage: runs, tokens (input, output, cache) and estimated cost for the range chosen in
  a time range picker (`time-range-picker.md`, default "Last 7 days"), with a small chart (D21). Runs without
  prices show "cost unknown".
