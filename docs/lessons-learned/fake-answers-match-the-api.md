# A fake answer that the API refuses turns a success test into a failure test

Date: 2026-11-03 · Source: M2c, PR #59 · Status: applied

**Observed.** Three bot page tests answered `PUT /api/bots/pins` with `{ bot_ids: [] }`. The
API answers `{ pinned_bot_ids }`. The generated client checks every response with its Zod
schema, so it refused the fake answer, and the page took the pin change as a failed request: it
showed the failure toast and refreshed. The tests still passed, because the refresh showed the
same list. They were written to prove the success path and only ran the failure path. A fresh
reviewer agent found it while it probed other orders, not a test run.

**Cause.** The fake network (`frontend/test/fake-api.ts`) took any body, and a refused answer
fails quietly by design in the app. Nothing tied a fake answer to the API's shape.

**Change.** The fake records each success answer that the client's response schema refuses,
and `restore()`, which every test calls in `afterEach`, fails the test with the route and the
Zod error. It was seen to fail on the old `{ bot_ids }` answer. A test that wants a malformed
answer can stub `fetch` itself.

**Rule now in.** `../testing.md` §3 "Test helpers".
