# Bot page

> **Status: agreed in the M2 Bots UI design review, round 9 (2026-10-23 and 2026-10-24),** except
> the Memory tab (M5b). The Usage tab (§9) was approved on 2026-10-24 as a design; the data it
> needs is not specified yet (§9.6). Steps 3a (E1–E3), 3b (PF1–PF5), 3c (SK1–SK3), 3d (SK4, CH1), 5 (BP1) and 5b (PR1–PR3,
> HB, RI, PR2, AV4). Previews: `../previews/command-dark/bot-page.png` (PR1, HB, PR3),
> `bot-avatar-change.png` (PR2, AV4), `bot-page-tabs.png` (SK1–SK4, CH1), `bot-usage.png` (W1–W3,
> UV2, UV5). Requirements: `../../requirements/bots.md` UI-6.
> Avatar and colour rules: `bot-avatar.md` §5 and §6.

A click on a card on the Bots page opens the bot in the **edit layout** (L1). The URL is
`/bots/{slug}`, so a link or a reload opens the same bot.

## 1. Edit layout (E1–E3)

```
┌ List (300 px) ──────────┐┌ Bot page ─────────────────────────────────────────────┐
│ ← Back        + Create  ││ band (bot colour)                                     │
│ Search                  ││ (avatar 116)  BA  ba  [Not saved]      Message  ⋯     │
│ PINNED                  ││               🔒 Claude Sonnet · high                 │
│  BA     Running · …     ││               ◌ Running · Login flow                  │
│  Writer Idle · …        ││ Profile · Skills 4 ↑1 · Model · Memory · Activity 5 · │
│ OTHERS        [⏱][📅]   ││ Usage                                                 │
│  Designer …             ││ Tab content                                           │
│                         ││ Save bar (Profile and Model tabs)                     │
└─────────────────────────┘└───────────────────────────────────────────────────────┘
```

- **List (left, 300 px):** "← Back" (to the grid) at the top left, **+ Create**, Search, then the
  same two groups and the same order as the grid and the header (Pinned in the owner's order,
  Others with the two sort buttons, `bots-page.md` §5). There is no close (×) button: this is a
  page, not a dialog.
- **List row (E2):** the 36 px avatar with the state badge, the name, and the one status line
  (`bot-status.md`), cut with "…". No description, model or numbers. Pin works as everywhere
  (`pin.md`): the badge on the top-right corner of the row, never on the avatar. A click opens
  that bot on the right; the list keeps its scroll place. A bot in several conversations shows
  its most urgent state.

## 2. Page top

