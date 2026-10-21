# Time range picker

One Grafana-style picker for every time range in the app (D25).

## Stories

- **TR-1.** As the owner, I want quick ranges, custom From/To with date math, a calendar and recent ranges, so that picking time works like Grafana.  
  Acceptance criteria: UI-11.1 to UI-11.9.
- **TR-2.** As the owner, I want a refresh button and auto-refresh interval, so that live data stays current.  
  Acceptance criteria: UI-11.10.

## Acceptance criteria

Shared rules for every story: `README.md` §Applies to every story. Layouts referenced below are sketches in `../design/`, not final designs.

## Shared component: time range picker (D25) (UI-11)

Every time range selection in the app uses one component, `TimeRangePicker`, modelled on
Grafana's time picker so it behaves the way the owner already knows. We copy the **behaviour**,
not Grafana's code: Grafana is AGPL-licensed, so its source must not be pasted into this repo.

Layout sketch: see `../design/screens.md` §11 (not final).

### Button row

- UI-11.1: The main button shows the current range: the quick range label when one is active
  ("Last 30 days"), otherwise `2026-10-18 00:42 to 2026-10-18 01:07`; plus the timezone
  short name. Clicking opens the popover.
- UI-11.2: `‹‹` shifts the range back by its own length (Last 7 days → the 7 days before);
  `››` shifts forward but never past now. A shifted range becomes absolute.
- UI-11.3: `⊖` zooms out: doubles the range around its centre (clamped to now).
- UI-11.4: Keyboard: `t ←` / `t →` shift, `t z` zooms out, `Esc` closes the popover (as in
  Grafana).

### Popover

- UI-11.5: **From / To** inputs accept absolute timestamps (`2026-10-18 00:42:06`) or relative
  expressions (see Relative expressions below). Invalid input shows an inline error and disables Apply. From must be
  before To.
- UI-11.5b: **Calendar**: the calendar button next to either input opens a side panel to the
  left of the popover titled "Select a time range", with a close (×) button:
  - month header with `‹` / `›` to change month; weekday row starting Monday; days of the
    adjacent months shown muted;
  - today is marked; the current From–To span is highlighted;
  - **range selection**: first click sets the start day, second click sets the end day (a second
    click before the first swaps them); From becomes `<start> 00:00:00` and To becomes
    `<end> 23:59:59` in the active timezone; the inputs update but nothing is applied until
    **Apply time range**;
  - days in the future are disabled (this app has no future data);
  - keyboard: arrows move the focused day, Enter selects, PageUp/PageDown change month, Esc
    closes the panel.
- UI-11.6: **Apply time range** applies From/To and closes the popover. Applying an absolute
  range adds it to "Recently used absolute ranges" (last 4, kept in browser storage).
- UI-11.7: **Copy** puts `{"from":"now-30d","to":"now"}` on the clipboard; **Paste** reads it
  back (lets the owner move a range between pages).
- UI-11.8: **Quick ranges** list with search box; the active one is highlighted with a left
  accent bar. Selecting applies immediately and closes the popover. Quick ranges set
  relative expressions (they stay "live": "Last 7 days" tomorrow means tomorrow's last 7 days).
- UI-11.9: Footer shows the active timezone and offset; **Change time settings** lets the owner
  pick Local (browser), UTC, or any IANA zone. The choice is a global setting (`settings.md`, UI-8.4) shared by
  every picker and by day/week bucketing on the server.

Quick ranges for this app (usage data is sparse at the minute level, so very short ranges are
left out):

| Label | From | To |
| --- | --- | --- |
| Last 15 minutes | `now-15m` | `now` |
| Last 1 hour | `now-1h` | `now` |
| Last 6 hours | `now-6h` | `now` |
| Last 24 hours | `now-24h` | `now` |
| Last 7 days | `now-7d` | `now` |
| Last 30 days | `now-30d` | `now` |
| Last 90 days | `now-90d` | `now` |
| Today | `now/d` | `now/d` |
| Yesterday | `now-1d/d` | `now-1d/d` |
| This week so far | `now/w` | `now` |
| Previous week | `now-1w/w` | `now-1w/w` |
| This month so far | `now/M` | `now` |
| Previous month | `now-1M/M` | `now-1M/M` |

### Relative expressions (Grafana date math)

Grammar: `now`, optionally followed by offsets `±<n><unit>`, optionally followed by a rounding
`/<unit>`. Units: `s m h d w M y`. Rounding goes to the start of the unit for **From** and the
end of the unit for **To** (so `now/d` to `now/d` is all of today), in the active timezone.
Weeks start on Monday.

| Expression | Meaning |
| --- | --- |
| `now-30m` | 30 minutes ago |
| `now/d` | start of today (as From) / end of today (as To) |
| `now-1d/d` | start / end of yesterday |
| `now-1M/M` | start / end of last month |
| `now+1h` | invalid as To in this app (future ranges are not useful here) |

The parser lives in `frontend/src/lib/timerange/` as pure functions with table tests, including
DST transitions and month ends. It is our own small implementation; no Grafana code.

### Contract with the backend and the URL

- The frontend resolves expressions to **absolute ISO-8601 instants** before calling the API;
  the backend only receives `from`, `to`, `tz` (IANA name) and `bucket`. This keeps date math in
  one place.
- Bucket size from range length: ≤ 6 h → 5 min; ≤ 48 h → 1 h; ≤ 90 days → 1 day; longer →
  1 week. Buckets align to the active timezone.
- The page URL carries the **unresolved** range (`/stats?from=now-30d&to=now&tz=local`), so a
  bookmarked or shared URL keeps meaning "last 30 days", as in Grafana. Back/forward navigation
  restores ranges.
- Relative ranges re-resolve when the page is opened, the range changes, the window regains
  focus, or the refresh control fires (UI-11.10).

### Refresh control

- UI-11.10: Next to the picker, as in Grafana: a **Refresh** button (re-resolves the range and
  refetches now) and an interval dropdown: Off, 5s, 10s, 30s, 1m, 5m, 15m, 30m, 1h. Default Off.
  Auto-refresh pauses while the browser tab is hidden and when the range is absolute (nothing
  new can appear). The interval is kept in the URL (`&refresh=1m`).
