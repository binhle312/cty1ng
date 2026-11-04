# M2a review missed a cleanup contract difference

Date: 2026-11-01 · Source: M2a review, PR #57 · Status: applied

**Observed.** The review at `0eb6b42` checked avatar cleanup and found a missing race test.
It missed a separate difference: approved plan §4a placed staged-file cleanup inside the write lock, but the code ran it outside.
Published-file enumeration also ran before the lock, followed by a locked recheck.
The owner raised the staged-file difference after the review.

**Cause supported by the review record.** The reviewer read both the plan and the code.
The report covered the published-file safety rule but omitted the staged path's compliance with the plan.
The review had no operation-by-operation evidence table to expose that omission before its final conclusion.
No runtime defect was needed to report the contract difference.

**Project response.** The project added a review guide with operation-by-operation evidence and separate compliance and safety conclusions.
The workflow routes local reviews, PR reviews, and follow-up reviews through it.

**Reusable principles.** [Review each contract with explicit evidence](../../.agents/skills/principle-review-contracts-with-evidence/SKILL.md).

**Project guidance.** [review guide](../review-guide.md), [workflow §4](../workflow.md#4-review-prompt-reviewer-agent).
