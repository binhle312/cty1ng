---
name: principle-fix-invariants-at-the-owner
description: Trace a failure to its first wrong decision, or repair a shared cause when review fixes repeat or several paths enforce one rule.
---

# Fix the broken invariant

A symptom shows where a wrong state became visible. Find the first wrong decision, then repair the mechanism that owns the rule.

1. Reproduce the failure. Read the actual error and state. Add logs if you cannot see them.
2. Ask why at each step until the answer is a wrong decision, not a result of an earlier one.
3. Decide if the system may be in the state that caused the failure.
   - If it may, the code that failed is the cause. Handle the state there.
   - If it may not, find what made the state. A check at the failure only hides the fault.
4. State the violated invariant in one sentence.
5. Search every relevant path by the failed property, even across different mechanisms.
6. Record the search scope and affected paths.
7. Fix the shared owner. Use an explicit allowlist when it expresses the rule.
8. Preserve companion rules when you move or share behaviour.
9. Test each affected path and each new interaction.
10. Have the reviewer check the cause and one further plausible path.

Guards, retries, swallowed errors, clamped values, and discarded state can hide a fault. Use them only for a state the system may be in.
If a failure occurs only after a restart, check persisted state first: config, caches, lock files, and saved data.
If a workaround needs a long comment, change the code.
If the deciding fact was hard to find, propose a cheap signal that always shows it.

Stop patching and propose a redesign when one of these occurs:

- A later finding has the same cause as a fixed finding.
- The rule has no single owner.
- The fix adds another state holder for the same data.

The proposal names the one owner, the code it replaces, and the cost. Follow the approval gate before you build it.

Share an existing common rule. Similar syntax alone does not justify an abstraction.

**Done:** The fix record names the first wrong decision, rule, search scope, repair, and regression evidence. Each repeated cause has a redesign decision.
