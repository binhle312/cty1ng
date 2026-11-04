---
name: principle-fix-invariants-at-the-owner
description: Repair a shared cause when review fixes repeat or several paths enforce the same rule.
---

# Fix the broken invariant

Name the broken rule and repair the mechanism that owns it.

1. State the violated invariant in one sentence.
2. Search every relevant path by the failed property, even across different mechanisms.
3. Record the search scope and affected paths.
4. Fix the shared owner. Use an explicit allowlist when it expresses the rule.
5. Preserve companion rules when you move or share behaviour.
6. Test each affected path and each new interaction.
7. Have the reviewer check the cause and one further plausible path.

Stop patching and propose a redesign when one of these occurs:

- A later finding has the same cause as a fixed finding.
- The rule has no single owner.
- The fix adds another state holder for the same data.

The proposal names the one owner, the code it replaces, and the cost. Follow the approval gate before you build it.

Share an existing common rule. Similar syntax alone does not justify an abstraction.

**Done:** The fix record names the rule, search scope, repair, and regression evidence. Each repeated cause has a redesign decision.
