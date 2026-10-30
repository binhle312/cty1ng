# Find the spec gaps before the slice starts

Date: 2026-10-30 · Source: M0c build, PR #49 · Status: applied

**Observed.** Several spec gaps were settled during the build: the page URLs, the HD1 pin pill
conflict, whether a hidden bar 2 is remembered, Ctrl+B in text boxes, and the first-run
controls.

**Cause.** Nobody asked what the slice needed that the specs did not say until the code needed
it.

**Change.** Before each slice, an agent does a short spec gap pass. The owner answers in one
round, and the answers go into the owning documents in a docs-only PR.

**Rule now in.** `../workflow.md` §2 step 1 "Spec gap pass".
