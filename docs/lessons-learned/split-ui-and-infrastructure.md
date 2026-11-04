# M0c combined shell and infrastructure work

Date: 2026-10-30 · Source: M0c build, PR #49 · Status: applied

**Observed.** M0c was large: the shell UI together with static serving, the API docs page,
`gen:api`, four CI jobs and the one-command launch.

**Cause.** The slice mixed UI and infrastructure, so the build was long, the review was large,
and every fix needed a full gate run.

**Project response.** The project workflow separates UI and infrastructure slices. It names static serving, API docs, generation, CI, and launch work as infrastructure.

**Reusable principles.** [Split changes](../../.agents/skills/principle-split-changes/SKILL.md).

**Project guidance.** [workflow §2](../workflow.md#2-lifecycle-of-a-slice), [workflow §8](../workflow.md#8-when-things-go-wrong).
