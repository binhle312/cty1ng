# A claim bigger than its proof

Date: 2026-11-11 · Source: the two review rounds of PR #98 · Status: applied (2026-11-11; the measure is open)

**Observed.** PR #98 gave each default and range of a setting one home in the documents. The
owner had approved "give each settings range and default one home". The builder wrote this
acceptance criterion: "No copy of a default or range stays in a spec document outside its
home". Its proof was a search script from the session and a second search by hand.

| Step | What happened |
| --- | --- |
| Review of `7f791c5` | Seven copies stayed as rules (DQ-203) |
| Fix 1 | The builder wrote a wider search, corrected the places that it found, and kept the claim. The same row of the PR description said "not a proof" |
| Review of `44fa8cf` | Two more copies: one used a column name and stood on two lines, one was a word and not a number (DQ-204) |
| Stop | The builder saw the repeated cause and asked the owner (`AGENTS.md` §9). The owner chose the smaller claim |

Cost: two review rounds, 26 changed files in place of 18, three runs of all gates, and one
owner decision in the middle of the PR. Nothing reached `main`.

**Cause.** The first wrong decision: the builder turned a task ("give each default one home")
into a claim about all documents ("no copy stays"), and used a search as its proof. A search
shows what it found. It cannot show that nothing else is there.

The second wrong decision made the second round: fix 1 repaired the proof and not the claim.
That was the easy path. A wider search needed no approval. A smaller claim looked like a change
of scope, which needs the owner.

**Why the rules did not stop it.**

| Rule | Why it did not help |
| --- | --- |
| "Each claim … needs a real run" (`docs/testing.md` §5) | The builder had a run. The rule does not ask if the run covers the words of the claim |
| "Claim no more than the breaks prove" (`docs/testing.md` §5) | It is a rule for tests. A docs PR has no break list |
| Search the old fixes for the same cause ([bug fix, step 2](../workflows/bug-fix.md)) | After review 1 the builder answered "No. This is the first review fix of this PR" and did not search. [The lesson of 2026-11-09](fixes-that-make-new-findings.md) already names this cause for ten issues |

In each row the builder judged its own proof. The lesson of 2026-11-09 says why that fails:
"The builder breaks the claims that it already believes, so the gaps stay where it did not look."

**Response.** The owner asked three consultants and a judge (skill `arena`, 2026-11-11). All
three named the same cause. The owner approved three changes on 2026-11-11:

1. **A smaller claim is the default** (`AGENTS.md` §9). When a review shows that a claim is
   bigger than its proof, the fix corrects the places found and makes the claim smaller, with a
   `Not claimed` line. The builder does not stop to ask; the owner reads the line before the
   merge. A criterion from a task brief or an approved plan is the exception.
2. **The reviewer tests each "all" or "none" claim first** (`docs/review-guide.md` §3), with one
   question: what can be false while this proof stays the same?
3. **The "same cause" answer covers all PRs** (`AGENTS.md` §9, the PR template,
   `docs/review-guide.md` §5). "The first fix of this PR" is not an answer.

Not chosen:

- A check in CI for copies of a default. It is a pattern rule on free text, and no two places
  disagree today.
- A "proof kind" column in the PR template. A label does not show that a check covers its claim.
- A script that reads PR text for "no" and "all".
- The reviewer accepts the claims before the builder starts (one consultant). It costs the owner
  one more handoff for each PR. It is the next step if the measure fails.

**Limit.** The first claim that is too big can still occur. It then costs one finding and no
second round.

**Measure.** For the next three PRs:

- no review after the first one reports this cause;
- the builder asks the owner no question about it in the middle of a PR;
- each claim with "all" or "none" names a check that covers it, or has a `Not claimed` line.

**Reusable principles.** [Fix the root cause](../../.agents/skills/principle-fix-root-cause/SKILL.md), [Review with evidence](../../.agents/skills/principle-review-with-evidence/SKILL.md).

**Project guidance.** `AGENTS.md` §9, [review guide](../review-guide.md) §3 and §5, [PR template](../workflows/pull-request.md), [delivery quality](../delivery-quality.md) (the prevention action) and its [archive](../delivery-quality-archive.md) (DQ-203, DQ-204).
