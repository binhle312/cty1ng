# Flag the UI choices in review fixes

Date: 2026-10-31 · Source: M1b review fixes, PR #54 · Status: applied

**Observed.** The review asked to "preserve the draft and show the conflict" and to show "the
required error state". The builder chose the conflict text, the Discard behaviour, a "Try again"
error state and a new History row layout, and did not list them for the owner.

**Cause.** The builder treated review fixes as already approved. A finding says what is wrong,
not which text or layout to use, and `AGENTS.md` §7 still asks the owner to approve UI design.

**Change.** When a review fix needs a new text, state, flow or layout, the PR lists it under
`Needs human review`, one line each.

**Rule now in.** `../workflow.md` §2 step 5 "Cross-review".
