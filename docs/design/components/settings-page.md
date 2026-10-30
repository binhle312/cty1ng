# Settings page

> **Status: agreed in the M5 global settings design review, round 14 (2026-10-26).** Previews:
> `../previews/command-dark/settings-pages.*` (the pages), `settings-save.*` (save states),
> `settings-appearance.*` (Appearance with page slides), `discussion-popover.*` (§9).
> Requirements: `../../requirements/settings.md` UI-8. Standards it uses: `buttons.md`,
> `time-format.md`, `../ui-rules.md`.

## 1. Where it opens

- From the Settings gear in the user panel, and from **Settings** in its menu (`user-panel.md`).
  The gear stays lit while the page is open.
- The page belongs to the whole app. Bar 2 is hidden and the rail stays, as on the Skills page
  (`skills-page.md` §1). The top header stays.
- Links from other places open one page of Settings directly: the daily cap notice opens
  **Spending** (`conversation-cards.md` §1), the popover link opens **Bot discussion** (§9).

## 2. Layout

Two columns, centred in the main area:

| Part | Rule |
| --- | --- |
| Settings list | 200 px wide. The title **Settings** (20 px, weight 600) above the list. One row per page, 32 px high. The open page has `surface-selected` fill, `on-surface` text, weight 600, and a 3 px `primary` bar at the left (the user panel menu pattern). A page from a later slice shows its slice tag at the right of the row (`ui-rules.md` P8) |
| Page column | 860 px wide, 40 px from the list. The page title (16 px, weight 600) has **no line under it**: the rows explain themselves (owner 2026-10-26) |

The list has these pages, in this order:

| Page | Slice | Content |
| --- | --- | --- |
| Profile | M5 | Your name (§4.1) |
| Spending | M5 | Daily cap and the caps per provider (§4.2) |
| Bot discussion | M5 | The global switch and turn limit (§4.3) |
| Limits | M5, rows from later slices | Safety caps for one conversation (§4.4) |
| New bots | M5 | Start values on the Create bot page (§4.5) |
| Models | M5 | Read-only model catalog (§4.6) |
| Appearance | M5 | Theme, mode, density, Flow pane, reduce motion, with page slides (§5) |
| Time | M7 | Timezone (§4.7) |
| Memory | M5b | The global memory switch (§4.8) |
| Trash | M5b | Days in Trash (§4.9) |
| Skill improvement | M5d | When Improve is offered, and the blind test size (§4.10) |

Each page is short, so the page column scrolls only on Limits on a small screen. There is no long
page with every setting.

## 3. Parts

Every page uses only these parts (owner 2026-10-26: one part for one job).

### 3.1 Setting row

| Part | Rule |
| --- | --- |
| Grid | Text column (the rest of the width) and control column (220 px, control at its right edge), 28 px apart. 16 px padding top and bottom, `outline` line under the row |
| Name | 13 px, weight 600, then the slice tag when the row belongs to a later slice |
| Effect | 12 px, `on-surface-muted`, line height 1.5. **What the owner notices** when the value changes, in one or two sentences (`../ui-rules.md` W9). Never only a range |
| Note | 11.5 px, `on-surface-muted`: the range and the default ("1 to 500. Default: 50"), or "Default: 5" when the rule has no range yet. A note can add one fact, for example "Existing bots keep their value." |
| Below | Optional: a spend meter (§3.4) or a link |
| Control | One of §3.2 |

A changed row gets the 3 px `primary` mark at its left edge, as on Project settings
(`project-settings-page.md` §3).

### 3.2 Controls

| Control | Use | Rule |
| --- | --- | --- |
| Number box | Every number | 170 px × 34 px, `surface` fill, `outline-strong` border, radius 8 px. The value at the left, the unit at the right in `on-surface-muted` ("runs", "USD", "%"). An empty optional box shows "No cap" in `on-surface-muted`. Out of range: `danger` border and the field error pattern (`new-project-page.md` §4) |
| Switch | Every on/off | The agreed toggle. "Always reduce motion" is a switch too, not a tick box |
| Segmented control | A choice of 2 to 4 named values | The agreed segmented control. The selected value has `primary-tint` fill and `primary` text |
| Dropdown | Only a long list (Timezone) | 34 px, the chevron at the right |

