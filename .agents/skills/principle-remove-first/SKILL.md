---
name: principle-remove-first
description: Remove unused code, checks, and text before you add a feature, refactor, or rewrite, then build on the simpler base.
---

# Remove first

Remove what the change does not need. Then build on the simpler base.
Leave the design simpler than you found it. If a simpler way reaches the same goal, use it.

1. List what the change touches: code, checks, references, and prompt text.
2. Mark each item that has no current use or adds no new content.
3. Search callers, tests, and docs to prove that nothing needs each marked item.
4. Remove those items in their own commit, before the new code.
5. Delete a reference that has no new content. A stub is not necessary.
6. Build for usage that you can observe now.
7. Add a guard or parser only when a spec, an approved failure scope, or a known failure needs it.
8. Cut the change to its minimum before you polish it.

Remove only inside the task's scope. Report other candidates and leave them in place.
A style change alone does not make a design simpler.
Keep each check that a security or approval rule requires.
If a removal changes visible behaviour, treat it as an open decision.

**Done:** Each removal has evidence that nothing needs it. Removals come before additions. Each new guard names its reason. The design is simpler than before, or the report says why not.
