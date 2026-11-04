# Project agent skills

The `principle-*` skills are project-owned. Their content stays generic for reuse in other projects.
Each skill has one source here and a relative symlink in `../../.claude/skills/`.
`principle-fix-invariants-at-the-owner` takes its diagnosis steps from the MIT-licensed
[`principle-fix-root-causes`](https://github.com/cursor/plugins/blob/e5136d82418d2db3165ea1050d17577cd618cc05/pstack/skills/principle-fix-root-causes/SKILL.md) (Lauren Tan), in our words.
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
9. Run the STE checker and skill validator. Inspect flagged text for technical terms and accuracy.
10. Update this index, affected links, and Claude symlinks in the same change.

The project's approval rules still apply. Preserve each vendored skill's source and update process.

## Select a skill

Read the matching skill before its phase of work.

| Folder | Read when |
| --- | --- |
| `principle-resolve-uncertainty-before-build/` | Resolve unclear requirements and test unfamiliar dependencies before the implementation depends on them. |
| `principle-decide-design-before-build/` | Decide and review the code design before a change adds shared state, a module boundary, or a flow across several screens. |
| `principle-bound-change-scope/` | Split a plan when independent concerns or separate approval needs make it hard to review or recover. |
| `principle-set-review-exit/` | Set the merge bar and failure scope before a build, or when each review round still finds issues. |
| `principle-model-state-and-order/` | Model transitions when requests overlap, replies arrive late, or state survives navigation, locks, retries, or live events. |
| `principle-fix-invariants-at-the-owner/` | Trace a failure to its first wrong decision, or repair a shared cause when review fixes repeat or several paths enforce one rule. |
| `principle-prove-tests-detect-the-behaviour/` | Verify tests used as evidence for acceptance, bug fixes, concurrency, or mocked integrations. |
| `principle-review-contracts-with-evidence/` | Review code or fixes against each requirement, approved plan promise, and implementation boundary. |
| `principle-verify-delivery-and-report-evidence/` | Verify the final revision before handoff and report the scope and result of each check. |
| `principle-preserve-approval-boundaries/` | Check authority when a fix changes approved behaviour, scope, contracts, or protected operations. |
| `principle-encode-repeatable-checks/` | Replace repeated corrections with enforcement, or put judgment rules in one authoritative place. |
| `principle-use-safe-test-data/` | Create synthetic fixtures when tests or examples need values that resemble credentials or private data. |
| `ui-ux-pro-max/` | Work on interface design; follow the project design rules. |
| `typescript-best-practices/` | Write or review TypeScript; `docs/frontend-conventions.md` wins where they differ (see its `SOURCE.md`). |
