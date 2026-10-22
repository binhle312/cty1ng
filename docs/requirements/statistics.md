# Statistics

Where money and work go, by model, bot and skill.

## Stories

- **SA-1.** As the owner, I want cost and usage by model over time, so that I know what each model costs me.  
  Acceptance criteria: UI-10.1 to UI-10.3.
- **SA-2.** As the owner, I want to see which bots work the most, so that I know where effort goes.  
  Acceptance criteria: UI-10.4.
- **SA-3.** As the owner, I want to see which skills are used and which are pinned but never loaded, so that I can fix weak skill descriptions.  
  Acceptance criteria: UI-10.5, UI-10.6.
- **SA-4.** As the owner, I want table views, CSV export and a fast page, so that the numbers are usable.  
  Acceptance criteria: UI-10.7 to UI-10.9.

## Acceptance criteria

Shared rules for every story: `README.md` §Applies to every story. Layouts referenced below are sketches in `../design/`, not final designs.

## Statistics page (D24) (UI-10)

Route `/stats`. Answers three questions: what am I spending on which **models**, which
**skills** are actually used, and which **bots** do the most work. All numbers are estimates
(D21) and come from `model_requests`, `runs` and `run_skills`; metric definitions are in
`../domain-model.md` §13.

Layout sketch: see `../design/screens.md` §10 (not final).

- UI-10.1: The time range picker (`time-range-picker.md`, default "Last 30 days") and the conversation filter
  apply to the whole page. Chart bucket size follows the range (`time-range-picker.md`, contract with the backend).
- UI-10.2: Summary tiles: estimated cost, runs, tokens, failure rate; each shows the change
  against the previous range of the same length.
- UI-10.3: **Models**: stacked bar chart per bucket, one series per model, switchable between
  cost, tokens and requests; table with requests, input / output / cache tokens, cache hit rate
  (cache-read ÷ all input), cost, median latency, error count. Requests with no known price
  are counted and flagged "cost unknown".
- UI-10.4: **Bots**: ranked horizontal bars, switchable between runs, cost, tokens and active
  time (sum of run durations); table adds bot turns, handoffs proposed, average run duration,
  failure rate. Deleted bots appear greyed. Clicking a bot opens its detail page.
  Title requests (D46) are not a bot's work, so this ranking leaves them out. The summary
  tiles and the Models section include them.
- UI-10.5: **Skills**: ranked bars of runs that loaded each skill, split by always-loaded vs
  on-demand; table with runs, number of bots pinning it, version mix (how many pins per
  version), last used. Clicking a skill opens it in the hub.
- UI-10.6: **"Pinned but never loaded"**: on-demand pins with zero loads in the period. This
  usually means the skill's description does not tell the bot when to use it.
- UI-10.7: Every chart has a table view (accessibility, and exact numbers), and empty states
  ("No runs in this period").
- UI-10.8: Export the current tables as CSV.
- UI-10.9: The page loads in under 1 s for 90 days and 50,000 model requests on a laptop
  (indexes in `../domain-model.md` §13).
