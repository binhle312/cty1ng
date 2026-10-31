# Prove that a fix's test fails on the old code

Date: 2026-10-31 · Source: M1b review fixes, PR #54 · Status: applied

**Observed.** The first test for the repeat-Clone fix passed on the code before the fix. The
test reloaded the page between the two Clones, and the reload cleared the cache that caused the
bug. The test only failed after it moved through the app as a person does (list link → Clone).

**Cause.** The test was written after the fix. A test that has never failed does not prove that
it checks the bug.

**Change.** A bug fix's test is written first and seen to fail. If it was written after the fix,
the builder stashes the fix, rebuilds, and runs the test against the old code. The PR says
which tests were seen to fail.

**Rule now in.** `../workflow.md` §2 step 3; `../testing.md` §5 "Evidence in PRs".
