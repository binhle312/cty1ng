# Project incidents and lessons

This folder keeps project-specific evidence: what happened, the cause, the response,
and any remaining constraint. Reusable instructions live in the [principle skills](../../.agents/skills/README.md).
The existing file paths stay stable so earlier review records still resolve.

## Maintenance

- Keep incident dates, source PRs, concrete symptoms, and verification limits.
- Link the applicable principle and the project document or check that applies it.
- Record new general guidance in its principle; record local commands and exceptions in the owning project document.
- Use `applied` for the recorded process response, or `open` when part still waits.
- `applied` does not establish that every defect is closed or that a PR merged.
- Update [delivery quality](../delivery-quality.md) when a review adds or resolves an issue.

All source lessons remain because each contains project evidence.
Their repeated general instructions now point to principles. The table maps every source lesson.
Historical observations keep their original text; later entries can supersede an earlier project state.

| File | Project evidence | Reusable principles | Source | Response status |
| --- | --- | --- | --- | --- |
| `fixes-that-make-new-findings.md` | Review fixes in #84 and #86 made 19 of 37 issues; later reviews found almost only those | [Fix the root cause](../../.agents/skills/principle-fix-root-cause/SKILL.md), [Split changes](../../.agents/skills/principle-split-changes/SKILL.md), [Decide when review ends](../../.agents/skills/principle-when-review-ends/SKILL.md) | PR #84, PR #86 | applied (2026-11-09) |
| `two-of-my-requests-at-once.md` | M2c overlapping local requests and missing list states | [Model state and order](../../.agents/skills/principle-state-and-order/SKILL.md), [Fix the root cause](../../.agents/skills/principle-fix-root-cause/SKILL.md) | M2c, PR #59 | applied |
| `fake-answers-match-the-api.md` | M2c fake pin responses bypassed the success path | [Prove that tests work](../../.agents/skills/principle-prove-tests-work/SKILL.md), [Automate repeated checks](../../.agents/skills/principle-automate-checks/SKILL.md) | M2c, PR #59 | applied |
| `check-every-order-before-the-push.md` | M2c repeated request-order defects | [Model state and order](../../.agents/skills/principle-state-and-order/SKILL.md), [Fix the root cause](../../.agents/skills/principle-fix-root-cause/SKILL.md), [Prove that tests work](../../.agents/skills/principle-prove-tests-work/SKILL.md) | M2c, PR #59 | applied |
| `state-table-before-stateful-code.md` | M2c state complexity caused repeated review findings | [Model state and order](../../.agents/skills/principle-state-and-order/SKILL.md), [Split changes](../../.agents/skills/principle-split-changes/SKILL.md), [Automate repeated checks](../../.agents/skills/principle-automate-checks/SKILL.md) | M2c, PR #59 | applied (2026-11-04) |
| `fix-the-cause-not-the-finding.md` | M2c repeated fixes for fields in late responses | [Fix the root cause](../../.agents/skills/principle-fix-root-cause/SKILL.md) | M2c review fixes, PR #59 | applied |
| `review-contract-boundaries.md` | M2a review missed a cleanup contract difference | [Review with evidence](../../.agents/skills/principle-review-with-evidence/SKILL.md) | M2a review, PR #57 | applied |
| `self-review-against-the-spec.md` | M1b green tests missed five specified behaviours | [Review with evidence](../../.agents/skills/principle-review-with-evidence/SKILL.md), [Prove that tests work](../../.agents/skills/principle-prove-tests-work/SKILL.md) | M1b build, PR #54 | applied |
| `prove-the-test-fails-first.md` | M1b regression test exercised the wrong state and server | [Prove that tests work](../../.agents/skills/principle-prove-tests-work/SKILL.md), [Verify delivery](../../.agents/skills/principle-verify-delivery/SKILL.md) | M1b review fixes, PR #54 | applied |
| `full-gate-before-the-report.md` | M1b incomplete checks missed a Compare regression | [Verify delivery](../../.agents/skills/principle-verify-delivery/SKILL.md) | M1b review fixes, PR #54 | applied |
| `no-real-looking-secrets-in-tests.md` | M1b synthetic key triggered a secret alert | [Use safe test data](../../.agents/skills/principle-safe-test-data/SKILL.md) | M1b build, PR #54 | applied |
| `flag-ui-choices-in-review-fixes.md` | M1b review fixes introduced unlisted UI choices | [Check approval](../../.agents/skills/principle-check-approval/SKILL.md) | M1b review fixes, PR #54 | applied |
| `e2e-server-reuse.md` | M0c end-to-end startup delays | [Verify delivery](../../.agents/skills/principle-verify-delivery/SKILL.md) | M0c build, PR #49 | open (the sandbox hang) |
| `risk-probes-before-plan.md` | M0c libraries failed under project constraints | [Resolve unknowns before the build](../../.agents/skills/principle-resolve-unknowns/SKILL.md) | M0c build, PR #49 | applied |
| `one-round-of-questions.md` | M0c planning questions arrived in separate rounds | [Resolve unknowns before the build](../../.agents/skills/principle-resolve-unknowns/SKILL.md) | M0c build, PR #49 | applied |
| `spec-gap-pass.md` | M0c unresolved shell rules reached the build | [Resolve unknowns before the build](../../.agents/skills/principle-resolve-unknowns/SKILL.md) | M0c build, PR #49 | applied |
| `split-ui-and-infrastructure.md` | M0c combined shell and infrastructure work | [Split changes](../../.agents/skills/principle-split-changes/SKILL.md) | M0c build, PR #49 | applied |
| `write-down-pitfalls.md` | M0c build knowledge remained in PR conversation | [Automate repeated checks](../../.agents/skills/principle-automate-checks/SKILL.md) | M0c build, PR #49 | applied |
