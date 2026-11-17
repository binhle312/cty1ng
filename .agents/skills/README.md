# Project agent skills

The `principle-*` skills are project-owned. Their content stays generic for reuse in other projects.
Each skill has one source here and a relative symlink in `../../.claude/skills/`.
`ui-ux-pro-max` and `typescript-best-practices` are vendored; follow their source rules:
[ui-ux-pro-max](ui-ux-pro-max/SOURCE.md), [typescript-best-practices](typescript-best-practices/SOURCE.md).

## Maintain principles

Before you add, update, or delete a principle:

1. List all existing `principle-*/SKILL.md` files and read each one.
2. Compare the requested rule with every existing principle.
3. If a related principle exists, update it. Do not create another one for that rule.
4. Create a principle only when no existing principle covers the rule.
5. Before deletion, preserve any rule still needed and update its callers.
6. Keep the content short, simple, and direct. Use ASD-STE100 style at the project's 80% target.
7. Use active voice, familiar words, and one instruction per sentence. Limit instructions to 20 words and descriptions to 25.
8. Keep the trigger, essential actions, and completion evidence. Remove repeated explanations.
9. Run the STE checker (`scripts/ste_check.py` of the `ste-writing` skill) and the skill validator (`scripts/quick_validate.py` of the `skill-creator` skill).
   Both skills are user-level tools; they are not in this repository. Inspect flagged text for technical terms and accuracy.
10. Update this index, affected links, and Claude symlinks in the same change.

The project's approval rules still apply. Preserve each vendored skill's source and update process.

## Select a skill

Read the matching skill before its phase of work.

| Folder | Read when |
| --- | --- |
| `principle-resolve-unknowns/` | Use before a build when a requirement is unclear or a library, API or tool is unfamiliar. Resolve unknowns before code depends on them. |
| `principle-design-first/` | Use when a change adds shared state, a new module, adapter, tool or script, a flow across screens, or a new requirement that breaks a rule of the current design. Use it also when the request says to write the code now. Decide and review the code design before the code. |
| `principle-remove-first/` | Use before you add a feature, refactor, or rewrite. Remove unused code, checks, and text first, then build on the simpler base. |
| `principle-split-changes/` | Use when a plan or PR mixes independent outcomes, needs separate approvals, or grows during fixes. Split it into changes with one outcome each. |
| `principle-when-review-ends/` | Use before a build, or when each review round still finds issues. Set the merge bar and the failure scope with the owner. |
| `principle-state-and-order/` | Use when requests overlap, answers arrive late, or state survives navigation, locks, retries, or live events. Model the states and events first. |
| `principle-fix-root-cause/` | Use when you fix a bug or a failure, when review fixes repeat, or when several paths enforce one rule. Find the first wrong decision. |
| `principle-prove-tests-work/` | Use when a test is evidence for an acceptance criterion, a bug fix, concurrency, or a mocked integration. Prove that the test can fail. |
| `principle-review-with-evidence/` | Use when you review code, a PR or a fix. Check each requirement, plan promise and boundary against the code and its evidence. |
| `principle-verify-delivery/` | Use before a handoff, a push to a PR, or a report that work is complete. Verify the final revision and report each check. |
| `principle-ask-with-options/` | Use before you ask a person a question or for a decision. Give a real example, options with gain, cost and risk, and a recommendation. |
| `principle-answer-first/` | Use when a person asks about your work, such as "why X?" or "did you do Y?". Answer and give your view before you act. |
| `principle-check-approval/` | Use when a fix changes approved behaviour, scope, a contract, or a protected operation such as a migration. Check that an approval covers it. |
| `principle-automate-checks/` | Use when the same correction or review issue repeats, or a rule has several copies. Add a check, or give the rule one home. |
| `principle-script-the-work/` | Use when an edit, analysis or check covers many places or is hard to check by eye. Write a script that a reviewer can rerun. |
| `principle-safe-test-data/` | Use when a test, fixture or example needs a value that looks like a credential, key, token or private data. Build a synthetic value. |
| `ui-ux-pro-max/` | Work on interface design; follow the project design rules. |
| `typescript-best-practices/` | Write or review TypeScript; `docs/frontend-conventions.md` wins where they differ (see its `SOURCE.md`). |
| `arena/` | Owner only, with `/arena`: run candidates in parallel on one task, pick a base, and graft the best parts. |
