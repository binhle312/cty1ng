# Bots page

> **Status: agreed in the M2 Bots UI design review, round 9 (2026-10-23), steps 2a, 2b and 2d.**
> Previews: `../previews/command-dark/bots-grid.png` (S1–S4), `bots-grid-states.png` (S5–S8),
> `bot-card-v3.png` (V3, M1). Requirements: `../../requirements/bots.md` UI-4.
> Standards it uses: `pin.md`, `bot-status.md`, `dashed-slot.md`, `time-format.md`, `buttons.md`.

The Bots page opens from the user panel menu (Manage bots). It lands on a **grid of cards** (L2).
A click on a card opens the bot page in the edit layout (L1: bot list on the left, the bot on the
right). The bot page and its tabs: `bot-page.md`.

Label rule: the page is about bots, so labels do not repeat the word: "+ Create", "Search",
"Delete", "← Back".

## 1. Page (S1)

Top to bottom:

1. Title **Bots**, subtitle "Your teammates. Each bot has a persona, a model and skills."
   **+ Create** is the primary button at the far right of the title row.
2. **Search** box.
3. **Pinned** group title and the pinned cards, in the owner's order. The group and its title
   show only when a bot is pinned.
4. **Others** group title with the two sort buttons (§5) beside it, then the other cards.

Cards are in a 4-column grid. The header uses the same order as this page: pinned bots first,
then the others (`top-header.md` §3).

## 2. Card (V3)

The whole card is one link to the bot page. Top to bottom:

| Part | Content |
| --- | --- |
| Band | A plain fade of the bot colour across the top of the card (`bot-page.md` §5) |
| Avatar | 72 px (`bot-avatar.md` §2) with the state badge in its top-right slot (`bot-status.md`) |
| Name | Semibold, one line |
| Model badge | "{model label} · {effort}", for example "Claude Sonnet · high" (no effort part when the model has none) |
| Description | 2 lines, cut with "…" |
| Numbers | "{n} skills", with "↑{n}" in `primary` when skill updates exist, "{n} projects", "{n} conversations" |
| Health line | Only when needed (§4), just above the status |
| Status | One line at the bottom, words and colours from `bot-status.md`. Idle shows the last active time (`time-format.md`) |

| State | Look |
| --- | --- |
| Hover | ⋯ button and the pin badge show on the card (`pin.md`) |
| Pinned | Small pin mark on the top-right corner; grab cursor (closed hand while it moves) |
| Not pinned | Normal arrow cursor |
| Needs attention | `primary` card border |
| Cannot run | `danger` card border, red "!" badge on the avatar |
| Keyboard focus | Standard focus ring; Enter opens the bot |

A bot in several conversations shows one status, the most urgent one (`bot-status.md` §3). A
click on the status line opens the list of its conversations, not the bot page.

## 3. ⋯ menu (S4)

| Item | Action |
| --- | --- |
| Details | Opens the bot page (the same as a click on the card) |
| Message | Opens the owner's one 1:1 conversation with this bot (creates it the first time). Hidden in M2, with the divider before Clone; M3 adds it (M2 spec gap pass, owner 2026-11-01) |
| — divider — | |
| Clone | Opens the Create page filled from this bot, on step 4 (`create-bot-page.md` §6) |
| — divider — | |
| Delete | `danger` text. Moves the bot to Trash (D50) |

M5d adds **Improve** after Message (D51). It is always there, also below the offer threshold.

The menu has no Pin, Unpin or Move items. Pin and unpin are the corner badge; reorder is a drag or
Alt+← and Alt+→ on a focused pinned card.

**M2 data** (no conversations or runs yet): the numbers show real skill counts and "↑{n}",
and 0 projects and 0 conversations; the status is "Idle · no activity yet"; the health line can
only be "Cannot run" or "Uses a deprecated skill" (M2 spec gap pass, owner 2026-11-01).

## 4. Health (S7)

Health is computed from data that the app has; nothing new is stored. Healthy bots show nothing.

| Level | Colour | Line (the first that applies) |
| --- | --- | --- |
| Cannot run | `danger` | "Cannot run: no API key"; "Cannot run: model removed" |
| Needs attention | `primary` | "{n} of the last {m} runs failed"; "{n} runs stopped at the request limit this week"; "Uses a deprecated skill"; "Last run cut history to fit the context" |

The thresholds are settings with defaults (`../../domain-model.md` §10): `health_failed_runs`
(2) of `health_recent_runs` (5), and `health_limit_stops` (3 in 7 days). Skill updates are not a
health problem (they show as "↑1" in the numbers). Waiting for you is a state, not health.

## 5. Sort the others (S5)

Two 24 px icon buttons beside the Others title, with the sort icon of `time-format.md` §2:

| Button | Sort | Default direction |
| --- | --- | --- |
| Clock | Recent activity: the latest message or run first; bots with no activity follow, newest created first | Newest first |
| Calendar | Created time. Activity never moves a bot | Newest first |

A click on the other button switches the sort. A click on the button that is on flips the
direction. One setting, `bot_order` (`recent` | `created`), holds the sort for this page and the
header. Pinned bots do not change with the sort.

## 6. Pin, unpin and reorder (S3)

The rules of `pin.md`. A pin puts the bot at the end of the Pinned group; an unpin puts it back in
its sorted place in Others. A drag works only inside the Pinned group; the old place is a gap and
a drop line shows where it lands (`dashed-slot.md` §3). Each pin, unpin and drop saves at once,
with no save bar, and the header follows at once. Deferred reordering (`app-shell.md` UI-2.9)
still stops header avatars from moving while the pointer is in the header.

## 7. Search (S8)

Search filters the cards while the owner types: name, slug, description and model label. Both
groups stay, each with its matches; an empty group hides. Esc clears the box. Pin and unpin still
work; drag is off while a search is on. No match: 'No bots match "{text}". Check the spelling, or
clear the search.'

## 8. Empty state (S6)

With no bots: a grey, faded slime with the sleepy face between two empty dashed seats
(`dashed-slot.md`, decoration only). Title "It is quiet here", text "No bots yet. A bot is a
teammate with one role, for example BA or Designer. Make the first one, so this slime has
company." and the **+ Create** button. Search and the sort buttons are hidden. The header shows
its empty state (`top-header.md` state 11).

## Texts added in the M2b build (2026-11-01, for the owner's review in the M2b PR)

The spec did not name these; the build uses them.

- The delete dialog: title "Delete {name}? 🧹", text "The bot goes to Trash. After {n} days, the
  app deletes it permanently. Messages from {name} will stay, greyed.", buttons **Cancel**
  (default) and **Delete bot** (`danger` fill); the toast "{name} is in Trash." ({n} is the
  Trash setting, D49; the same pattern as the skill delete, `skills-page.md` §11.)
- A pin save that fails for another reason than a changed list: the toast "The app could not
  save the pinned bots. Try again."
- Health "Needs attention" lines for runs, until M3 sends the run counts (M2 has no runs, so
  they do not show yet): "Recent runs failed", "Runs stopped at the request limit this week",
  "Last run cut history to fit the context". M3 changes the first to "{n} of the last {m} runs
  failed".
- The header bot card's gear: tooltip "Open the bot's settings in a new tab"
  (`bot-card.md`).
