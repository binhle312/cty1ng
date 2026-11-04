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

**URLs (M2 spec gap pass, owner 2026-11-01).** A reload keeps the bot and the tab:

| URL | Opens |
| --- | --- |
| `/bots` | The grid (`bots-page.md`), or its empty state |
| `/bots/{slug}` | That bot, Profile tab. `?tab=skills`, `?tab=model`, `?tab=activity` or `?tab=usage` (Usage adds its view and range, §9.1); `?tab=memory` from M5b |
| `/bots/new`, `/bots/new?from={bot id}` | The Create page and Clone (`create-bot-page.md` §7) |

The page finds the bot id from the slug in the `GET /bots` list; the API takes ids. A slug that
is unknown or belongs to a bot in Trash shows "The app could not find this bot. It may be in
Trash." with **← Back** (M2: the restore is the temporary CLI, `../../api.md` §2). A list that
does not load shows "The app could not load the bots." with **Try again**, never Page not found.

## 1. Edit layout (E1–E3)

```
┌ List (300 px) ──────────┐┌ Bot page ─────────────────────────────────────────────┐
│ ← Back        + Create  ││ band (bot colour)                                     │
│ Search                  ││ (avatar 116)  BA  ba  [Not saved]      Message  ⋯     │
│ PINNED                  ││               🔒 Claude Sonnet · High                 │
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
| Row 1 | Name, slug in `on-surface-muted` (fixed at create, D19), and the "Not saved" pill while the Profile tab has a change to the avatar |
| Row 2 | Model badge with a lock: "{model label} · {effort}". Model and effort never change (D7); Clone picks another model |
| Row 3 | Status line (`bot-status.md`). A click opens the Activity tab |
| Actions | **Message** (opens the owner's 1:1 conversation with the bot) and ⋯: Message, Clone, Delete (`danger`), as on the grid (`bots-page.md` §3), without Details |

M5d adds **Improve** to the ⋯ menu, after Message, and the line "Draft vN waiting" with **Open**
while an Improve draft card waits in the 1:1 conversation (D51). From M5c, a waiting new-version
draft of a skill that this bot has shows "Draft v{N} waiting" on its Skills tab row (§7, D65).

There is no numbers row: the Skills and Activity tabs show the counts.

**M2 (no conversations yet):** **Message** is hidden, here and in the ⋯ menu; M3 adds it (M2
spec gap pass, owner 2026-11-01).

A bot that **cannot run** (no API key, model not in the catalog) shows a banner under the top
with the reason and **Clone** (UI-6.2). For a model removed from the catalog, Clone opens with
the model field empty (CL2); for a model with no API key, Clone keeps the model, shown
unavailable (`create-bot-page.md` §6).

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

In M2 the Memory tab is hidden (it comes with M5b), and the Usage tab shows only its empty state
(§9.6) until M3 brings runs (M2 spec gap pass, owner 2026-11-01).

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
- **Conflicts (M2 spec gap pass, owner 2026-11-01), as on the Skills page**
  (`skills-page.md`, "Texts added in the M1b build"). The save bar says "BA changed in another
  place. Your changes are kept here. Copy what you need, then Discard to load the new values."
  Save is off until Discard. The conflict shows when the server refuses a save as stale (409
  `stale_write`): the page then loads the newest values and keeps the owner's edits. It also
  shows when a newer `row_version` comes while the tab has changes and no Save of the page
  waits (§4.2, Q1). A name taken meanwhile (409 `name_taken`) shows under Name. The table in
  §4.2 gives the rule for each event in each state, also for late answers, text typed while a
  Save waits, a Discard while a Save waits, and an event with the same `row_version` (M2c
  reviews, 2026-11-02 and 2026-11-03). Two more rules: a field typed after a Discard is the
  tab's own change, so the Save that was on its way shows no conflict for it; and the avatar
  style and the image count as one choice, so a new image kept after the Discard keeps its
  style too.
- **One Save at a time** (M2c review, 2026-11-03): both tabs send the same `row_version`, so a
  second Save would be refused as stale. While one tab's Save is on its way, the other tab's
  Save is off, and its tooltip says "Wait until the Profile tab is saved." (or Model). It turns
  on with the answer, at the new `row_version`.
- **Leave with unsaved changes** (Discard, Esc, ← Back, another bot, tab or page) asks first,
  with the dialog of `project-settings-page.md` §5: **Leave without saving? 👀**, a text that
  names the changed fields, **Stay on this page** (`primary`, default) and **Let them go**
  (`danger` text). When the changes go while the question is open (its Save answered, and
  nothing typed after it is unsaved), nothing would be lost, so the page does what the owner
  asked at once (M2c audit, 2026-11-03).
- **A Save the owner let go** (Discard, Esc or leaving while it waits) that then fails shows a
  toast, because no field or bar shows it any more: "BA changed in another place, so the app did
  not save your change." for a stale save, "Could not save BA: {name} is taken by another bot,
  maybe one in Trash." for a taken name, "Could not save BA: {server text}" for a field error,
  and "Could not save BA. Try again." for the rest (M2c audit, 2026-11-03).

### 4.2 Edit states and events (M2c audit, 2026-11-03)

One table for each edit tab (Profile, Model), from the rules above. A row is an event; a column
is the state of the tab when it comes. "Changes" includes field errors. Q1–Q3 are below the
table.

The rules live in one pure module, `frontend/src/features/bots/bot-edit-state.ts`
(`../../frontend-conventions.md` §1). Its tests in `bot-edit-state.test.ts` have one `describe`
for each row, with the name of the row, and one test for each cell, named by its column.
`bot-edit-sequences.test.ts` runs every order and random orders of the events against a model
of the server, and checks the invariants of `../../testing.md` §3 after each step. The last
column names the tests in `bot-page.test.tsx` that hold the row on the page.

| Event | No changes | Changes | This tab's Save on its way | Conflict, or refused as stale | Page tests |
| --- | --- | --- | --- | --- | --- |
| Type a value | Changes | Changes; a server error on that field goes | A change after the Save (counted against what it sent) | Kept; the conflict stays | "saves only the changed fields …", "keeps text typed while a save is pending …", "drops a late name error …" |
| Type back to the saved value | — | No changes; takes newer values if there are any | Still a change: it differs from what the Save sent | No changes; takes the newest values | "takes the newest values when the owner types a conflicted tab back …", "keeps text typed back while Save waits …", "asks before leaving when text typed back …" |
| Save (button, Ctrl+S) | Off: "No changes to save." | Sends the changed fields with the tab's `row_version`; with errors, focuses the first and says "Fix {n} fields" | Off: "Saving." | Off: "BA changed in another place. Discard first." | "saves only …", "saves with Ctrl+S", "says Fix 1 field …" |
| Save while the other tab's Save is on its way | Off | Off: "Wait until the Profile tab is saved."; on after the answer, at the new `row_version` | — | Off | "turns Save off on the other tab …" |
| The Save answers | — | — | Saved values = what it sent; every tab based on the same `row_version` moves to the new one; text typed after it stays a change; a let-go tab shows the saved values; a tab that a Discard moved to a newer `row_version` keeps it. The answer writes only the fields a save owns | — | "saves twice in a row …", "keeps a newer list when the answer of its own save comes after it", "shows the saved values … when the owner discards while Save waits", "keeps newer values from another tab …", "keeps text typed after a Discard …", "keeps a newer Always load toggle …", "keeps a newer unpin …", "keeps a newer health …" |
| The Save is refused as stale (409) | — | — | Conflict at once; Save off until Discard, also when the refresh fails; the text stays. A tab at the same `row_version` (the other tab, or a tab let go meanwhile) is in conflict too while it has changes, also changes typed later, until a newer bot moves it. Let go or left: the toast | Stays | "keeps the edit on a stale save …", "keeps a stale save's conflict …", "says in a toast when a Save fails as stale after the owner left …" |
| The Save gets `name_taken` or a field error | — | — | The error under the field, if it still has the sent text. Let go or left: the toast | — | "keeps the text when the server refuses the name …", "drops a late name error …", "says in a toast when a Save fails after the owner let its tab go" |
| The Save fails another way | — | — | Toast "Could not save BA. Try again."; the text stays. A Save that failed on the way loads the bot, because the server may have taken it (Q4) | — | "shows a toast and keeps the text when the save fails", "loads the bot after a Save that failed on the way …" |
| A newer `row_version` (event, refresh, another tab) | Takes the new values | Conflict, but not while a Save of either tab waits (Q1): the answer decides. When every changed field already has the server's value, it takes the new values with no conflict (Q4) | No conflict; waits for the answer before it takes new values (Q1) | Stays | "takes newer values at once …", "shows the conflict when a newer row_version arrives …", "keeps text typed back while Save waits, also when the save's event comes first", "keeps a newer list when the answer of its own save comes after it", "shows no conflict on the other tab when the event of a Save comes before its answer", "shows the conflict after a Save answers when another place changed the bot meanwhile", "loads the bot after a Save that failed on the way …" |
| The same `row_version` (a pin, the pinned order) | Skills tab, counts and header update; never blocks an edit | Same | Same | Same | "does not block an edit when only a pin changed …" |
| A refresh fails | Keeps the last list | Same | Same | A refused tab keeps its conflict | "says the list did not load …", "keeps a stale save's conflict …" |
| Discard or Esc | Off (Esc does nothing) | Asks; Let them go drops both tabs' changes and shows the newest values | Asks; Let them go drops the change; the Save goes on | Asks; Let them go loads the newest values again | "asks on Esc …", "shows the saved values …", "leaves at once after a Discard while Save waits …", "keeps the edit on a stale save, … Discard loads …" |
| Leave (another tab, bot or page; ← Back) | Leaves | Asks; Stay keeps; Let them go drops and goes | Asks; when the Save answers and nothing is unsaved, leaves | Asks | "asks before another tab …", "Let them go drops the changes …", "moves between tabs without asking …", "leaves at once when the Save answers while the leave question is open", "keeps the leave question … when text typed during the Save is still unsaved" |
| An avatar upload answers | Style and image change on the form as it is now | Same | Same | Same | "keeps a newer name when an avatar upload answers after it" |
| The bot leaves the list (Trash, another tab) | "The app could not find this bot …" (URLs) | Same; the edit goes with the page | Same; a failed Save shows its toast | Same | "says when no live bot has the slug", "says it could not find the bot when it leaves the list during an edit", "shows the toast of a Save that fails after the bot left the list" |

**Decided (owner, 2026-11-03):**

- **Q1.** While a Save of the page waits, a newer `row_version` shows no conflict on either tab:
  it is often that Save's own event. The answer decides: a success moves every tab of the same
  `row_version` on, and a newer one left after that shows the conflict; a 409 shows it at once.
- **Q2.** Remove on the Skills tab takes the row away at once; it comes back with a toast when
  Remove fails (§7).

**Decided (owner, 2026-11-04):**

- **Q3.** A version dialog (Upgrade, Change version) could open again for a pin whose move was
  still on its way, and a second confirm sent the old pin as `expected`, so the server refused
  it with the "changed in another place" toast for the owner's own change. Decided: the ⋯ menu,
  the "v{n} available" link and the Always load switch of a row are off while any change of
  that row is on its way, until the refresh after its answer or refusal ends (owner, 2026-11-04,
  review of `ec8faa7`: a list load before the answer keeps the answer out of the list, so the
  answer alone can leave the row on the old pin). Every request that changes pins counts: a
  move, + Add, Always load, the cards after a save, Remove from bots and Deprecate. The
  same rule holds for the rows of the Skills page's Bots tab (`skills-page.md` §2a). They are
  plainly off, with no tooltip; the tooltip waits for the UI review after M3 (B5).
- **Q4** (review of the edit state module). The server can take a Save whose answer is then
  lost on the way (the network fails). The page said "Could not save BA. Try again.", and when
  the save's own `bot.updated` event came, the tab showed "BA changed in another place" for the
  owner's own change. Decided: when a newer `row_version` comes and every field the owner
  changed already has the server's value, the tab takes the new values with no conflict; nothing
  of the owner's is lost. A Save that fails on the way also loads the bot again, so a Save the
  server took shows at once. The toast text for this case waits for the UI review after M3.
  A name counts as the server stores it (`normaliseBotName`, review of `ec8faa7`): white space
  alone is no change, so a lost Save of "  New   BA  " shows no conflict when the server's
  "New BA" comes. After a Save answers, a name nobody typed over shows as the server stores it.

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

**A pin that changed in another place** (M2 spec gap pass, owner 2026-11-01). Each Skills tab
change sends the pin as the tab saw it (`../../api.md` §4). When the server refuses it as stale,
the tab loads the newest pins, keeps no change, and a toast says "{skill} changed in another
place. Check it and try again." The same toast shows for a skill in **+ Add** that got on the bot in
another place; when no other skill failed, the card closes. **Remove** takes the row away at
once, also over a refresh that lands before its answer; when it fails, the row comes back at once
with a toast, also when the refresh after it fails (owner, 2026-11-03). Remove of a skill that is already gone just keeps the row away. A pin answer changes only the pin of its own skill: a pin change does not
raise `row_version`, so the answer cannot tell if the rest of the bot is newer in the page. It
changes that pin only while the page still shows the pin the request expected; a different pin
is this change or a newer one. When the page loaded the bot list after the request went out, the
answer changes no pin, because a newer change may have the expected value again (on, then off in
another tab); the refresh after the answer shows the pin, and the switch keeps the value on its
way until then (M2c review, 2026-11-02 and 2026-11-03). This holds also when the answer comes
after the owner left the tab: the page counts the loads for as long as the app runs (M2c review,
2026-11-03). The reverse also holds: a Profile or
Model save never changes a pin, so its answer, even with a newer `row_version`, keeps the pins
and the skill counts that the page shows; a toggle made while that Save was on its way stays (M2c
review, 2026-11-03). An answer that comes after the owner left the tab or the page
shows as a toast, not in the closed dialog. A dialog whose skill left the bot in another place
closes, and its answer also shows as a toast. While a change of a row is on its way, until the
refresh after its answer or refusal ends, the row's ⋯ menu, its "v{n} available" link and its
switch are off, so the owner cannot send a second change with an old `expected` pin (§4.2, Q3).

### 7.1 Requests and late answers (M2c audit, 2026-11-03)

Each request of the tab against the five order questions (`../../workflow.md` §2 step 4). The
Skills page's Bots tab follows the same rules (`skills-page.md` §2a) through one pure module,
`frontend/src/features/bots/bot-list-state.ts`: the page shows the server value with the requests
that wait put on it, in send order, and `bot-list-store.ts` sends it the loads and the answers.
Tests are in `bot-list-state.test.ts` (one per rule), `bot-list-sequences.test.ts` (every order of
a few requests, and random orders against a model of the server), `bot-list-store.test.tsx`,
`bot-page.test.tsx` and `skill-bots-tab.test.tsx`. A pin has no version: when the server takes an
older request of a pin after a newer one (requests that overtake each other), only the refresh
after the answer shows the server's pin.

| Request | Late answer | The tab is gone | A newer request of the same kind | A load or event in between | The refresh fails or is slow |
| --- | --- | --- | --- | --- | --- |
| Always load | Writes only its own pin, only while the page shows the pin it expected ("keeps a newer bot …", "keeps a newer pin of another skill …", "keeps a newer version of the same skill …") | The load count and the value on its way outlive the tab: back on the tab, the switch shows the value on its way and stays off ("… after the owner left the tab", "keeps the Always load value on its way when the owner leaves the tab and comes back") | The whole row (switch, ⋯, link) is off while its change is on its way, until the refresh after it ends (Q3; "turns Remove off while an Always load change of the row waits …"); other skills are independent | Writes no pin; the refresh shows it ("keeps a newer opposite toggle from another tab …") | The switch keeps the value on its way until the refresh ends ("keeps the switch on the value on its way …", `bot-list-store.test` "ends only after the refresh that follows its answer"). A failed refresh keeps the last list, as everywhere on the page (§4.2); the next load shows the server's pin |
| Upgrade, Change version (dialog) | Writes only its own pin (`bot-list-state.ts`) | A failure is a toast ("shows a version move that fails after the owner left the page as a toast") | Never closes or writes into a newer dialog (`useDialogRequests`). A second change of the same row cannot start: its ⋯, link and switch are off while the move waits, also after the dialog closes (Q3; "turns the row's actions off while its version move waits …", "turns the Always load switch off while a version move of its row waits") | Writes no pin; the refresh shows it, and the row stays off until then ("keeps the row's actions off after a move's answer …") | The dialog closes at the answer; the row shows its version from the refresh, and its actions are off until that refresh ends. A failed refresh turns them on with the last list; the server then refuses an old pin as stale. A stale move closes with a toast ("closes a stale version move …") |
| + Add | Writes its new pin only when the page has none and the list did not load meanwhile; the refresh shows the rest, and the new row's actions are off until that refresh ends | A failure is a toast (`useDialogRequests`) | As above; a skill added elsewhere gives its stale toast ("+ Add shows the stale toast …") | — | The card closes at the answer |
| Remove | The row went at once; the answer ends that, and the refresh after it shows the server's pins (Q2). The owner's own + Add of the same skill ends it at once, because a pin has no id that tells the new pin from the removed one ("shows a skill the owner adds back while its Remove is on its way"). Only a request sent while the Remove waits ends it: the answer of an Always load change or a Move sent before it does not (`bot-list-state.test` "keeps the row away when an older Always load change answers", "ends an older change of its pin when it is saved …"). On this page, Remove is off while a change of its row waits (Q3), so such an order comes only from another place. Such an older answer never shows its pin again, also after an add put the pin back, but a Remove that fails puts back that newer pin, which the server took first (`bot-list-state.test` "puts back the pin of an older change …", "keeps the pin an add put back …"). An add during a Remove shows its pin also when a list load landed while both waited ("shows the added pin when a list load landed …"), and also when the Remove answered first (`bot-list-state.test` "shows the added pin when the Remove answers before the add and a load landed", found by the sequence test, 2026-11-04) | A failure is a toast; the refresh brings the row back | A second Remove of a gone pin is 204 | The row stays away ("takes a removed skill's row away at once, also over a refresh before the answer") | A failure brings the row back at once with a toast, also when the refresh after it fails ("brings a removed skill's row back with a toast when Remove fails", "… when Remove fails and the refresh fails too") |

## 8. Activity tab (CH1)

Every conversation the bot is in (UI-6.7). Columns: **Conversation** (a link), the other bots,
**Project** (blank outside a project), **Status** of the bot there (`bot-status.md`), **Last
active** (the bot's last reply or run there, `time-format.md`).

- Every column sorts with the standard sort icon (`time-format.md` §2): a click sorts, a second
  click flips. The sorted column is `primary` with a solid arrow. First click: Conversation and
  Project A to Z (blank projects last), Status most urgent first, Last active newest first (the
  default).
- The 1:1 conversation is a normal row. No filters in M2.
- Empty, by slice (M2 spec gap pass, owner 2026-11-01): M2 "BA is in no conversations yet.";
  M3 adds "Message BA to start one."; M4 adds "or drag it from the header into a
  conversation." Each slice changes the text when it builds that action.

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

## 10. Texts added in the M2c build (2026-11-02, for the owner's review in the M2c PR)

The design names these parts but not their words. Each follows a pattern that exists.

| Place | Text |
| --- | --- |
| Cannot-run banner, no API key | "Cannot run: no API key", then "Set the API key and restart the app, or clone the bot with another model." and **Clone** |
| Cannot-run banner, model removed | "Cannot run: model removed", then "The model left the catalog. Clone the bot to pick another model." and **Clone** |
| Model tab, model removed | Under Tools: "{model id} is no longer offered, so the tools cannot change. Clone the bot to use another model." The switches are off; Advanced still saves (`../../api.md` §4 PATCH) |
| Skills tab, top line | "Changes save at once. BA uses them from its next run." and **+ Add** |
| Skills tab, no skills | "BA has no skills yet." |
| + Add card (SK2) | Title "Add skills to BA", "Tick the skills to add. Each gets its latest version, with Always load off.", Search, the list, "A click outside this card is the same as Skip.", **Skip** and **Add {n}**. With nothing to add: "No skills to add. The bot has every active skill." Before the list comes: loading shapes ("Loading the skills", `aria-busy`); when it does not load, "The app could not load the skills." with **Try again** (M2c review, 2026-11-02; review of 571375a) |
| Save off, why (tooltip, ui-rules B5) | "No changes to save.", "Saving.", "Fix the errors first.", "BA changed in another place. Discard first.", "Wait until the Profile tab is saved." (or Model; M2c review, 2026-11-03) |
| Field errors bar | "Fix 1 field to save." for one field |
| Avatar on the page top | Hover or focus shows **Change**; its name for screen readers is "Change the avatar of BA" |

**Discard and Esc** ask with the leave dialog of §4.1 even though the owner stays on the page:
"Let them go" drops the changes of the tab. A field error from the server goes when the owner
changes that field, as on the Create page (E3).

**Open question for the owner:** §4.1 says an empty Name or Description shows "Required", and the
M2c build does so on this page. The Create page says what to type instead ("Type a name.",
`create-bot-page.md` E1). The build keeps both as written; one word for both pages would be
simpler.
