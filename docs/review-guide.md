# Code and PR review guide

Use this guide for local diffs, PR reviews, and reviews of fixes in this project.
It owns the review method; [the review workflow](workflows/review.md) lists the review areas.

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

Start with each acceptance claim that says "all", "each", "every", "no" or "none". Ask: what can be
false while this proof stays the same? A search or a reading shows what it found; it does not show
that nothing else is there. If the proof of such a claim is only a search or a reading, report one
finding: the claim is bigger than its proof. Name the places that you found in it. The fix makes the claim
smaller ([AGENTS.md §9](../AGENTS.md#9-definition-of-done-every-pr); owner, 2026-11-11,
[lesson](lessons-learned/claim-bigger-than-its-proof.md)).

Read each test's setup and assertions. A test name or comment does not establish coverage.
Ask which incorrect behaviour the test would detect.
Run the affected checks; use [testing.md](testing.md) for test rules and the required gates.
Run only the tests and breaks of the diff. Do not run the full gates or the full e2e suite again, and do not
confirm total test counts: the builder's gate run and CI give that proof (owner, 2026-11-09).
Separate local results from CI results and checks that did not run.

For a race, identify the order the test forces and the state it checks afterward.
Sequential calls prove one order; they do not prove an overlap between two operations.
Use controlled pauses or hooks when the requirement depends on a specific overlap.
Check both relevant outcomes and the invariant that must hold in either outcome.
For a screen with a state table ([planning workflow](workflows/planning.md#state-table-for-stateful-screens)),
check that each cell has a test on the pure state module, and look for an event the table does
not have.

For file failures, distinguish failure before publication from failure after a rename or time update.
A fake can prove service recovery. A real adapter test proves only the adapter paths it exercises.
For a bug fix, check the evidence that its test fails on the old code ([testing.md §5](testing.md#5-evidence-in-prs)).
Check the PR's edge case table for each changed screen ([testing.md §3](testing.md#edge-cases-each-slice-tests)). A missing row, or a test that does not reach its case, is a finding.
For a form that fills once, ask where its first values come from ([pitfall](frontend-conventions.md#5-known-pitfalls)).

Record safety assumptions, such as upload duration, grace periods or unique names.
Check whether code enforces each assumption or merely relies on it.

**Complete when:** the evidence column states the behaviour proved and its limits, without relying on a green suite alone.

## 4. Separate safety from compliance

Report a code/contract difference even when no runtime defect is apparent.
Explain the practical effect and distinguish a defect, a contract difference and a missing test.
Use severity ([§6](#6-apply-the-merge-bar)) to express impact; do not turn a documentation mismatch into a claim of data loss.

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
Apply the [root cause principle](../.agents/skills/principle-fix-root-cause/SKILL.md)
to the builder's "Same cause checked in" column. Independently check one further plausible path.
Report a missed path as a new finding with the same cause.
Check the "Same cause as an earlier fix?" column. A repeated cause with no owner's decision is a finding.
So is a redesign with no plan that the owner approved. So is a redesign in a new PR, not in the PR that found the issue ([AGENTS.md §9](../AGENTS.md#9-definition-of-done-every-pr)).
Check that the fix record names the general rule and the search of old fixes ([bug fix, step 2](workflows/bug-fix.md)).
The search covers earlier PRs: "the first fix of this PR" is not an answer to "Same cause as an earlier fix?".
For a claim that was bigger than its proof, check that the fix made the claim smaller. A fix that keeps the
claim and only makes the search bigger is a finding.
If a finding was wrong, name the source or evidence that corrects it.

The final report states the reviewed scope, findings, test results and remaining limits.
Keep contract differences and evidence gaps visible even when there are no confirmed runtime defects.
Link the evidence table and cite file locations for actionable findings.
A finding says what is wrong, not which text or layout to use (`AGENTS.md` §7).
State "no defect found in the reviewed paths" only for paths the table covers.
Give the builder one round row for `delivery-quality.md` §6, or write it when the session allows; the builder commits it.

**Complete when:** each prior finding has a disposition, every unresolved row appears in the report, and the conclusions fit the evidence.

## 6. Apply the merge bar

Give each finding one severity and one reason, from [the merge bar](workflows/merge-bar.md).

**Complete when:** each finding has a severity and a disposition, and a complete review of the final head has no open P1 or P2.
For a P3 PR, the merge bar says which rounds make that review ([when the review of a P3 PR ends](workflows/merge-bar.md#when-the-review-of-a-p3-pr-ends)).

Origin: [the PR #57 review lesson](lessons-learned/review-contract-boundaries.md).
