# Bots

Creating, cloning, deleting and configuring bots, including skill pins and avatars.

## Stories

- **BT-1.** As the owner, I want a list of my bots with model, skills, status and health, so that I can manage them at a glance.  
  Acceptance criteria: UI-4.1 to UI-4.3, UI-4.6 to UI-4.8.
- **BT-2.** As the owner, I want to create a bot with a fixed model and effort, so that its behaviour stays stable.  
  Acceptance criteria: UI-5.1 to UI-5.3, UI-5.5 to UI-5.8.
- **BT-3.** As the owner, I want to clone a bot into a prefilled form I can change, so that I can try another model or retire an old one.  
  Acceptance criteria: UI-4.4, UI-5.4, UI-6.1, UI-6.2.
- **BT-4.** As the owner, I want to pin, upgrade, downgrade and always-load skills per bot, so that skill changes never surprise me.  
  Acceptance criteria: UI-6.3 to UI-6.6.
- **BT-5.** As the owner, I want to change a bot's avatar, name and persona and see its usage, so that I can shape and monitor it.  
  Acceptance criteria: UI-6.1, UI-6.7, UI-6.8.
- **BT-6.** As the owner, I want to pin the bots I care about in my own order, and sort the others, so that the bots I use most are where I expect them on the Bots page and in the header.  
  Acceptance criteria: UI-4.5 (header behaviour: `app-shell.md` UI-2.1, UI-2.9).

## Acceptance criteria

Shared rules for every story: `README.md` §Applies to every story. Layouts referenced below are sketches in `../design/`, not final designs.

## Bots page (UI-4)

Design: `../design/components/bots-page.md` (agreed, round 9).

- UI-4.1: A grid of V3 cards in two groups, **Pinned** (shown only when a bot is pinned) and
  **Others**. Each card: bot-colour band, 72 px avatar with the state badge, name, model and
  effort badge, description (2 lines), numbers of skills (with "↑n" when skill updates exist),
  projects and conversations, a health line when needed, and the status line
  (`../design/components/bot-status.md`). A click on a card opens the bot page.
- UI-4.2: Page action **+ Create**. The ⋯ menu on each card: Details, Message, Clone, Delete
  (`danger`), with dividers before Clone and before Delete. Message comes with M3; M2 hides it.
- UI-4.3: Delete asks for confirmation ("Messages from BA will stay, greyed") and moves the bot
  to Trash (D50): it disappears from the header and this page, and its messages stay.
- UI-4.4: Clone opens the Create page prefilled from `clone-template`: name "<name> (copy)",
  description, persona, avatar style, model, effort, Advanced values, tool
  switches, and pins (with versions and always-load). All editable before saving. Cancel creates
  nothing. The page opens on step 4, Model, with every step ✓ (`../design/components/create-bot-page.md` §6).
  The suggested name fits the name limit and is free ("(copy 2)" when "(copy)" is taken). A model
  change turns off copied tools the new model does not have and says which ones (§3.0 there).
- UI-4.5: **Order.** Pinned bots come first, in the owner's order; the others follow by the
  `bot_order` setting: *Recent activity* (default; bots with no activity follow, newest created
  first) or *Created*, each newest first or oldest first. Two sort buttons beside the Others
  title switch the sort; a click on the sort that is on flips the direction. Pin and unpin use
  the corner badge (`../design/components/pin.md`). A drag inside the Pinned group, or Alt+← and
  Alt+→ on a focused pinned card, reorders. Each pin, unpin and reorder saves at once: the
  page sends the whole pinned list (`PUT /bots/pins`). If a listed bot was deleted meanwhile,
  the save fails with 409 `bot_list_changed`; the page reloads the order and shows "The bot list
  changed. Try again." The header uses the same order.
- UI-4.6: **Health.** A card shows one health line when needed, the first that applies: *Cannot
  run* (`danger`: no API key, or the model is not in the catalog) or *Needs attention*
  (`primary`: {n} of the last {m} runs failed; runs stopped at the request limit this week; uses
  a deprecated skill; the last run cut history to fit the context). Thresholds are settings
  (`health_failed_runs` 2, `health_recent_runs` 5, `health_limit_stops` 3 in 7 days). Health is
  computed on read; nothing is stored.
- UI-4.7: **Search** filters cards by name, slug, description and model label while the owner
  types. Empty groups hide. Esc clears. Drag is off while a search is on. No match: 'No bots match
  "{text}". Check the spelling, or clear the search.'
- UI-4.8: **Empty state** with no bots: "It is quiet here", the sleepy grey slime and
  **+ Create**. Search and the sort buttons are hidden.

## Create bot page (UI-5)

Design: `../design/components/create-bot-page.md` (agreed, round 9).

