---
name: principle-design-first
description: Decide and review the code design before a change adds shared state, a module boundary, or a flow across several screens.
---

# Design first

Choose the structure while it is cheap to change. Skip this for a change that stays inside one module.

1. Write the design on one page: state owner, modules, data flow, and failure paths.
2. Compare at least two options. State the cost of each and how hard it is to change later.
3. Test the riskiest choice with a small prototype.
4. Have a reviewer who did not write the design try to break it.
5. Get the owner's approval before the code.
6. If the build needs another design, stop and get a new approval.

**Done:** The plan names the chosen design and the reason. Each later design change has a new approval.
