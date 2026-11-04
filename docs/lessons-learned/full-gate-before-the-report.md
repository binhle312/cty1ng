# M1b incomplete checks missed a Compare regression

Date: 2026-10-31 · Source: M1b review fixes, PR #54 · Status: applied

**Observed.** After the review fixes, the builder ran lint, typecheck, the unit tests and two
checks, committed, and reported the work as checked. It had not run `gen:api`, `db:check`,
`check:bundle` or the full end-to-end suite. When the full suite finished, it found a
regression: the keyboard-tooltip fix covered the History check boxes, and Compare mode broke.
While the suite still ran, the builder also called it "stuck", but Playwright writes its log
only at the end.

**Cause.** The builder ran only the tests for the changed code and treated that as the gate.
The regression was in a screen that no new test touched.

**Project response.** The workflow made final-gate timing and per-command results explicit. The full end-to-end run exposed the Compare regression.
The incident records a reporting failure as well as missing checks.

**Reusable principles.** [Verify delivery](../../.agents/skills/principle-verify-delivery/SKILL.md).

**Project guidance.** [workflow §2](../workflow.md#2-lifecycle-of-a-slice), [testing](../testing.md).