- UI-5.1: A page of its own with four steps and a live preview card: **Basics** (name ≤ 32,
  description ≤ 160 in a 3-line box, avatar style Flat / Jelly / Pixel / Upload image, colour from
  the theme's 10 swatches, Custom or Random, with a random unused swatch as default (the page
  picks it; the palette is frontend only); used colours are not
  shown), **Persona** (≤ 8,000, Markdown, Write / Preview, with
  the persona template as placeholder), **Skills** (optional; tick non-deprecated skills, each
  pinned to its latest version, with an Always load switch), **Model** (model, effort shown only
  if the model has efforts with `default_effort` preselected, the Tools list, and Advanced always
  open: history share slider 10–80 %, step 5, default 40 % with the live label "≈ 400k tokens of
  1M. 600k are left for work." (D32); model requests per run, default 30; longest reply, default
  6,000 characters). There is no Review step: the preview card is the review, and **Create** is on
  step 4. Models with no API key are grey with the reason.
- UI-5.2: Model and effort show the note "You cannot change the model or the effort after you
  create the bot. To use another one later, clone the bot."
- UI-5.3: Validation errors per field, under the field (unique name, Trash included, compared
  by the name key of `../domain-model.md` §2; effort supported; sizes). The page's own name check
  uses the bots it has and is only a hint: names in Trash are not in that list, so the server's
  `name_taken` on Create shows under Name on step 1. Next keeps the owner on a step with errors. The server
  checks again on Create: steps with a problem get a red "!" in the stepper and a red (!) icon
  in the preview card, and nothing is created.
- UI-5.4: When opened from Clone, a banner says "Cloning BA" and links to the original.
- UI-5.5: **Tools.** One list with a switch and a badge per tool: Internal (run by the app, on by
  default) or the provider name (run on the provider's servers, off by default). Order: internal
  only, then both, then provider only; then by the date the tool was added to the catalog. A job
  that both can do is one row with Off / Internal / {Provider}; only one is on (D55).
  Provider tool switches work from the milestone that builds them (D53).
- UI-5.6: **Sending.** Create is off with a "Creating" spinner, Back is off and the form is
  read-only while the request is on its way. A double click sends one request. A failure that is
  not about the input shows a banner with Try again, which sends the same request with the same
  `Idempotency-Key`, so a retry never creates two bots.
- UI-5.7: **Leave.** With input, Cancel, ← Back or any navigation asks "Leave without creating?"
  with Stay and Leave. With nothing typed, the owner leaves at once. No draft is saved.
- UI-5.8: The limits in UI-5.1 (name, description, persona, history range) and the Advanced
  defaults are settings with defaults, not numbers in the code (`../domain-model.md` §10).

## Bot detail page (UI-6)

Design: `../design/components/bot-page.md` (agreed, round 9, except the Memory tab).

- UI-6.0: URLs: `/bots`, `/bots/{slug}?tab=…`, `/bots/new`, `/bots/new?from={bot id}`
  (`../design/components/bot-page.md` §1, `create-bot-page.md` §7). In M2 the Memory tab is
  hidden (M5b) and the Usage tab shows its empty state (UI-6.8).
- UI-6.1: The edit layout: the bot list on the left, the bot page on the right, at
  `/bots/{slug}`. The page top shows the band in the bot colour, the 116 px avatar, name and
  slug, the locked model badge, the status line, Message and ⋯. Tabs: Profile, Skills, Model,
  Memory, Activity, Usage. **Profile** edits Appearance (avatar style, colour by swatch, Custom
  or Random, or an uploaded PNG/JPEG/WebP ≤ 2 MB with a crop card), Basics (name, description)
  and Persona, with one save bar; a change applies from the next run. The big avatar and the band
  show an avatar change at once ("Not saved"); the rest of the app after Save. A colour change
  recolours the Flat, Jelly and Pixel cards, never an uploaded image
  (`../design/components/bot-avatar.md` §5, §6). **Model** holds the Tools and Advanced fields,
  which can change; model and effort show only in the locked badge at the top, and Clone (⋯
  menu) picks another model.
- UI-6.2: A bot that cannot run shows a banner with the reason and Clone. Clone of a bot whose
  model is gone opens with the model field empty and its error (CL2). Clone of a bot whose model
  has no API key keeps the model, shown unavailable, and Create stays off until the key is set
  or another model is picked (`../design/components/create-bot-page.md` §6).
- UI-6.3: Skills table: name, description, pinned version, always-load toggle, Remove.
  Changes save immediately and apply to the next run.
- UI-6.4: When a newer version exists, the row shows "v3 → v5 available"; clicking opens a diff
  (body and description) with changelogs of the versions in between, and "Upgrade to v5". A
  version menu allows choosing any version (downgrade).
- UI-6.5: Deprecated skills show a badge and tooltip "Deprecated by its author; keeps working".
- UI-6.6: "Add skills" opens a picker of non-deprecated skills not yet assigned; adding pins
  the latest version.
- UI-6.7: Lists the conversations this bot is in (links).
- UI-6.8: Usage: five tiles (task success, plans approved first time, runs finished, cost per
  successful task, you wait), each with a status chip against an optional target and a trend chip,
  then three views: Results, Changes (before and after a setup change) and Causes, for the range
  of the time range picker (`time-range-picker.md`, default "Last 7 days") (D21). Every rate shows
  its count. Runs without prices show "cost unknown" (`../design/components/bot-page.md` §9).
