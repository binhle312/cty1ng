# M5: Bot discussion

Checkpoint: merge only (the rules are fully specified; the risk is in tests).

## Goal

Bots can mention each other and discuss within a turn budget the owner sets globally or per
conversation. The server enforces the budget; bots are told how many turns remain.

## Read first

`docs/conversation-rules.md` §2; `docs/decisions/` D4, D20; `docs/requirements/conversation.md`
(UI-3.15), `docs/requirements/settings.md` (UI-8, UI-9.3); `docs/testing.md` §2 (fake scripts with mentions), §3.

## In scope

- `decideRuns` for bot triggers (every row of `conversation-rules.md` §2), counter updates,
  notices.
- Rules block in the prompt with live numbers.
- The Settings page (`design/components/settings-page.md`, UI-8.0 to UI-8.3, UI-8.5, UI-8.7,
  UI-8.8): the Settings list and the pages Profile, Spending, Bot discussion, Limits (the rows of
  this slice), New bots, Models and Appearance with its page slides. Rows of later slices stay
  hidden until their slice ships. The header discussion status with its popover (UI-3.15,
  UI-9.3, `conversation-page.md` §2.4).
- Runs-per-hour cap.
- Daily spending cap (D20) and optional per-provider caps (D42): settings, check at claim time,
  75% / 90% / 100% alerts per cap (D40), UI-8.3.

## Acceptance criteria

- Every row of `conversation-rules.md` §2 has a passing table test, including: three mentions
  with one turn left; limit lowered below the counter; discussion turned off mid-discussion.
- With limit 2 and a fake script where bots keep mentioning each other, exactly 2 bot turns run
  and the "limit reached" notice appears once (J2, e2e step 4).
- The prompt of each bot turn shows the correct "used of limit" numbers (agent test).
- Changing the limit posts a notice and applies to the next decision, not the running run.
- In the popover, **Custom** saves on Enter or a click outside, Esc puts back the last value, and
  21 is refused with the field error (component test).
- Every Settings row has a name, an effect line and a note (component test against the row data;
  `ui-rules.md` W9).
- Runs-per-hour cap refuses with 429 / notice.
- With a cap of $0.10 and fake prices, the run that crosses the cap finishes and the next one is
  refused with `daily_cap_reached`; raising the cap lets runs continue.
- With a total cap of $1 and an OpenAI cap of $0.10 (fake prices), the run that crosses the
  OpenAI cap finishes, the next OpenAI bot run is refused with `provider_cap_reached`, and a bot
  on another provider still runs. Alerts fire once per threshold per cap.
- With a total cap on, a bot on a fake model with no price is refused with `price_unknown` and
  the notice; with the cap off, the same bot runs and shows "cost unknown"; a title request on
  that model is `skipped` with reason `cap` (D42 amendment 2026-10-27).

## Tests

As above, plus an API test that settings inheritance (`null` = global) works.

## Needs human review

The UI design in the plan (layout, components, states), approved before UI code is written
(`docs/workflow.md` §2; sketches in `docs/design/` are not specs).

None expected beyond the usual.

## Open questions

None.
