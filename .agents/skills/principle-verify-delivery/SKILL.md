---
name: principle-verify-delivery
description: Verify the final revision before handoff and report the scope and result of each check.
---

# Verify delivery

Use focused checks during fixes. Run the required delivery gate before handoff.

1. Identify required checks and acceptance evidence.
2. During a fix, test its behaviour and likely interactions.
3. Before service reuse, confirm the checkout, build, configuration, data, and isolation.
4. Measure startup delays separately from test execution.
5. Run the required gate on the final relevant revision.
6. After another change, rerun the checks required by that gate.
7. Record each command as passed, failed, running, blocked, or not run.
8. State unresolved issues and evidence limits.

A quiet process does not prove a hang. Check its logs and process status.
A partial run cannot support a full-gate claim.

**Done:** The report names the tested revision, check results, acceptance assertions, and missing evidence.
