# M1b review fixes introduced unlisted UI choices

Date: 2026-10-31 · Source: M1b review fixes, PR #54 · Status: applied

**Observed.** The review asked to "preserve the draft and show the conflict" and to show "the
required error state". The builder chose the conflict text, the Discard behaviour, a "Try again"
error state and a new History row layout, and did not list them for the owner.

**Cause.** The builder treated review fixes as already approved. A finding says what is wrong,
not which text or layout to use, and `AGENTS.md` §7 still asks the owner to approve UI design.

**Project response.** The workflow now routes new UI choices from review fixes through `Needs human review`.
The project design approval boundary remains in `AGENTS.md` §7.

**Reusable principles.** [Check approval](../../.agents/skills/principle-check-approval/SKILL.md).

**Project guidance.** [planning workflow](../workflows/planning.md#ui-design-checkpoint), [AGENTS.md §7](../../AGENTS.md#7-what-needs-the-humans-approval-stop-and-ask-or-flag-it-clearly-in-the-pr).