### 3.3 Table

Read-only lists (Models) use one table: a header row in 11 px weight 600 `on-surface-muted`, rows
of 12 px with 9 px padding and an `outline` line under each. Model ids and key names use the mono
font at 11 px (`../ui-rules.md` L1; was 10.5 px, shell review 2026-10-30).

### 3.4 Spend meter

A 6 px bar (`surface-raised` track, `success` fill) under the row text, 300 px wide, with
"$6.20 of $10.00 today" (11.5 px) under it. The fill colour follows the budget battery rule
(`user-panel.md` §3).

## 4. Pages

The texts below are the agreed labels. Values are the defaults in `../../domain-model.md` §10.

### 4.1 Profile

| Row | Effect | Note | Control |
| --- | --- | --- | --- |
| Your name | Shows in the user panel. Its first letter is your avatar. | 1 to 32 characters. Default: Sir | Text box, 220 px |

The app trims spaces at the start and end before it checks the name. An empty name shows the
field error "Enter a name." A name longer than `display_name_max` (default 32) shows "Use 32
characters or fewer." with the number from the setting. While the field has an error, **Save
changes** stays off. The server checks again and returns 422 (`../../api.md` §7).

### 4.2 Spending (UI-8.3, D20, D40, D42)

| Row | Effect | Note | Control |
| --- | --- | --- | --- |
| Daily cap | When today's spend for all providers reaches this cap, bots stop until midnight. A run that is running finishes. You get a warning at 75 % and at 90 %. | Empty = no cap. Estimate only: also set limits in your providers' consoles. | Number box, USD; meter below |
| {Provider} cap | When {Provider} spend reaches this cap, only bots on {Provider} models stop. Other bots keep working. | Empty = only the daily cap applies. Key: {ENV_NAME} | Number box, USD; meter below when set |

- One provider row for each provider with a key, in the order of `config/models.yaml`. A provider
  with no cap says "No cap of its own. {Provider} bots stop only at the daily cap. Today: $0.50."
- Under the rows: "Spend by bot and by model: **Statistics**" (a link, M7 tag until M7 ships).
  Settings shows no spend table: spend by bot belongs to the Statistics page (owner
  2026-10-26, UI-10.4).

### 4.3 Bot discussion (UI-8.1, conversation-rules §2)

| Row | Effect | Note | Control |
| --- | --- | --- | --- |
| Bots can reply to bots | On: a bot that mentions another bot starts that bot, so bots can discuss without you. Off: only your messages start bots. | Default: off. Each conversation can change it with the discussion status in its header. | Switch |
| Turn limit | Bot replies to bots before the bots stop and wait for you. A higher limit gives longer discussions and more spend. It also applies when the switch is off: a conversation that turns discussion on uses this limit. | 1 to 20. Default: 5 | Number box, turns |

The turn limit stays on when the switch is off, because it is the default for every conversation
that turns discussion on in its header (owner question 2026-10-26).

### 4.4 Limits (UI-8.1, conversation-rules §9)

| Row | Tag | Effect | Note |
| --- | --- | --- | --- |
| Runs per hour | | At the cap, the app refuses new runs in that conversation until the oldest run is one hour old. A notice says so. | 1 to 500. Default: 50 |
| Handoffs per 24 hours | M6 | At the cap, bots cannot hand work to other bots in that conversation. You can still mention bots. | 1 to 50. Default: 5 |
| Skill drafts per run | M5c | A bot can propose this many skill drafts in one run. Each draft is a card that you review. | 1 to 10. Default: 3 |
| Skill drafts waiting | M5c | When this many drafts wait for your decision, bots cannot propose more until you decide. | 1 to 50. Default: 10 |
| Shares per 24 hours | M5b | Bot proposals to send information to another conversation. At the cap, the bot tells you that it cannot send more. | 1 to 50. Default: 5 |
| Search hits | M5b | Results that one search in other conversations of the project gives a bot. More hits give the bot more context and make the run cost more. | 1 to 50. Default: 10 |
| Copy proposals per 24 hours | M6 | Bot proposals to copy files to another Library. At the cap, the bot tells you. You can still copy files. | 1 to 50. Default: 5 |
| Plan mark reminders | Plan card | Before an action run ends, the app reminds the bot to mark the plan steps that it did not mark. 0 = no reminder. | 0 to 3. Default: 1 |

