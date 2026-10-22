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
- Global settings page (UI-8.1, 8.2) and conversation discussion settings (UI-9.3), header
  status (UI-3.15).
- Runs-per-hour cap.
- Daily spending cap (D20): settings, check at claim time, 75% / 90% / 100% alerts (D40), UI-8.3.

## Acceptance criteria

- Every row of `conversation-rules.md` §2 has a passing table test, including: three mentions
  with one turn left; limit lowered below the counter; discussion turned off mid-discussion.
- With limit 2 and a fake script where bots keep mentioning each other, exactly 2 bot turns run
  and the "limit reached" notice appears once (J2, e2e step 4).
- The prompt of each bot turn shows the correct "used of limit" numbers (agent test).
- Changing the limit posts a notice and applies to the next decision, not the running run.
- Runs-per-hour cap refuses with 429 / notice.
- With a cap of $0.10 and fake prices, the run that crosses the cap finishes and the next one is
  refused with `daily_cap_reached`; raising the cap lets runs continue.

## Tests

As above, plus an API test that settings inheritance (`null` = global) works.

## Needs human review

The UI design in the plan (layout, components, states), approved before UI code is written
(`docs/workflow.md` §2; sketches in `docs/design/` are not specs).

None expected beyond the usual.

## Open questions

None.
