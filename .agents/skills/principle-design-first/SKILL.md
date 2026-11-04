---
name: principle-design-first
description: Decide and review the code design before a change adds shared state, a module boundary, or a flow across several screens.
---

# Design first

Choose the structure while it is cheap to change. Skip this for a change that stays inside one module.

1. Read all affected files and the current design.
2. Write the design on one page: state owner, modules, data flow, and failure paths.
3. Compare at least two options. State the cost of each and how hard it is to change later.
4. For a new requirement in an existing design, add one option: build as if the requirement always existed.
5. Prefer that option. If you choose a smaller addition, state why.
6. Test the riskiest choice with a small prototype.
7. Have a reviewer who did not write the design try to break it.
8. Get the owner's approval before the code.
9. Carry the chosen design through every reference: types, docs, examples, and reasons.
10. Plan the whole design, then deliver it in small changes. See `principle-split-changes`.
11. If the build needs another design, stop and get a new approval.

**Done:** The plan names the chosen design and the reason. No reference describes the old design. Each later design change has a new approval.
