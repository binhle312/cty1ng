# Do not put real-looking secrets in test code

Date: 2026-10-31 · Source: M1b build, PR #54 · Status: applied

**Observed.** GitHub secret scanning emailed the owner an "OpenAI API Key" alert for
`frontend/test/e2e/skills.spec.ts`. The key was made up, for a test of the likely-secret guard
(D39), but it had the full shape of a real key. The owner had to close the alert, and the
string stays in the branch history.

**Cause.** The builder wrote a new fake key and did not reuse the short fake keys that the
backend tests already used.

**Change.** Test code never holds text with the full shape of a real credential. A test that
needs one builds it at run time from parts, or uses a value that the guard catches but a
scanner does not report.

**Rule now in.** `../testing.md` §3 "Test helpers" (fake secrets); `../security.md` §2.11
(secret scanning).
