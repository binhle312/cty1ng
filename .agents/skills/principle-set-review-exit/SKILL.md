---
name: principle-set-review-exit
description: Set the merge bar and failure scope before a build, or when each review round still finds issues.
---

# Set the review exit

Agree when review ends before review starts. Judge risk in the real deployment.

1. Describe the deployment: users, network, data risk, and planned changes.
2. Define each severity by its likelihood and harm in that deployment.
3. State which severities block the merge.
4. State which failure cases and event orders are in scope.
5. Get the owner's approval for this merge bar.
6. Give each issue a severity and a reason.
7. If the builder and reviewer disagree about a severity, ask the owner.
8. Put each issue that does not block on a follow-up list.
9. Stop when a complete review of the final revision has no issue that blocks.
10. Check the bar again when the deployment changes.

The bar does not waive security, data-loss, or approval rules.

**Done:** The owner approved the bar. Each issue has a severity and a disposition. No open issue blocks the final revision.
