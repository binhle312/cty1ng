# M7: Statistics page

Checkpoint: merge (new chart dependency needs the owner's approval in the plan).

## Goal

A `/stats` page where the owner sees, for a chosen period, what each model costs, which bots
do the most work, and which skills are actually used, including skills that bots have pinned
but never load.

## Read first

`docs/decisions/` D15, D21, D24; `docs/domain-model.md` §3.7, §7, §13 (with 13.1 metric
definitions); `docs/api.md` §7; `docs/requirements/statistics.md`, `docs/requirements/time-range-picker.md`; `docs/decisions/` D25.

## In scope

- Indexes from `domain-model.md` §13.1 (migration).
- Endpoints `/stats/summary`, `/stats/models`, `/stats/bots`, `/stats/skills`, CSV export.
  Queries implemented in `core/stats/stats.service.ts` through the stats repository; metric
  formulas as small pure functions in `core/stats/metrics.rules.ts` so they are unit tested.
- Charting library (propose one in the plan; Recharts is the default candidate).
- The shared `TimeRangePicker` (UI-11.1 to UI-11.10, date-math parser §11.3, URL contract §11.4,
  refresh control §11.5);
  also used by the bot usage panel (UI-6.8).
- The page, UI-10.1 to UI-10.9; header link (UI-2.8). The user panel menu shows its Statistics
  item, and the battery opens this page instead of Settings › Spending (UI-1.20, UI-1.22).
- A seed script `make seed-usage` that generates 90 days of realistic fake runs, requests and
  skill loads, for development and the performance check.

## Out of scope

Live-updating charts (the page refetches on period change and on focus; no SSE needed);
provider invoice reconciliation; anything multi-user.

## Acceptance criteria

- UI-10.1 to UI-10.9; UI-11.1 to UI-11.10 (including the calendar, UI-11.5b).
- A click, Enter or a tap on the battery opens Statistics (UI-1.22).
- Date-math parser table tests: every quick range, rounding for From vs To, DST change days,
  month ends, invalid input.
- Opening `/stats?from=now-7d&to=now` shows "Last 7 days"; shifting back produces an absolute
  range in the URL.
- Every metric in `domain-model.md` §13.1 has a unit test with a hand-computed expected value.
- Cache hit rate, failure rate and "never loaded" are correct on a fixture with known numbers.
- Requests without a price are excluded from cost but counted and flagged.
- Deleted bots and deprecated skills still appear in historical figures (greyed / badged).
- Timezone: a run at 23:30 local time is counted in that local day's bucket; switching the
  picker to UTC moves it accordingly.
- UI-10.9 measured with `make seed-usage` data; the PR reports the timings.

## Tests

Metric unit tests; API tests per endpoint with a fixture database; Vitest for table views and
empty states; Playwright: open the page with seeded data, switch period and metric, export CSV.

## Needs human review

The UI design in the plan (layout, components, states), approved before UI code is written
(`docs/workflow.md` §2; sketches in `docs/design/` are not specs).

Index migration; the chart dependency.

## Open questions

None.
