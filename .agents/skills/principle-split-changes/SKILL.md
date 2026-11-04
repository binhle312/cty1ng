---
name: principle-split-changes
description: Split a plan when independent concerns or separate approval needs make it hard to review or recover.
---

# Split changes

Choose one coherent outcome per change. Use risk and coupling to set its boundary.

1. Name the outcome and the evidence that proves it.
2. Identify interfaces, data, and deploy steps that must change together.
3. Separate independent concerns. Name the dependencies between changes.
4. Keep each intermediate state valid and testable.
5. State the recovery step and compatibility limits.
6. Recheck the scope when fixes add another flow or concern.

Keep coupled changes together when a split would break an intermediate state.
Treat file-count thresholds as local warning signals.

**Done:** Each change has one outcome, a test path, and a recovery path.
