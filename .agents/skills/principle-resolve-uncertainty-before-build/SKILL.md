---
name: principle-resolve-uncertainty-before-build
description: Resolve unclear requirements and test unfamiliar dependencies before the implementation depends on them.
---

# Resolve uncertainty before the build

Separate facts, assumptions, and open decisions before the build.

1. Read the current requirements and their amendments.
2. Identify missing rules for inputs, outputs, failures, and dependencies.
3. Probe unfamiliar parts under the actual constraints.
4. Record each probe's command, environment, result, and limits.
5. Present known questions together, with a recommended choice and its trade-off.
6. Resolve decisions that can change the design before dependent work starts.
7. Continue independent work. Report new material questions when evidence reveals them.

**Done:** Each material risk has evidence or a decision. Each open item names the work that must wait.