Every control is a number box with its unit (runs, handoffs, drafts, shares, hits, proposals,
reminders).

### 4.5 New bots (UI-5.8)

| Row | Effect | Note |
| --- | --- | --- |
| History share | How much of the model context a new bot uses for the conversation history. More history: the bot knows more of the conversation, and each reply costs more. | 10 to 80. Default: 40. Existing bots keep their value. |
| Request limit | Model requests in one run. At the limit, the run stops and says so. A higher limit allows bigger tasks and more spend. | 1 to 100. Default: 30. Existing bots keep their value. |
| Reply length | The longest reply of a new bot. Longer replies give more detail and take longer to read. | 500 to 20,000 characters. Default: 6,000. Existing bots keep their value. |

### 4.6 Models (UI-8.2)

- The table (§3.3): Label, Model id, Efforts, Key, Price in / out, Source. Key shows ✓ and the
  variable **name** in `success`, or "Not set:" and the name in `danger`. A price that is not
  known shows "Unknown" in `danger`, with Source "unknown".
- Under the table: "Prices are in USD per million tokens." A row with an unknown price adds:
  "This model has no known price. When the daily cap or this model's provider cap is on,
  requests that use it are refused. Add a price (`price_override_per_mtok`) in
  config/models.yaml to use it under a cap." (D42 amendment 2026-10-27.)
- No save bar: the page has nothing to save.

### 4.7 Time (UI-8.4, M7)

| Row | Effect | Note | Control |
| --- | --- | --- | --- |
| Timezone | Every time range picker and every chart uses this zone. A day in a chart starts at midnight in this zone. | Default: Local (this browser) | Dropdown, 220 px |

### 4.8 Memory (UI-8.6, M5b)

| Row | Effect | Note | Control |
| --- | --- | --- | --- |
| Bots use memory | Off: no bot reads or saves memory. Saved items stay and come back when you turn it on. | Default: on | Switch; the link **Open the Memory page** below |
| Characters per item | A longer item holds more detail, and each run that reads memory costs more. Items saved before keep their text. | 100 to 1,000. Default: 300 | Number box, characters |
| Items per place | More items let bots keep more facts, and each run that reads memory costs more. A lower number deletes nothing: a place over it takes no new item until you delete or tidy. | 10 to 200. Default: 50 | Number box, items |

### 4.9 Trash (D49, M5b)

| Row | Effect | Note | Control |
| --- | --- | --- | --- |
| Keep items in Trash | After this time, the app deletes an item for good. A shorter time gives you less time to restore a mistake. | At least 1. Default: 30 | Number box, days |

### 4.10 Skill improvement (D51, M5d)

| Row | Effect | Note |
| --- | --- | --- |
| Feedback signals | Improve shows for a bot after this many of your ratings and notes. A lower number gives earlier offers from less evidence. | 1 to 50. Default: 3 |
| Conversations | The signals must come from this many conversations, so one bad day does not start it. | 1 to Feedback signals. Default: 2 |
| Bad signals | At least this many signals must be negative: Bad answer, Reject or a rejected draft. | 1 to Feedback signals. Default: 1 |
| Probe tasks | Tasks in a blind test of the new skill version. More tasks give a surer result and cost more. | 1 to Probe tasks, most. Default: 3 |
| Probe tasks, most | The highest number of tasks that you can choose for one test. | 1 to 50. Default: 10 |
| Test cases, most | Saved tasks that each skill keeps. Every test of a new version runs them first, so you see when a change breaks a task that worked before. | 1 to 20. Default: 5 |

