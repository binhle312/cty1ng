# M0c libraries failed under project constraints

Date: 2026-10-30 · Source: M0c build, PR #49 · Status: applied

**Observed.** The build hit problems that a short check would have found before the plan:
Zod's `new Function` and Base UI's inline styles broke under the CSP, the Hey API client had
type errors, and Base UI behaved differently from what the tests expected (no tooltip role,
link items that stay open).

**Cause.** The plan was written from the docs only. Libraries new to the repository were first
tried during the build, so each surprise stopped the build.

**Project response.** The workflow added pre-plan probes. The conventions document keeps the CSP, generated-client, and Base UI pitfalls.

**Reusable principles.** [Resolve unknowns before the build](../../.agents/skills/principle-resolve-unknowns/SKILL.md).

**Project guidance.** [workflow §2](../workflow.md#2-lifecycle-of-a-slice), [frontend conventions §5](../frontend-conventions.md#5-known-pitfalls).
