---
name: principle-prove-tests-work
description: Verify tests used as evidence for acceptance, bug fixes, concurrency, or mocked integrations.
---

# Prove that tests work

Prove that the test reaches the intended path and detects its failure.

1. Turn the requirement into an observable assertion.
2. Preserve the actions and state that trigger the defect.
3. Observe the expected failure on unfixed code or with the required behaviour absent.
   If you claim that one test proves several steps, observe the failure of each step alone.
4. Identify the tested checkout, build, server, and fixture data.
5. Validate fake success responses against the consumer's contract.
6. Fail on unintended schema rejection. Mark malformed fixtures as deliberate negative cases.
7. Hold and release requests to force the required overlap or order.
8. Assert intermediate states and the final outcome. Wait on properties the component sets.

A reload can hide a cache defect. Recovery to the same screen does not prove the success path.

**Done:** Record the setup, assertion, revision, expected failure, and result with the fix. State reproduction limits.
