# Prove that a fix's test fails on the old code

Date: 2026-10-31 · Source: M1b review fixes, PR #54 · Status: applied

**Observed.** The first test for the repeat-Clone fix passed on the code before the fix. The
test reloaded the page between the two Clones, and the reload cleared the cache that caused the
bug. The test only failed after it moved through the app as a person does (list link → Clone).

**Cause.** The test was written after the fix. A test that has never failed does not prove that
it checks the bug.

**Change.** A bug fix's test is written first and seen to fail. If it was written after the fix,
the builder runs it against the old code in an isolated checkout (a `git worktree`), and stops
every other end-to-end server first. The PR says which tests were seen to fail.

**Later (2026-10-31).** The first version said "stash the fix". The owner asked for an
isolated checkout instead. The first worktree run then passed against the old code: two e2e
servers left from the main checkout were still on ports 8100 and 8101, and Playwright reused
them, so the run tested the new code. Hence the rule to stop other servers first.

**Rule now in.** `../workflow.md` §2 step 3; `../testing.md` §5 "Evidence in PRs".
