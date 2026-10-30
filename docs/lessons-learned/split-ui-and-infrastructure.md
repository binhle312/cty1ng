# Keep UI work and infrastructure apart

Date: 2026-10-30 · Source: M0c build, PR #49 · Status: applied

**Observed.** M0c was large: the shell UI together with static serving, the API docs page,
`gen:api`, four CI jobs and the one-command launch.

**Cause.** The slice mixed UI and infrastructure, so the build was long, the review was large,
and every fix needed a full gate run.

**Change.** UI work and infrastructure go in separate slices or PRs. Two smaller PRs mean
shorter builds, smaller reviews and fewer full gate runs each.

**Rule now in.** `../workflow.md` §2 step 1 "Slice size" and §8 "Slice too big".
