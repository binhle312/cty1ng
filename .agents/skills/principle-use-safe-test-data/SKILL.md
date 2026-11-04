---
name: principle-use-safe-test-data
description: Create synthetic fixtures when tests or examples need values that resemble credentials or private data.
---

# Use safe test data

Use synthetic data that exercises the intended guard without live access or private information.

1. Identify the exact property the test needs.
2. Reuse an established fake fixture with that property.
3. Avoid full credential shapes when the test does not need them.
4. If full syntax is necessary, build a synthetic value at runtime from harmless parts.
5. Keep that value out of logs, snapshots, reports, and saved artifacts.
6. Verify the intended guard and configured secret checks.

Runtime construction does not make a real credential safe. Keep detectors intact.
A result from one scanner does not prove acceptance by every scanner.

**Done:** The fixture is synthetic, the test exercises the guard, and scanner limits are explicit.
