# Time format and sort buttons

> **Status: agreed in the M2 Bots UI design review, round 9 (2026-10-23).** Standard for every
> page. Previews: `../previews/command-dark/bot-card-v3.png` (time), `bots-grid-states.png` (S5,
> sort buttons).

## 1. Time format

| Age | Format | Example |
| --- | --- | --- |
| Under 1 day | "x ago" | 5 min ago, 3 h ago |
| 1 day or more | Exact local time, ISO order | 2026-10-20 16:40 |
| No time | A phrase that says so | Idle · no activity yet |

**Exception: the conversation and its cards use local clock time** (owner, 2026-10-25 03:58).
Message times and card times show "11:10"; plan steps show the start time with seconds and the
duration ("11:12:04 · 0:18", `plan-card.md` §6), because steps are often seconds apart and "x
ago" would change every minute. A tooltip gives the full date and time ("2026-10-25 11:12:04").

Local time uses the `timezone` setting (browser zone when NULL). Time ranges use the D25 picker (`../../requirements/time-range-picker.md`),
not this rule.

## 2. Sort buttons

One sort icon for the whole app: an arrow beside three bars of falling length. The arrow points
down for descending (newest first, Z to A) and up for ascending.

| Interaction | Result |
| --- | --- |
| Click a sort that is off | That sort turns on, in its default direction (newest first) |
| Click the sort that is on | The direction flips |
| The sort that is on | `primary` tint and a solid arrow |
| A sort that is off | Faded arrow |
| Tooltip | Names the sort and the direction, for example "Created time, newest first. Click again for oldest first." |

The same icon and rules apply to sortable table columns: the sorted column label is `primary`
with a solid arrow, the others show a faded arrow, and a second click flips the direction.
