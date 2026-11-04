# Project agent skills

The `principle-*` skills are project-owned. Their content stays generic for reuse in other projects.
Each skill has one source here and a relative symlink in `../../.claude/skills/`.
`principle-fix-root-cause` takes its diagnosis steps from the MIT-licensed
[`principle-fix-root-causes`](https://github.com/cursor/plugins/blob/e5136d82418d2db3165ea1050d17577cd618cc05/pstack/skills/principle-fix-root-causes/SKILL.md) (Lauren Tan), in our words.
`principle-remove-first`, `principle-script-the-work`, and the new-requirement steps of `principle-design-first` take their rules from the MIT-licensed
[`principle-subtract-before-you-add`](https://github.com/cursor/plugins/blob/e5136d82418d2db3165ea1050d17577cd618cc05/pstack/skills/principle-subtract-before-you-add/SKILL.md),
[`principle-build-the-lever`](https://github.com/cursor/plugins/blob/e5136d82418d2db3165ea1050d17577cd618cc05/pstack/skills/principle-build-the-lever/SKILL.md), and
[`principle-redesign-from-first-principles`](https://github.com/cursor/plugins/blob/e5136d82418d2db3165ea1050d17577cd618cc05/pstack/skills/principle-redesign-from-first-principles/SKILL.md) (Lauren Tan), in our words.
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
| `principle-resolve-unknowns/` | Resolve unclear requirements and test unfamiliar dependencies before the implementation depends on them. |
| `principle-design-first/` | Decide and review the code design before a change adds shared state, a module boundary, a multi-screen flow, or a requirement that changes a design. |
| `principle-remove-first/` | Remove unused code, checks, and text before you add a feature, refactor, or rewrite, then build on the simpler base. |
| `principle-split-changes/` | Split a plan when independent concerns or separate approval needs make it hard to review or recover. |
| `principle-when-review-ends/` | Set the merge bar and failure scope before a build, or when each review round still finds issues. |
| `principle-state-and-order/` | Model transitions when requests overlap, replies arrive late, or state survives navigation, locks, retries, or live events. |
| `principle-fix-root-cause/` | Trace a failure to its first wrong decision, or repair a shared cause when review fixes repeat or several paths enforce one rule. |
| `principle-prove-tests-work/` | Verify tests used as evidence for acceptance, bug fixes, concurrency, or mocked integrations. |
| `principle-review-with-evidence/` | Review code or fixes against each requirement, approved plan promise, and implementation boundary. |
| `principle-verify-delivery/` | Verify the final revision before handoff and report the scope and result of each check. |
| `principle-check-approval/` | Check authority when a fix changes approved behaviour, scope, contracts, or protected operations. |
| `principle-automate-checks/` | Replace repeated corrections with enforcement, or put judgment rules in one authoritative place. |
| `principle-script-the-work/` | Write a script that does or proves non-trivial edits, analyses, or checks, so that a reviewer can rerun the work. |
| `principle-safe-test-data/` | Create synthetic fixtures when tests or examples need values that resemble credentials or private data. |
| `ui-ux-pro-max/` | Work on interface design; follow the project design rules. |
| `typescript-best-practices/` | Write or review TypeScript; `docs/frontend-conventions.md` wins where they differ (see its `SOURCE.md`). |
