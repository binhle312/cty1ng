# Fix a bug or defect

Before a protected action, check [AGENTS.md §7](../../AGENTS.md#7-what-needs-the-humans-approval-stop-and-ask-or-flag-it-clearly-in-the-pr).

Every agent assigned a bug report, regression, or defect issue in this repository follows this sequence.
It also applies to defects from reviews and audits. The agent that delegates the issue includes this workflow in the handoff.

1. **Reproduce.** State the expected behaviour from the owning specification and the observed behaviour.
   Reproduce the failure before you change production code. Record the revision, steps, and result.
   If reproduction fails, report what you checked and the missing evidence to the owner or coordinating agent.
   Keep the issue unconfirmed; do not implement a speculative fix.
2. **Diagnose.** Apply the [root cause principle](../../.agents/skills/principle-fix-root-cause/SKILL.md).
   Explain the cause and propose the smallest fix, affected files, and verification steps.
   Write the general rule that the bug broke, not only its symptom. Search the old fixes in
   [delivery quality](../delivery-quality.md) and [lessons](../lessons-learned/README.md) for that rule,
   and record the search. The lesson of DQ-003 named a symptom, so the same bug came back in new code (owner, 2026-11-06).
3. **Check approval.** Confirm that the fix fits the approved scope and design.
   Reuse existing approval. Otherwise, obtain approval through the owner or coordinating agent before implementation.
   The [human checkpoints](../../AGENTS.md#7-what-needs-the-humans-approval-stop-and-ask-or-flag-it-clearly-in-the-pr) still apply.
4. **Fix and test.** Implement the approved fix within the assigned files.
   Prove that the regression test fails for the original defect and passes after the fix.
   Follow [the evidence rules](../testing.md#5-evidence-in-prs) for tests written after the fix.
5. **Verify behaviour.** Exercise the affected flow through the live app, API, or command, as appropriate.
   Use the fake model and synthetic test data per [testing.md](../testing.md).
   Complete the [implementation self-check](implementation.md#self-check). A successful build alone does not prove the fix.
6. **Return evidence.** Report the cause, diff summary, tested revision, test results before and after the fix, and runtime evidence.
   Include screenshots or video when useful for UI behaviour. List unavailable checks and remaining gaps explicitly.
   Keep an issue open when its required verification is incomplete.
   Follow the repository's authorization rules for external actions; any authorized PR stays a draft.
