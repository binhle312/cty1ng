# Code and PR review guide

Use this guide for local diffs, PR reviews, and reviews of fixes in this project.
It owns the review method; [workflow.md §4](workflow.md#4-review-prompt-reviewer-agent) lists the review areas.

The required record is **plan requirement → implementation boundary → test evidence**.
Judge runtime safety and compliance separately. A safe implementation can still differ from an approved contract.

## 1. Fix the review scope

Record the base and head commit IDs, the merge-base diff, and any uncommitted changes included in the review.
For a PR, check that its head matches the code under review.
For a follow-up, record the previous reviewed head and carry forward each open finding.

Read the task brief, the approved plan revision, and the owning specs for the changed behaviour.
Follow the amendments in `decisions/README.md` as required by `AGENTS.md` §2.
Name any source that is missing or conflicts with another source.

**Complete when:** the report identifies the exact code and contract revisions under review, including any limits on scope.

## 2. Build the evidence table

Keep this table in the review record. Link it from the report if it is too large to include there.
Use a local artifact or the requested review destination; publication follows the session's authorization.

| Requirement and source section | Operation and implementation boundary | Test or other evidence | Compliance | Safety / correctness |
| --- | --- | --- | --- | --- |
| Exact rule; approved plan revision or spec section | File and symbol/line; actual lock, transaction, validation or lifecycle boundary | Test name; setup and assertion that exercise the rule; run result and head | matches / differs / unclear / not checked | no defect found / defect / unverified |

Use one row per independently checkable obligation. Split a compound requirement before you judge it.
Include plan promises about ordering, failures and recovery, not only the brief's acceptance criteria.
Trace calls into unchanged code when the changed behaviour depends on that code to meet the contract.

For locks and transactions, enumerate each operation: list, check, write, publish, delete and emit an event.
Record where each operation runs: before the lock, inside it, after commit or on failure.
For UI state, trace the action through pending, error, retry and updates from another tab.

If reviewers divide the work, give each requirement group one named owner.
The lead checks the combined rows for gaps between assignments before the final conclusion.

**Complete when:** every in-scope obligation has a row with an explicit result or an explicit evidence gap.

## 3. Verify what the evidence proves

Read each test's setup and assertions. A test name or comment does not establish coverage.
Ask which incorrect behaviour the test would detect.
Run the affected checks; use [testing.md](testing.md) for test rules and the required gates.
Separate local results from CI results and checks that did not run.

For a race, identify the order the test forces and the state it checks afterward.
Sequential calls prove one order; they do not prove an overlap between two operations.
Use controlled pauses or hooks when the requirement depends on a specific overlap.
Check both relevant outcomes and the invariant that must hold in either outcome.

For file failures, distinguish failure before publication from failure after a rename or time update.
A fake can prove service recovery. A real adapter test proves only the adapter paths it exercises.
For a bug fix, check the evidence that its test fails on the old code ([workflow.md §2](workflow.md#2-lifecycle-of-a-slice)).

Record safety assumptions, such as upload duration, grace periods or unique names.
Check whether code enforces each assumption or merely relies on it.

**Complete when:** the evidence column states the behaviour proved and its limits, without relying on a green suite alone.

## 4. Separate safety from compliance

Report a code/contract difference even when no runtime defect is apparent.
Explain the practical effect and distinguish a defect, a contract difference and a missing test.
Use severity to express impact; do not turn a documentation mismatch into a claim of data loss.

For example, a plan may put all cleanup under a write lock. Check these as separate rows:

| Operation | Review question |
| --- | --- |
| Published-file enumeration | Does it run where the plan says? If it runs before the lock, what does the locked recheck establish? |
| Published-file check and deletion | Can a save or publish occur between the final check and deletion? |
| Staged-file cleanup | Does its own list-and-delete path use the promised lock? What proves that a candidate is no longer active? |

A locked recheck can make early enumeration safe. That does not make it match a plan that requires enumeration inside the lock.
Record the difference and its rationale. The builder either follows the contract or gets approval for a documented change.
A reviewer's recommendation is not approval of that change.

**Complete when:** every difference has both a compliance result and a separate safety result, with a clear next action.

## 5. Close findings with evidence

For each earlier finding, report **fixed**, **partial**, **open**, or **withdrawn**, with the supporting evidence.
Check the fix and the paths it affects. A new commit or a passing test alone does not close the finding.
If a finding was wrong, name the source or evidence that corrects it.

The final report states the reviewed scope, findings, test results and remaining limits.
Keep contract differences and evidence gaps visible even when there are no confirmed runtime defects.
Link the evidence table and cite file locations for actionable findings.
State "no defect found in the reviewed paths" only for paths the table covers.

**Complete when:** each prior finding has a disposition, every unresolved row appears in the report, and the conclusions fit the evidence.

Origin: [the PR #57 review lesson](lessons-learned/review-contract-boundaries.md).
