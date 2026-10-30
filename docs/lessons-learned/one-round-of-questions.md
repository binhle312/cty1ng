# Put every open question in the plan

Date: 2026-10-30 · Source: M0c build, PR #49 · Status: applied

**Observed.** The owner answered questions in two rounds: first the pasted review, then the
Hey API and docs page questions.

**Cause.** Questions were raised when the build found them, not collected in the plan.

**Change.** The plan ends with one "Open questions" list, so the owner answers them all at
once. A question found later in the build is noted in the PR as a missed probe or spec gap.

**Rule now in.** `../workflow.md` §2 step 2 "One round of questions", and the builder prompt
in §3.