Ranges and cross-field checks: `../../domain-model.md` §10. A value that breaks a rule between two
rows (for example Feedback signals lower than Conversations) shows the error on the row that
changed and keeps **Save changes** off; the app never changes the other row. For an actual
probe, the owner chooses 1 to the number of eligible tasks (the skill's saved test cases plus the
past tasks behind the signals), at most Probe tasks, most (D51, amendment 2026-10-27). With no
eligible task, the probe action is off. A lower Test cases, most never deletes a saved test case.
The new row is part of the M5d UI design checkpoint.

## 5. Appearance page (UI-8.5, D30)

- **Controls on top**, two in each row: Theme (Command, Material with the tag "Material: T2"),
  Mode (Follow system, Light, Dark), Density (Theme default, Compact), Flow pane (the choices in
  UI-8.5, with a slice tag on a later choice). Each has one effect line under it. Then the switch
  **Always reduce motion**: "Stops animations everywhere, also when your computer allows them. The
  Flow pane Animations switch shows the same value."
- **Preview** under the controls, the full page width (860 × 540 px). The line beside the title
  names the current choices and says "Saves at once, in this browser only."
- **Page slides** (owner 2026-10-26): the preview shows one whole screen at a time, scaled down,
  with the rail, bar 2 or the user panel, and the top header. Slides: Conversation, Bots, Bot page,
  Skills, Project settings, Settings. A tab row above the preview picks a slide; **‹** and **›**
  (30 px icon buttons, `aria-label` "Previous page" and "Next page") step through them, and
  "{n} of 6" shows the place. The slides wrap around.
- A change of any control redraws every slide at once, with no reload.
- No save bar: Appearance saves at once in this browser (UI-8.5).

## 6. Saving

- Every page except Models and Appearance has the save bar of Project settings
  (`project-settings-page.md` §3): "All changes are saved." with **Save changes** off; after a
  change, a `primary` dot, "{n} changes not saved", **Discard** and **Save changes**.
- After a save, the page shows the saved values, the change marks go away, **Save changes** is
  off, and the toast says "Saved ✨" on every Settings page. Each row's text already says when
  the change applies. A page opened again later shows the same saved values.
- A value out of range keeps **Save changes** off and shows the field error. The server checks
  again and returns 422 (`../../api.md` §7).
- A click on another page in the Settings list, or anywhere outside Settings, with unsaved
  changes asks first, as Project settings does (`project-settings-page.md` §5).
- If the save fails, the page keeps the values and shows "The app could not save the changes.
  Try again." It never shows internal error text.

## 7. States

| State | What shows |
| --- | --- |
| Loading | The Settings list at once; the page column uses the shared `Skeleton` |
| No key for any provider | Spending shows only the daily cap; Models shows every model with "Not set:" |
| A later slice not built | Its list row and its rows are not shown. The design boards show them with the slice tag (`../ui-rules.md` P8) |

## 8. Not on the Settings page

| Setting | Where the owner changes it |
| --- | --- |
| `bot_order`, `bot_order_direction` | The sort buttons on the Bots page (`bots-page.md` §5) |
| Form limits (`display_name_max`, `bot_name_max`, `bot_description_max`, `bot_persona_max`, `bot_history_min_pct`, `bot_history_max_pct`) and health thresholds (`health_*`) | `PATCH /settings` only. They are close to security size checks or rarely changed |
| Memory history versions (UI-13.9) | Project settings and the bot page (per project, per bot) |
| "Don't use memory" for one conversation (UI-9.6) | The Memory pane |
| Discussion for one conversation (UI-9.3) | The discussion status in the conversation header (§9) |
| `undo_seconds` (D62) | `PATCH /settings` only. The time an Undo toast of a permanent delete stays |
| `library_diff_open_max_lines` (round 17) | `PATCH /settings` only. A file in the Library History tab with more changed lines starts folded (`library-page.md` §4.1) |

## 9. Discussion status and popover in the conversation header (UI-3.15, UI-9.3)

The conversation header part lives in `conversation-page.md` §2.4. It uses the controls of this
page, so the same choice looks the same in both places.
