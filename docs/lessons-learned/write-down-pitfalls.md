# Write down what a build learned

Date: 2026-10-30 · Source: M0c build, PR #49 · Status: applied

**Observed.** The M0c build learned several library and lint pitfalls and added test helpers,
but they were only in the PR conversation. The next slice could learn them again.

**Cause.** No document owned these lessons, and the definition of done did not ask for them.

**Change.** The pitfalls (CSP, Base UI, lint patterns in tests) and the test helpers
(`renderApp`, `watchCsp`) are written down. Each PR adds what its build learned.

**Rule now in.** `../frontend-conventions.md` §5 "Known pitfalls"; `../testing.md` §3 "Test
helpers"; `../workflow.md` §2 step 4.
