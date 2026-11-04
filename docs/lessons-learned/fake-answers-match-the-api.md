# M2c fake pin responses bypassed the success path

Date: 2026-11-03 · Source: M2c, PR #59 · Status: applied

**Observed.** Three bot page tests answered `PUT /api/bots/pins` with `{ bot_ids: [] }`. The
API answers `{ pinned_bot_ids }`. The generated client checks every response with its Zod
schema, so it refused the fake answer, and the page took the pin change as a failed request: it
showed the failure toast and refreshed. The tests still passed, because the refresh showed the
same list. They were written to prove the success path and only ran the failure path. A fresh
reviewer agent found it while it probed other orders, not a test run.

**Cause.** The fake network (`frontend/test/fake-api.ts`) took any body, and a refused answer
fails quietly by design in the app. Nothing tied a fake answer to the API's shape.

**Project response.** The fake API records success responses rejected by the client schema. Its `restore()` call in `afterEach` fails with the route and schema error.
The check failed on the old `{ bot_ids }` fixture. Deliberately malformed responses use an explicit `fetch` stub.

**Reusable principles.** [Prove that tests work](../../.agents/skills/principle-prove-tests-work/SKILL.md), [Automate repeated checks](../../.agents/skills/principle-automate-checks/SKILL.md).

**Project guidance.** [testing](../testing.md), `frontend/test/fake-api.ts`.
