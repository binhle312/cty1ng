# M1b synthetic key triggered a secret alert

Date: 2026-10-31 · Source: M1b build, PR #54 · Status: applied

**Observed.** GitHub secret scanning emailed the owner an "OpenAI API Key" alert for
`frontend/test/e2e/skills.spec.ts`. The key was made up, for a test of the likely-secret guard
(D39), but it had the full shape of a real key. The owner had to close the alert, and the
string stays in the branch history.

**Cause.** The builder wrote a new fake key and did not reuse the short fake keys that the
backend tests already used.

**Project response.** The test-helper guidance now uses existing short fake keys or synthetic values built at runtime.
The security document records the scanner concern; the original alert and branch history remain part of this incident.

**Reusable principles.** [Use safe test data](../../.agents/skills/principle-safe-test-data/SKILL.md).

**Project guidance.** [testing](../testing.md), [security](../security.md).
