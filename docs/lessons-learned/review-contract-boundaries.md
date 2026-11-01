# Review each contract boundary, even when the code appears safe

Date: 2026-11-01 · Source: M2a review, PR #57 · Status: applied

**Observed.** The review at `0eb6b42` checked avatar cleanup and found a missing race test.
It missed a separate difference: approved plan §4a placed staged-file cleanup inside the write lock, but the code ran it outside.
Published-file enumeration also ran before the lock, followed by a locked recheck.
The owner raised the staged-file difference after the review.

**Cause supported by the review record.** The reviewer read both the plan and the code.
The report covered the published-file safety rule but omitted the staged path's compliance with the plan.
The review had no operation-by-operation evidence table to expose that omission before its final conclusion.
No runtime defect was needed to report the contract difference.

**Change.** The project now has a reviewer guide with an evidence table and explicit completion checks.
The workflow routes local code reviews, PR reviews and follow-up reviews through that guide.
The table requires separate compliance and safety conclusions, including the limits of the test evidence.

**Rule now in.** [review-guide.md](../review-guide.md), reached from [workflow.md §4](../workflow.md#4-review-prompt-reviewer-agent).
