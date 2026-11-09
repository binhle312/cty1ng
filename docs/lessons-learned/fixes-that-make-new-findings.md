# Review fixes that made the next findings

Date: 2026-11-09 · Source: review rounds of PR #84 and PR #86 · Status: open (the response waits for the owner)

**Observed.** The ledger rows DQ-117 to DQ-153 come from the reviews of two PRs: #84 (six
independent reviews and one owner review) and #86 (two reviews so far). They hold 37 issues.
None reached `main`. 19 of them came from an earlier fix in the same PR (the "fix-induced" note
on the row).

The first review of each PR found few fix-induced issues. The later reviews found almost only
fix-induced issues:

| Review | Issues | From a fix | Issues from a fix |
| --- | --- | --- | --- |
| #84 `35ea872` (first) | 6 | 1 | DQ-118 |
| #84 builder's e2e run | 1 | 1 | DQ-123 |
| #84 `d5f5d6e` | 3 | 1 | DQ-125 |
| #84 `78d01fb` | 2 | 1 | DQ-127 |
| #84 `0dc734c` | 3 | 3 | DQ-129, DQ-130, DQ-131 |
| #84 `25cb287` (reviewer and owner) | 3 | 2 | DQ-132, DQ-133 |
| #84 `d6265ae` | 4 | 4 | DQ-135 to DQ-138 |
| #86 `41df63a` (first) | 8 | 0 | none |
| #86 `1965703` | 7 | 6 | DQ-147 to DQ-153, except DQ-148 |

**Three repeats, and why the earlier response did not stop them.**

| Repeat | Issues | Earlier response | Why it did not stop the repeat |
| --- | --- | --- | --- |
| A claim is bigger than its proof | DQ-117, DQ-124, DQ-139 to DQ-142, DQ-144, DQ-148, DQ-150, DQ-153; also [M1b](prove-the-test-fails-first.md) | Rules in text: a test is seen to fail (M1b); each step fails alone (DQ-117). Then lint (DQ-124), then the break runner (#86) | The text rules let the builder choose which claims to break. The builder breaks the claims that it already believes, so the gaps stay where it did not look. Lint took the choice away for its class, and that class did not come back after DQ-128 |
| Records that disagree | DQ-119 to DQ-121, DQ-125, DQ-129, DQ-132, DQ-133, DQ-135 to DQ-138, DQ-145, DQ-146, DQ-151, DQ-152 | A check by hand before each push (DQ-125) | Each fact had copies: the PR body, the ledger, `docs/status.md`, code comments and test names. The check compares the copies by hand, and each fix added more copies. The reviews of the three pushes after it started found records that disagreed again (DQ-135 to DQ-138, DQ-145, DQ-152) |
| A new mechanism has new defects | DQ-118, DQ-127, DQ-130, DQ-131, DQ-147, DQ-149, DQ-150, DQ-153 | None | Each redesign that an `AGENTS.md` §9 stop chose was built in the same PR, in the same round as the fix. The next review then found defects in code that no plan or test strategy had checked |

**Cause.** The first wrong decision: the builder let a review fix add new surface, such as a new
tool, a new rule or a new kind of record, to the PR under review. A review can end only when a
revision has no new defect. Each fix that adds surface gives the next review new things to find.
Two things make the loop longer:

- The merge bar blocks on each P3 issue (owner, 2026-11-08). So each small new defect starts one
  more round.
- The §9 stop chooses a redesign, and the builder built it in the same PR. So the stop, a
  correct rule, fed the loop.

The second cause is for the first reviews: the builder chose what to prove. The responses that
worked removed that choice. Lint replaced the list of pages (DQ-124). The coverage check of the
break runner refuses a list that misses a test that the PR adds (DQ-148).

The [M2c lesson](fix-the-cause-not-the-finding.md) found the same shape in code: a list of
fields grew by one at each review. Here the list of rules and records grew at each review.

**Response.** Done in #86: one home for each fact (`docs/workflows/pull-request.md`), the
comment rule (`docs/frontend-conventions.md` §1), and the break runner with its coverage check
(`docs/testing.md` §5). Proposed, for the owner's decision:

1. A review fix only corrects or narrows. It adds no tool, check, rule or new kind of record. If
   a finding needs one, the PR narrows its claim, or it marks the criterion "not met", and the
   new mechanism gets its own PR with its own plan and test strategy.
2. A §9 stop decides the redesign, and the redesign gets its own PR. The PR that found the
   repeat waits for it, or narrows its claim.

**Measure.** For the next three PRs, count the issues of each review and how many came from a
fix. The goal: no issue from a new mechanism after the first review, at most one issue from a
fix in each review, and at most three reviews for each PR. The baseline is the first table.

**Reusable principles.** [Fix the root cause](../../.agents/skills/principle-fix-root-cause/SKILL.md), [Split changes](../../.agents/skills/principle-split-changes/SKILL.md) (step 6), [Decide when review ends](../../.agents/skills/principle-when-review-ends/SKILL.md).

**Project guidance.** [delivery quality](../delivery-quality.md), [PR template](../workflows/pull-request.md), `AGENTS.md` §6 and §9.
