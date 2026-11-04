# M2c repeated fixes for fields in late responses

Date: 2026-11-03 · Source: M2c review fixes, PR #59 · Status: applied

**Observed.** A review found that a late Profile answer brought back an old Always load
setting. The fix kept the answer's `pins` and skill counts out of the merge. The next review
found the same bug with the pinned position and health, and that fix added two more fields to
the same list. "Discard while Save waits" took four rounds in the same way, one case each.

**Cause.** Each fix answered the finding as written. Nobody named the rule behind it ("an
answer writes only the fields its request owns") or searched for the other places that broke
it. A list of fields to keep grows by one each time a review finds the next field.

**Project response.** The review-fix table gained a "Same cause checked in" column. The review guide added a further-path check.
The later state-module incident records the allowlist implementation.

**Reusable principles.** [Fix the root cause](../../.agents/skills/principle-fix-root-cause/SKILL.md).

**Project guidance.** [workflow §6](../workflow.md#6-pr-description-template), [review guide §5](../review-guide.md#5-close-findings-with-evidence), [state-module incident](state-table-before-stateful-code.md).
