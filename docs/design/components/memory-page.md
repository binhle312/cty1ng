# Memory page

> **Status: agreed in the M5b design review, round 15 (2026-10-26):** boards M1–M20 (13:28)
> and the Tidy boards Y1–Y8 (14:07). Previews: `../previews/command-dark/memory-page.*` (M1–M8),
> `memory-page-states.*` (M9–M20), `memory-tidy.*` (§8). Requirements:
> `../../requirements/projects-and-memory.md` UI-13. Decisions: D38, D43, D62, D63. Standards it
> uses: `buttons.md`, `time-format.md`, `../ui-rules.md`.

The Memory page is a light tool to control what bots remember (owner, 2026-10-25). It is not a
place to read or write long notes. Each item is one short fact, at most `memory_item_max_chars` characters (default 300). A place holds at most `memory_items_max` items (default 50). The boards were drawn with the older 500 and 100; the settings win, and the examples here use the defaults.

## 1. Where it opens

- **Memory** in the user panel menu (`user-panel.md` §2). The page opens on the place that the
  owner had open last; the first time, on the first project.
- **Memory page ›** at the bottom of the Memory pane (`memory-pane.md` §2) opens the page on the
  place of that conversation: its project, its conversation memory, or the bot of a 1:1.
- **All memory: Memory page** on the bot page Memory tab (§7).
- The page belongs to the whole app: bar 2 is hidden, the rail and the top header stay, as on
  the Settings page (`settings-page.md` §1).

## 2. Layout

Two columns, centred, the Settings list pattern (`settings-page.md` §2):

| Part | Rule |
| --- | --- |
| Places list | 240 px. The title **Memory** (20 px, weight 600), the search box (34 px), then three groups: **Bots**, **Projects**, **Home conversations** (11 px caps, `on-surface-faint`). One row per place, 32 px: icon (bot avatar, project tile, conversation icon, 20 px), name, a `primary` dot when it has items that the owner has not seen, and the count of items. The open place has `surface-selected`, weight 600 and a 3 px `primary` bar |
| Place column | 760 px, 40 px from the list |

- **Home conversations** lists only multi-bot conversations outside a project, because only
  they have conversation memory (D38).
- A bot, project or conversation in Trash is not in the list (owner 2026-10-26 13:28). Its items
  are in Trash with it.

## 3. A place

### 3.1 Place head

- Name (16 px, weight 600), then one line that says who reads this memory:
  - project: "Project memory. Every bot in {project} reads it. It wins over a bot's own memory."
  - bot: "Bot memory. {bot} learns it in your 1:1 conversations and reads it in every
    conversation, also in projects."
  - conversation: "Conversation memory. Only the bots in {conversation} read it."
- Then the count only: "8 of 50 items" (the limit is `memory_items_max`) (`on-surface-faint`). The head does not repeat facts
  that the line or the rows already show (W2).
- Buttons at the right, 30 px: **Tidy** (secondary, §8) and **+ Add** (primary, §3.4). A place
  with no items has no Tidy.

### 3.2 Item row

- The text (13 px, line height 1.45), then one meta line (11.5 px, `on-surface-faint`) with a
  16 px avatar: "{bot} saved it in {conversation} · {time}", "You added it · {time}" or "You
  changed it · {time} · {bot} saved it first in {conversation}". The conversation name is a
  link (underline in `outline-strong`) that opens the message.
- Time: `time-format.md` (under 1 day "25 min ago", else local ISO time).
- **New** tag for a save that the owner has not seen. Opening the place marks its items seen.
- ⋯ (30 px) at the right opens the item menu: **Edit**, **Earlier versions**, a divider,
  **Delete** (`danger` text).
- Rows are ordered newest change first. An `outline` line separates rows.

### 3.3 Edit (M3, M4)

- Edit turns the row into a box in place: the text field (`primary` border), a hint "Bots in
  {place} read the new text from their next run. Enter saves, Esc cancels.", the counter
  "{n} / {max}" (`memory_item_max_chars`), **Cancel** and **Save** (30 px).
- After Save: the agreed toast "Saved ✨ Bots in {place} use the new text from their next run."
  The meta line becomes "You changed it · 1 min ago · …".

### 3.4 Add (M20)

**+ Add** opens the same box, empty, at the top of the list. Save adds the item as "You added
it". The sensitive-data guard and the limits apply (§5).

### 3.5 Earlier versions (M5)

- Opens under the item: "Earlier versions", then "{k} of {n} kept · set in {where}" and
  **Hide**. One row per version, newest first: text, "v{n} · {who} in {conversation} · {time}",
  and **Restore** (secondary 30). The current version says "Current" instead.
- Restore makes a new version with the old text. It does not delete the newer ones.
- With history off for the place (M11), **Earlier versions** in the menu is off (40 %, B5) with
  the tooltip "Earlier versions are off for {place}. Turn them on in {where}."

### 3.6 Delete (M7)

Delete moves the item to Trash at once, with no dialog, because the owner can restore it (D62).
The toast: "The item is in Trash." with **Trash** as a link. No Undo (B7).

## 4. Search (M6)

- The search box looks at the text of every item, in every place.
- While a search is active, each place row shows its number of hits; places with none are
  `on-surface-faint`. No place is selected.
