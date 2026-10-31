# Run the full gate before the report, and report only what ran

Date: 2026-10-31 · Source: M1b review fixes, PR #54 · Status: applied

**Observed.** After the review fixes, the builder ran lint, typecheck, the unit tests and two
checks, committed, and reported the work as checked. It had not run `gen:api`, `db:check`,
`check:bundle` or the full end-to-end suite. When the full suite finished, it found a
regression: the keyboard-tooltip fix covered the History check boxes, and Compare mode broke.
While the suite still ran, the builder also called it "stuck", but Playwright writes its log
only at the end.

**Cause.** The builder ran only the tests for the changed code and treated that as the gate.
The regression was in a screen that no new test touched.

**Change.** "Done" and "checked" mean that every command in `AGENTS.md` §4 passed, including
the full `pnpm e2e`, after the last code change and before the push. A report names each check
and its result, and says which checks did not run. Nobody reports the state of a run that has
not finished.

**Rule now in.** `../workflow.md` §2 step 4 "Self-check".
