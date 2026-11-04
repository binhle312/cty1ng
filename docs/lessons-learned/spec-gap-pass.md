# M0c unresolved shell rules reached the build

Date: 2026-10-30 · Source: M0c build, PR #49 · Status: applied

**Observed.** Several spec gaps were settled during the build: the page URLs, the HD1 pin pill
conflict, whether a hidden bar 2 is remembered, Ctrl+B in text boxes, and the first-run
controls.

**Cause.** Nobody asked what the slice needed that the specs did not say until the code needed
it.

**Project response.** The workflow added a spec gap pass before each slice, with owner answers in the owning documents.

**Reusable principles.** [Resolve uncertainty before the build](../../.agents/skills/principle-resolve-uncertainty-before-build/SKILL.md).

**Project guidance.** [workflow §2](../workflow.md#2-lifecycle-of-a-slice).