- The column shows "{n} items for "{q}"" and "In {k} places.", then one group per place: icon,
  name, "{kind} · {n}" and **Open**, then the matching rows with the word marked (`primary` on
  `primary-tint`).
- Clear (×) ends the search and opens the last place again.

## 5. Rules shown on the page

| Rule | What the page shows | Board |
| --- | --- | --- |
| Conflict with instructions (D43) | Under the item, in `primary`: 'Disagrees with instructions, line 4: "…"' and **Decide** (primary 30) | M1 |
| Decide | Under the item: "Which one is correct?", two radio choices that say the result: "Keep the instruction: {value}" ("The memory item becomes …") and "Keep the memory: {value}" ("Line 4 of the instructions becomes …"). The hint "Not sure? Cancel. Until you decide, bots follow the instructions." **Cancel** and **Apply**. Cancel is decide later | M9 |
| A secret (D39) | The box border and a line in `danger`: "This text looks like a password. Memory never keeps passwords, keys or tokens. Remove it, then save." No override | M12 |
| `memory_item_max_chars` | The counter turns `danger` ("312 / 300"), a line "Make the text 300 characters or fewer.", **Save** off with the tooltip "The text is too long." | M13 |
| `memory_items_max` | The count line in `danger`: "50 of 50 items. Bots cannot save more here until you delete or tidy items." **+ Add** off with the tooltip "This place has 50 items. Delete an item or use Tidy first." | M13 |
| Memory off in Settings (UI-8.6) | A banner above the head: "Memory is off. Bots do not read or save memory. Your items stay, and you can still edit them." and **Open Settings** | M14 |
| Source in Trash or purged (D60) | The conversation link keeps its name and gets an "In Trash" tag; after the purge it says "Deleted conversation" in `on-surface-faint`, with no link | M15 |
| A place with no items | The bot avatar (72 px), "{bot} has no memory yet", one line on how it gets memory, and **+ Add** in the head | M16 |

## 6. History settings

- **Bot:** on the bot page Memory tab (§7).
- **Project:** Memory history on the project settings page (`project-settings-page.md`).
- **Home conversation:** "Keep earlier versions" at the top of the Memory pane
  (`memory-pane.md` §1.1, M18).
- **Lowering the number** asks first (M10): "Keep 2 versions?", "{k} of {bot}'s items have more
  than 2 earlier versions. The app deletes the {n} oldest versions. You cannot get them back."
  **Cancel** (default) and **Delete {n} versions** (danger fill).

## 7. Bot page Memory tab (M8)

- The tab count is the number of items. At the top, one setting row (`settings-page.md` §3.1):
  **Keep earlier versions**, "On: you can restore an earlier text of each item. A lower number
  deletes the oldest versions, after you confirm.", note "1 to 20. Off when a bot is created. 5
  when you turn it on.", a number box and a switch.
- Then the bot line from §3.1, "{n} of 50 items · All memory: Memory page", **Tidy**, **+ Add**
  and the same rows as the page.

## 8. Tidy memory (D38, D63; boards Y1–Y8)

| State | What shows | Board |
| --- | --- | --- |
| Pick the bot | **Tidy** opens "Tidy with": one row per bot of the place (avatar, name, model · effort), then "One model request. Nothing changes until you apply the card." On a bot's own memory there is no menu: that bot tidies | Y1 |
| Working | The head shows a spinner and "{bot} is tidying" with **Stop** (secondary 30) in place of Tidy. The list stays usable | Y2 |
| The card | Above the list: "{bot} suggests {n} changes and {f} flag · {k} of {n} ticked". One row per change: check box, kind (MERGE, REWRITE, DELETE, FLAG, 11 px caps), the old texts struck through in `on-surface-faint`, the new text, and one "why" line. A delete row says "A deleted item goes to Trash." A flag row has no check box and says to use Decide on the item. Footer: "Tidy with {bot} · 1 request · {cost} · {time}", **Discard** and **Apply {k} changes** (off at 0 ticked) | Y3 |
| After Apply | Changed items get the New tag and "You applied {bot}'s tidy · {time}". The toast "Saved ✨" | Y4 |
| Stale row | An item changed after the bot read it: its row is off (40 %) and not ticked, with "You changed this item after {bot} read it. Press Tidy again to include it." | Y5 |
| Invalid row | A new text with a secret or over `memory_item_max_chars`: the row is off and not ticked, with the reason ("This text looks like a password." or "The text is too long."). The app checks again at Apply and never saves such a row (D63) | — |
| Nothing to change | Toast "{bot} found nothing to change." No card | Y6 |
| Failed | A `danger` box under the head: "Tidy failed: {reason}. Nothing changed." and **Try again**. At a spending cap the reason is the cap | Y7 |
| In a conversation | "@BA tidy the project memory" gives the same card inside BA's reply; the footer says the place ("Project memory · Login app") | Y8 |

- The card is kept until the owner applies or discards it, or a new Tidy replaces it. Leaving
  the page does not lose it.
- Ticking: all merge and rewrite rows start ticked; delete rows start ticked too, and the owner
  unticks what to keep (Y3 shows one unticked).

## 9. What is not on the page

- No summary view of a place: the item list is the source of truth (owner, 2026-10-26 13:28).
- No memory of a bot or project in Trash (§2).
- No bulk select on items. Tidy and Delete cover the cases.
