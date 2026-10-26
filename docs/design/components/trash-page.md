# Trash page

> **Status: agreed in the M5b design review, round 15 (2026-10-26):** boards T1–T11 (13:43).
> Preview: `../previews/command-dark/trash-page.*`. Decisions: D47, D49, D50, D60, D62.
> Standards it uses: `buttons.md` (§6 Undo), `time-format.md`, `../ui-rules.md`.

## 1. Where it opens

- **Trash** in the user panel menu, after Memory, with the number of items at the right
  (`user-panel.md` §2, T8).
- The "Trash" link in a toast after a move to Trash ("{name} is in Trash.").
- The page belongs to the whole app: bar 2 is hidden, the rail and the top header stay
  (`settings-page.md` §1).

## 2. Layout

| Part | Rule |
| --- | --- |
| Kind list | 220 px. The title **Trash** (20 px, weight 600), then **All items**, **Projects**, **Conversations**, **Bots**, **Skills**, **Memory items**, each with its icon and count. The Settings list pattern (`settings-page.md` §2) |
| List column | 760 px, 40 px from the list |
| Head | The kind name (16 px, weight 600), the line "Items stay here for {trash_days} days. Then the app deletes them for good. **Change in Settings**" (the link opens Settings › Trash), and "Newest delete first" |
| Select row | 40 px: the select-all check box and "{n} items" |

## 3. Row

| Part | Rule |
| --- | --- |
| Check box | `buttons.md` §5. A ticked row gets a `primary` ring |
| Icon | Project tile, conversation icon, bot avatar, skill book or memory icon, 28 px |
| Name and kind | Name (weight 600), then a muted tag: Project, Conversation, Bot, Skill, Memory item. A memory item's name is its text |
| Facts | One line, 12 px, `on-surface-muted`, the real counts: a project "4 conversations · 21 memory items · 12 files in its Library"; a conversation "In {place} · 24 messages · 3 runs · 2 conversation memory items"; a bot "{model} · 3 skills · 6 bot memory items · in 2 conversations"; a skill "4 versions · used by 3 bots when you deleted it"; a memory item "Project memory of {project} · {bot} saved it in {conversation}" or "Left behind when {conversation} moved into {project}" |
| Times | "Deleted {time} · Deletes on {date}" (`time-format.md`). In the last 7 days: "Deletes in {n} days", in `on-surface-soft` |
| Buttons | **Restore** (secondary 30) and **Delete** (danger 30). The label is Delete, never "Delete now" (W2, D62) |

## 4. Actions

| Action | Result | Board |
| --- | --- | --- |
| Restore | The item goes back to its place. Toast: "{name} is back in {place}. **Open**" | T4 |
| Restore, place in Trash (D60, D62) | Restore is off (B5) with the tooltip "Restore {place} first". Under the facts, a link "{place} is in Trash ›" scrolls to the place's row and marks it. No error message | T2 |
| Restore a skill (D49) | Dialog "{skill} is back": "It is deprecated, as before. These bots used it when you deleted it. Assign it to them again?", one ticked row per active bot ("Pinned v4 before"), a line for bots in Trash ("Translator also used it. Translator is in Trash, so it is not in the list."), **Skip** and **Assign to {n} bots** | T5 |
| Restore a bot (D50) | Dialog "{bot} is back": "Its persona, skills, tools and bot memory are back. Add it again to the conversations that it was in?", one ticked row per conversation not in Trash ("In {place} · last message {date}"), the line "It joins as a new member. You choose what it can read, as when you add any bot.", **Skip** and **Add to {n} conversations** | T6 |
| Delete | No dialog. The row leaves the list at once and the toast says "{name} is deleted for good. **Undo**". The page sends the delete when the toast closes, after `undo_seconds`; Undo puts the row back and sends nothing (D62) | T3 |
| Empty | A Trash icon, "Trash is empty", and "When you delete a project, conversation, bot, skill or memory item, it waits here for {trash_days} days. You can restore it until then." | T7 |

## 5. Several items (T9–T11)

- With one or more rows ticked, the select row becomes a bar (44 px, `surface-container`): a
  part-ticked box, "{n} selected", **Clear**, **Restore {r}** (secondary 30), **Delete {d}**
  (danger 30).
- {r} counts only the ticked items that can be restored. When an item cannot, the Restore
  button has a tooltip: "{item} waits for {place}. Tick {place} too, or restore it first." (T9).
- Ticking the place too makes every ticked item restorable (T10): the app restores places
  first, then the items in them.
- Delete {d} shows one toast for all: "{d} items are deleted for good. **Undo**" (T11).
- Restore and delete of several items run item by item. When one fails, the others still go
  through, and a toast names the item that failed and why.

## 6. What is not on the page

- No "Empty Trash" button. The purge and the row Delete cover it.
- No search. The kind filter and the date order are enough for the number of items one owner
  deletes in `trash_days`.
