# Merge bar

Builders and reviewers use this bar. Read it when you give a finding a severity, decide what a
finding blocks, write a state table or order test, set the limits of a pattern rule, or decide
when the review of a P3 PR ends.

Only P1 and P2 findings block a merge (owner, 2026-11-04). Fix each of them at once, in the PR that has it.
A P3 finding does not block a merge. Fix it at the end of the milestone, before the next milestone starts (owner, 2026-11-10).
This bar applies the [when review ends principle](../../.agents/skills/principle-when-review-ends/SKILL.md).

## Severity

Read the table from the top, and use the first row that fits.

| Severity | Meaning | Action |
| --- | --- | --- |
| P1 | Data loss, a security failure, or a normal action that cannot complete | Blocks the merge |
| P2 | A broken required acceptance criterion or its missing proof, or a wrong result in the scope below with harm that is not small and recoverable | Blocks the merge |
| P3 | A small, recoverable wrong result, a case outside the scope below, or a code quality point | Record it in one place: its row in the ledger of `docs/delivery-quality.md`, or, for an item with no DQ id, the follow-up list in `docs/status.md` |

Harm is small and recoverable when all of these are true:

- Saved data stays correct.
- The owner's unsaved text stays.
- The owner can see if an action failed.
- The app's own refresh or the owner's next action shows the truth.

At each milestone close, before the next milestone starts, each open P3 (ledger rows and follow-ups) is fixed, or the owner drops it (owner, 2026-11-10).

If the builder and the reviewer disagree about a severity, ask the owner.
This bar does not change `AGENTS.md` §7, §8 or §9, but step 5 of the section below has an owner's exception with limits for §9 in round 2 (owner, 2026-11-12).

## When the review of a P3 PR ends

A P3 PR is one of the P3 PRs before M3 ([status](../status.md#next), item 2).
This section is the owner's rule for these PRs (2026-11-12). For them it takes the place of the
two sentences about a P3 finding at the top of this file, and of "a complete review of the final
head" in [review guide §6](../review-guide.md#6-apply-the-merge-bar): round 1 is the complete
review, and round 2 and the check of step 4 read what changed after it.

The reason: each review round of #105 found new P3 points, and some came from the fixes of the
round before it ([round log](../delivery-quality.md#6-review-round-log)).

A round is a review round as the [ledger](../delivery-quality.md#1-counting-rules) counts it, by
an independent reviewer.

After round 1, a PR takes only these changes:

- A fix of a finding of round 1.
- The records that the definition of done (`AGENTS.md` §9) and the records check
  ([pull-request.md, "Before each push"](pull-request.md#before-each-push-check-the-records)) ask
  for: the rows of this PR in the ledger and in `docs/status.md`, and the state of other PRs
  ([step 6](pull-request.md#before-each-push-check-the-records)).
- A merge of `main`, with its conflicts solved and no other change.

Limits: a merge record has only the state, the date and the link of the PR. The record of an
owner answer is new work and goes into the next PR.

1. Round 1 is a full review. The builder fixes its findings in the PR.
2. No new work enters the PR after round 1. The record of an owner's answer that comes during a
   review goes into the next PR. Exception: a redesign that the owner approves under `AGENTS.md`
   §9. Its commits get their own round 1 and round 2.
3. Round 2 reads the fix commits of round 1. Its brief is narrow: is each fix of round 1 correct,
   and does a fix make a P1 or a P2? The reviewer does not search for new points in the wording.
4. After round 2, the builder fixes only a P1 or a P2. Such a fix gets one check of that commit
   only, by an independent reviewer, with a row in the round log.
5. A P3 that round 2 or a later check finds gets a row in the ledger of
   `docs/delivery-quality.md`. Before the merge, the PR fixes its own open rows (owner,
   2026-11-13).
   - First, one table gives each open row its end. Fix it here. Or it stays open by an owner
     decision: name the decision. Or it is part of a redesign that the owner approved. Or the
     owner drops it.
   - Make the fixes in one fix commit. An independent reviewer checks only that commit. The
     check gets a row in the round log.
   - If that check finds a problem in the fix, fix it. One more check is the limit.
   - Never leave a P1 or a P2 open.
   - The owner decides each P3 that is still left: fix it in the same PR, or merge with it
     recorded. Each open row has a named home. No finding opens a new PR.

   Exception (owner, 2026-11-12 and 2026-11-13): a P3 of round 2 or of a later review that is a
   claim bigger than its proof gets the answer of `AGENTS.md` §9, inside these limits:

   - The builder changes only the places that round 2 found. A wider search is not part of the
     correction.
   - The builder only removes or narrows words, and adds the `Not claimed` line under "Needs
     human review". No new fact, no new rule, and no change of code or tests.
   - If the correction needs more, the finding gets a ledger row, as each other P3 of round 2.

   Steps 2 and 4 do not stop such a correction.

   Each round 2 correction gets its own issue row with the state `fixed`. The cell "Fix and
   verification" starts with the fixed words "Round 2 correction:".

   Measure: the check of step 5 reads each row of the PR that starts with "Round 2 correction:". It
   gives one result for each id: correct or wrong.

   - The brief of round 1 of the cleanup PR lists each row that starts with "Round 2
     correction:". The report gives one result for each id: correct or wrong.
   - For each correction the reviewer asks one question: does the proof in the row cover the
     words of the sentence now? No search for other points in that text.
   - A later finding about a wrong correction writes "fix-induced: yes (the round 2 correction
     DQ-x)" in its last cell. The measure counts these rows.

   If the count is one or more, tell the owner. The owner decides if the exception stays.
6. Sometimes a review finds an issue in a PR after its merge. The issue goes into the next open
   PR that changes the same file. If no open PR changes that file, the issue goes to the audit
   that "Next" of `docs/status.md` names.

## Pattern rules

A pattern rule guesses from the shape of text, so it cannot be right for all text. Before the build, the plan names:

- the examples that must keep their answer;
- real text with no secret, and a limit for how much of it the rule can refuse;
- where possible, seeded test values, and a limit for how many the rule can miss.

A finding on a pattern rule blocks the merge only if a named example gets the opposite answer, or a limit fails. Any other text is P3 (owner, 2026-11-06).

The examples, limits and owner rules of the sensitive data guard are in [security.md §2.13](../security.md#213-sensitive-data-guard-d39).

## Failure scope

The scope is one human on `127.0.0.1`, until the VPS phase (M9).

- **In scope:** actions while a request waits, a second tab, a move to another page, failed requests and refreshes, and live events.
- **Out of scope:** several humans, and an answer lost on the network, except the case that Q4 decided (`docs/design/components/bot-page.md` §4.2).

An owner decision about a named case stays in force, even when the scope leaves out similar cases.

Check the bar and the scope again before the VPS phase.