| Part | Content |
| --- | --- |
| Band | 72 px strip, a plain fade of the **bot colour**. The style does not change it (§5) |
| Avatar | 116 px (`bot-avatar.md` §2) with the state badge. Hover shows **Change**; a click moves focus to Appearance on the Profile tab |
| Row 1 | Name, slug in `text-muted` (fixed at create, D19), and the "Not saved" pill while the Profile tab has a change to the avatar |
| Row 2 | Model badge with a lock: "{model label} · {effort}". Model and effort never change (D7); Clone picks another model |
| Row 3 | Status line (`bot-status.md`). A click opens the Activity tab |
| Actions | **Message** (opens the owner's 1:1 conversation with the bot) and ⋯: Message, Clone, Delete (`danger`), as on the grid (`bots-page.md` §3), without Details |

M5d adds **Improve** to the ⋯ menu, after Message, and the line "Draft vN waiting" with **Open**
while an Improve draft card waits in the 1:1 conversation (D51). From M5c, a waiting new-version
draft of a skill that this bot has shows "Draft v{N} waiting" on its Skills tab row (§7, D65).

There is no numbers row: the Skills and Activity tabs show the counts.

A bot that **cannot run** (no API key, model not in the catalog) shows a banner under the top
with the reason and **Clone** (UI-6.2). Clone then opens with the model field empty (CL2,
`create-bot-page.md` §6).

## 3. Tabs (BP1)

The tabs follow the Create steps, then the parts Create does not have. Each tab has an icon.

| Tab | Content | Saves |
| --- | --- | --- |
| **Profile** | Create steps 1 and 2: Appearance, Basics, Persona (§4) | Save bar |
| **Skills** | Count, and "↑{n}" in `primary` when updates wait (§7) | At once |
| **Model** | Create step 4 without the model field: Tools, Advanced (§6) | Save bar |
| **Memory** | The bot's memory (D38), the Memory page list filtered to this bot. Designed with the Memory page (M5b) | — |
| **Activity** | Count of conversations (§8) | — |
| **Usage** | How well the bot works: tiles, then three views Results, Changes, Causes (§9) | — |

## 4. Profile tab (PR1, approved 2026-10-24)

Three parts, top to bottom, with **no section headings**. A thin `outline` divider separates
them; each field has its own label.

1. **Appearance:** Avatar style cards (Flat, Jelly, Pixel, Upload image), then the Colour row
   (`bot-avatar.md` §5, §6). Hint under "Colour": "Pick a colour, mix your own with Custom, or let
   Random pick any colour."
2. **Basics:** Name (≤ 32) and Description (one line, ≤ 160, a 3-line box), with the hints of the
   Create page (`create-bot-page.md` §2).
3. **Persona:** ≤ 8,000, Markdown, Write and Preview tabs. It opens in Preview, or in Write when
   it is empty (then the persona template is the placeholder, PF4).

History is not on this tab. It is in Advanced on the Model tab, as in Create.

### 4.1 Save bar (PF2, PF3)

The Profile and Model tabs have one save bar each, fixed at the bottom of the page. It is always
there, so it never jumps.

| State | Bar |
| --- | --- |
| No changes | "No changes. Edits apply from the next run." Discard and **Save** at 40 % (`buttons.md`) |
| Changes | Amber dot, "{n} changes not saved". With an avatar change it adds "The header and conversations still show the old avatar until you save." Discard and **Save** (default, Ctrl+S or ⌘S) |
| Bot is running | Adds "BA is running. It uses this from the next run." |
| Field errors | "Fix {n} fields to save." Save at 40 % |

- Only the field in focus has the `primary` border.
- Save keeps no version: the bot changes from its **next run**. A run that works now keeps the old
  profile.
- Errors show under the field in red, as on the Create page (E1, E2). The name must be unique
  among bots, bots in Trash included (D50). An empty Name or Description says "Required". A
  counter turns red over its limit.
- A save that fails on the server keeps the text, and a toast says "Could not save BA. Try
  again."
- **Leave with unsaved changes** (Discard, Esc, ← Back, another bot, tab or page) asks first,
  with the dialog of `project-settings-page.md` §5: **Leave without saving? 👀**, a text that
  names the changed fields, **Stay on this page** (`primary`, default) and **Let them go**
  (`danger` text).

## 5. The band follows the colour (HB, approved 2026-10-24)

The band is `linear-gradient(bot colour at 33 %, bot colour at 9 %)` from top to bottom, for
every style and for an uploaded image. It changes at once when the owner picks a colour, before
Save; only this page changes until Save. The Create preview card and the V3 cards on the Bots page
use the same band.

## 6. Model tab (BP2, approved 2026-10-24)

The tab holds the parts of Create step 4 that can change (`create-bot-page.md` §2, §3):

1. **Tools:** the same list as Create (`create-bot-page.md` §3), with no legend line. Tool switches **can change** after Create: they are bot
   settings, not the model.
2. **Advanced**, always open: History share, Model requests per run, Longest reply, with the
   Create defaults and ranges.

There is **no model or effort field** on this tab (owner, 2026-10-24): the locked badge at the
page top shows them (§2), and they never change (D7). To use another model, the owner uses
**Clone** in the ⋯ menu (`create-bot-page.md` §6).

Changes use the save bar (§4.1) and apply from the next run.

## 7. Skills tab (SK1–SK4)

| Card | Rule |
| --- | --- |
| SK1 Rows | Name and description in one line, the version the bot uses, **Always load** switch, ⋯. Order: always-load skills first, then by name. Changes save at once and apply from the next run; there is no save bar. A deprecated skill has the Deprecated pill with a tooltip (UI-6.5) and no upgrade link. The table head of Always load has a tooltip: "On: the whole skill goes into every run. Off: the bot sees the name and description and loads it when it needs it." (D16) |
| SK1 Update | A newer version shows "v5 available" as a `primary` link that opens the upgrade dialog. This is the "↑1" on the tab |
| SK1 Draft (M5c) | A waiting new-version draft of a skill that this bot has shows "Draft v4 waiting" in place of "v5 available", as a `primary` link to the card (`skill-draft-card.md` §6, preview `skill-draft-edit.*` E7). A new-skill draft is not a row until it is approved and assigned |
| SK1 ⋯ | **Change version**, divider, **Remove** (`danger` text). Remove asks nothing and has no Undo: it deletes nothing, and the owner can add the skill again |
| SK2 + Add | The bot-list card pattern (`buttons.md`): check boxes, search, primary button at the far right. Rows: name, description, latest version. It hides skills the bot has and deprecated skills. No box starts ticked. The button counts ("Add 2") and is at 40 % with none. Skip, Esc or a click outside closes it. Each added skill gets its latest version and Always load off. Create step 3 uses the same card |
| SK3 Upgrade | Dialog: the changelog line of each newer version, newest first; then the diff from the used version to the new one in the skill History colours (added green, removed red with a strike). **Body** and **Description** tabs, and a line when the other tab has changes too. **Upgrade to v5** is the default button. Words say "uses v3", never "pins" |
| SK4 Change version | Lists every version, newest first, with its changelog line and local time (`time-format.md`). ✓ and "BA uses this" mark the current one; "latest" in green. A pick opens the SK3 dialog for that version ("Move Write user stories to v2?", **Use v2**). Going back keeps the "v5 available" link. A deprecated skill can change to any version that exists |

## 8. Activity tab (CH1)

Every conversation the bot is in (UI-6.7). Columns: **Conversation** (a link), the other bots,
**Project** (blank outside a project), **Status** of the bot there (`bot-status.md`), **Last
active** (the bot's last reply or run there, `time-format.md`).

- Every column sorts with the standard sort icon (`time-format.md` §2): a click sorts, a second
  click flips. The sorted column is `primary` with a solid arrow. First click: Conversation and
  Project A to Z (blank projects last), Status most urgent first, Last active newest first (the
  default).
- The 1:1 conversation is a normal row. No filters in M2.
- Empty: "BA is in no conversations yet. Message BA, or drag it from the header into a
  conversation."

## 9. Usage tab (UV1–UV5, W1–W3, approved 2026-10-24)

The tab answers three questions about the bot: **Is it doing good work? Is it getting better?
What explains the change?** There is no single health score, and every rate shows its count
("23 of 27 checked").

### 9.1 Top (always shown)

1. "How well BA works.", then **Group by** (Auto / Day / Week) and the shared time range picker
   (`../../requirements/time-range-picker.md`, D25) with Refresh. Default: Last 7 days, Auto.
   Auto uses the bucket rule of the picker; Week helps when days have fewer than 5 items.
2. **Five tiles:**

   | Tile | Value | Count line |
   | --- | --- | --- |
   | Task success | % of checked tasks with a good verdict (§9.5) | "23 of 27 checked · 27 of 41 tasks checked" |
   | Plans approved first time | % of answered plan cards approved with no Request changes | "11 of 14 answered plans" |
   | Runs finished | % of runs that finished | "35 of 36 · 1 provider error not counted" |
   | Cost per successful task | Cost of all runs (failed runs and retries too) ÷ successful tasks | "$4.50 for 23 tasks" |
   | You wait, slow 10 % | p90 of the time from the owner's message to a finished reply, without the owner's own approval time | "90 % of waits were 48 s or less" |

   Each tile has two chips. **Status:** "Meets target {n}", "Below target {n}" (`danger`), or
   "No target"; the owner sets a target in the tile ⋯ menu. **Trend:** "▲ Better", "▼ Worse" or
   "Not enough change", against the range before. A tile can be "Below target" and "Better" at
   the same time. A click on a tile opens the view that explains it ("You wait" opens Causes at
   Speed).
3. A **view switch** under the tiles: **Results** (default) · **Changes** · **Causes**, with the
   question as a hint. The view is in the URL (`?view=results`), like the time range.

### 9.2 Results: is it doing good work? (W1)

Five outcome charts, two per row, with "Setup changed" markers (§9.3):

| Chart | Form | Note under it |
| --- | --- | --- |
| Task success | Line, success % and the target as a dashed line; a row under it with checked / all tasks | Under 5 checked tasks a point is hollow |
| Plan decisions | 100 % stacked bars: approved first time, approved after changes, rejected; a count row | Open plans are counted apart, not in the bar |
| Your ratings | Line, good ÷ all ratings on the bot's replies (`conversation.md` UI-3.27); a count row | Under 5 ratings a point is hollow |
| Corrections and retries | Two lines: tasks with a correction (a Bad answer or Request changes on the result), tasks with a retry | A new request from the owner is not a correction |
| Run outcomes | Stacked bars: finished, failed, stopped at limit, stopped by you; Count / Finished % switch | Paused and running runs show as text ("Now: 1 paused · 1 running") |

### 9.3 Changes: is it getting better? (W2, UV2)

- A **Setup changed** marker shows on the charts at each change of the bot setup: persona,
  skill versions, skills added or removed, Always load, tool switches, Advanced values. Model and
  price changes (of the catalog) get a grey marker with no action, because they change how the
  numbers read.
- The Changes view lists every change in the range, newest first. Each row shows the 1 or 2
  biggest moves as chips. A click opens **Before and after**; a marker click in Results opens
  this view at that row.
- **Before and after** compares the same length of time on both sides (2 or 4 weeks; it can look
  back past the range start), only for tasks in the same projects on both sides. Columns: Stat,
  Before, After, Change, Evidence. A side with fewer than 20 items says "Not enough {items}"
  in place of a verdict. A line under the table says: a marker shows when something changed,
  not why the numbers moved.

### 9.4 Causes: what explains the change? (W3, UV3, UV4)

Chips at the top jump to a group. Small charts, three per row, with the markers on hover of the
group. "Typical" is p50 and "Slow 10 %" is p90 (the tooltip says "90 % of runs were at or below
this value"). Two values of the same unit share one axis; never two axes.

| Group | Charts |
| --- | --- |
| Limits and effort | Limit pressure (request limit stops, daily cap pauses in grey, replies cut at the limit, each as a rate); model requests per run; tool calls per run; history cuts per 100 runs with the success of runs with a cut |
| Spending | Cost per day with the daily cap as a line; cost per approved plan and per successful task; tokens per run (input, from cache, output; cached input is a part of input) |
| Speed | Time to first word; run time (without approval waits); you wait |
| Work with others | Handoffs sent, got, approved; memories saved and the part undone or forgotten later |

Then the whole-range tables. Each row opens the runs behind it:

| Table | Columns |
| --- | --- |
| Why runs failed | Reason, runs, share of failed. Provider errors are listed but not counted |
| Tools | Tool, calls, failed %, typical time, cost |
| Skills | Skill, version, loaded in (% of runs), success when loaded (with checked count). "Never loaded" is neutral |
| Handoffs by bot | Bot, sent, got, approved, sent back |
| Bot-to-bot turns used | Histogram of conversations; the bar that hit the limit is red and lists them |

### 9.5 Where task success comes from (UV5)

| Source | When | What it is |
| --- | --- | --- |
| The owner's verdict at the end of a task | M3 | An optional row "Did this do the job?" with **Yes** and **Bad answer** under a finished action run. No answer = not checked |
| A rating later | M3 | A Bad answer or a good rating on the result reply counts too |
| Test tasks | Later, with Improve bot (D51) | The paid probe runs the same tasks on two versions; the owner judges blind (A and B, D51) |
| A model as judge | Not now | It costs money on every task and needs checks against the owner's verdicts first |

Coverage ("45 of 61 checked") always shows, because a rate from few verdicts is weak.

### 9.6 Not specified yet

The design needs data that the spec does not hold yet. These go to the M3 and M7 briefs, as a
schema change in the initial schema for that slice. The owner approves the schema design first
and the generated SQL in the slice PR:

- The task verdict on a run (§9.5) and the "Did this do the job?" row in `conversation.md`.
- A record of setup changes per bot, with what changed and the versions (§9.3). Profile saves
  keep no version (§4.1), so the marker names the field, not a persona version.
- Per-tile targets (settings with no default: "No target").
- Group by in the time range picker (a new option of UI-11).
- The timings (time to first word, run time, wait) and tool call counts per run.

Until M3 there are no runs. Empty state: "No runs yet. Usage shows here after BA replies in a
conversation." The charts reuse the Statistics page parts (M7).
