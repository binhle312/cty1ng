# M0c build knowledge remained in PR conversation

Date: 2026-10-30 · Source: M0c build, PR #49 · Status: applied

**Observed.** The M0c build learned several library and lint pitfalls and added test helpers,
but they were only in the PR conversation. The next slice could learn them again.

**Cause.** No document owned these lessons, and the definition of done did not ask for them.

**Project response.** The project recorded CSP, Base UI, lint patterns, `renderApp`, and `watchCsp` in the conventions and testing guides.
The workflow now routes new build knowledge to those owning documents.

**Reusable principles.** [Automate repeated checks](../../.agents/skills/principle-automate-checks/SKILL.md).

**Project guidance.** [frontend conventions §5](../frontend-conventions.md#5-known-pitfalls), [testing](../testing.md), [workflow §2](../workflow.md#2-lifecycle-of-a-slice).
