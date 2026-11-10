# Implement an approved slice

Read this workflow when you implement an approved plan. If a plan is missing, use [planning](planning.md) first.
Before a protected action, check [AGENTS.md §7](../../AGENTS.md#7-what-needs-the-humans-approval-stop-and-ask-or-flag-it-clearly-in-the-pr).

## Build

Make small commits and test first. For each behaviour in the strategy, observe
the expected test failure before you write the code, then refactor with tests green.
Add cases found during the build to the strategy and test them first too.
Follow [the fast test loop](../testing.md#fast-loop-while-building) while fixing.
Use [the evidence rules](../testing.md#5-evidence-in-prs) for a test written after its fix.

## Self-check

Every command in `AGENTS.md` §4 passes, run once in full at the end:
after the last code change, before the push, and with the full `pnpm e2e`. A report names
each check and its result and says which checks did not run; nobody reports a run that has
not finished (lesson `full-gate-before-the-report.md`).
**Spec walk.** Before the PR, the builder reads each section of the slice's spec against the
code, not only the acceptance criteria, and tests the edge cases in `docs/testing.md` §3 ("Edge
cases each slice tests"). The PR lists the sections checked (lesson
`self-review-against-the-spec.md`), and it has one edge case table for each changed screen ([PR template](pull-request.md)).
**Order and list-state checks.** Before the push, check every request on each changed
screen with locks, live events or late answers. Cover all six cases in
[Request order and list states](../testing.md#request-order-and-list-states), including requests away from the reported finding.
Then a fresh reviewer agent, given the code and not the builder's conclusions, tries to
break the screen with forced orders. Point it to [the review workflow](review.md); the builder
does not need to read that file (lesson `check-every-order-before-the-push.md`).
**Delivery records.** After review or fixes, update [delivery quality](../delivery-quality.md#7-update-and-assess).
At handoff, reconcile the PR's issues, review rounds, and verification evidence there.
[Status](../status.md) owns milestone state and next work.
**Evidence.** Fill the PR template in [pull-request.md](pull-request.md) using [testing.md §5](../testing.md#5-evidence-in-prs).
Before each push, also after a review fix, do [the records check](pull-request.md#before-each-push-check-the-records).
Add new library pitfalls, lint patterns or test-helper guidance to their owning document:
`docs/frontend-conventions.md` §5 or `docs/testing.md`.
**The guide stays current.** A slice that changes something the owner can see updates
`seed/skills/using-the-app/SKILL.md` (the Guide bot's knowledge) in the same PR: what works
now, what is not built yet, and the names on the screen (M2 plan, decision 14).

## Respond to review

The other agent reviews the PR and reports its findings.
The builder fixes or answers each. A finding says what is wrong, not which text or layout to
use: when a fix needs a new text, state, flow or layout, the PR lists it under `Needs human
review` (`AGENTS.md` §7; lesson `flag-ui-choices-in-review-fixes.md`).
**Merge bar.** Each finding has a severity. Only P1 and P2 block the merge; a P3 gets its
ledger row, or a follow-up row if it has no DQ id ([merge bar](merge-bar.md)).
**Fix the cause.** Apply the [root cause principle](../../.agents/skills/principle-fix-root-cause/SKILL.md).
Record the search scope in the PR's "Same cause checked in" column ([PR template](pull-request.md)).
If a finding has the same cause as an earlier fix, stop patching ([AGENTS.md §9](../../AGENTS.md#9-definition-of-done-every-pr)).

## Keep docs current

If something diverged from the docs, the PR already updated them. If a decision
changed, `docs/decisions/` has a new file the owner accepts or rejects.
