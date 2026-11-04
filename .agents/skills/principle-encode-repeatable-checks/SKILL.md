---
name: principle-encode-repeatable-checks
description: Replace repeated corrections with enforcement, or put judgment rules in one authoritative place.
---

# Encode repeatable checks

Put a repeatable rule in the narrowest reliable check. Keep judgment rules near the work that needs them.

1. Name the failure and the rule that prevents it.
2. Check existing types, schemas, helpers, lint rules, and runtime checks before you add another mechanism.
3. Prove that the check rejects the known failure and permits valid behaviour.
4. Put the check in the normal workflow.
5. Replace duplicate instructions with a link to their source.
6. For judgment rules, state the trigger, action, and completion evidence.
7. Keep local commands, versions, incidents, and exceptions in project records.
8. Link repeated issues to their cause and prevention evidence.

Keep necessary safety and approval boundaries visible.

**Done:** Each rule has one home. Mechanical rules have enforcement evidence; judgment rules have observable completion criteria.
