# Merge bar

Builders and reviewers use this bar. Read it when you decide who may merge a PR, give a finding a severity, decide what a
finding blocks, write a state table or order test, set the limits of a pattern rule, or decide
when the review of a P3 PR ends.

Only P1 and P2 findings block a merge (owner, 2026-11-04). Fix each of them at once, in the PR that has it.
A P3 finding does not block a merge. Fix it at the end of the milestone, before the next milestone starts (owner, 2026-11-10).
This bar applies the [when review ends principle](../../.agents/skills/principle-when-review-ends/SKILL.md).

## Who may merge

The owner merges a PR or asks the chief to merge that PR. The chief may also merge a PR under a standing permission in the local `.chief/` repository (`AGENTS.md` §7). Before each standing merge, run `pnpm exec tsx .chief/scripts/merge-check.ts <PR>` from the main checkout, clean at `origin/main`. An owner instruction to wait or stop takes priority.

The local checker reads the clean inner Git head. The import gives no grant authority. Standing grants live only in `.chief/memories/long-term/grants/`. Each first-parent commit after import that changes this folder must be a reviewed loop commit. It must add a new regular proposal file and review file and have both memory trailers. The hashes must match. The review must approve the change, and replay from the first parent must reproduce the whole committed grant file.

Change or end a grant with a reviewed edit of its own file. Keep ended files in place. Use a new grant ID for a later grant. No rule may name a grant in `amends` or `supersedes`. An invalid grant-folder change or a reference to a grant stops all standing merges with exit 2. A later clean commit alone does not clear that error.

A grant names this repository, the merge operation, and one PR number or a list of exact files and folder prefixes. A prefix ends in `/` and has at least two folder names. Every changed path must be covered by the grant and pass the checker's file-kind rule. This includes both sides of a rename.

The allowed roots are `backend/src/`, `frontend/src/`, `shared/src/`, `docs/`, `seed/skills/`, `backend/test/` and `frontend/test/`. The file extension must be `.ts`, `.tsx`, `.css` or `.md`. A file name that starts with `.` or matches `*.config.*` or `*.workspace.*` fails at any depth.

Write `ends` as an ISO time with an offset and up to three fractional digits, or as `never`. A grant ends at the stated instant. The checker rejects a bare date. The protections in `AGENTS.md` §7 take priority over every grant. The checker rejects the paths on its protection list. Read the full diff for protections that need a content check. Stop if a protection applies or the result is uncertain.

For a public PR, the checker confirms the origin and full Git history. It reads two GitHub snapshots and stops if their head, base, state or checks differ. It reads the full diff at those commit IDs. CI must be green for the exact head, from the expected GitHub Actions app and workflow. During cutover, it selects the old or new CI profile from the workflow at the verified base tip. Each change to `ci.yml` needs a new profile pin in `.chief/`. The checker exits 2 until the new pin is in place. The checker also preserves path, mode, changed-base-path, dependency-field and public policy checks. A standing grant must cover every changed file.

If the command asks for a diff review, read the diff it names. Check for an owner hold and run the command again with the printed `--reviewed-diff` value only when both checks pass.

Exit 0 prints one `gh pr merge … --merge --match-head-commit <head>` line. The chief marks the PR Ready at the last step and uses that line only while the approval and checked facts still hold. Exit 1 denies a standing merge. Exit 2 means the checker cannot decide. Both stop the standing route. On a direct request, two consultants check the exact head. If the owner's request includes Ready, the chief marks the PR Ready at the last step. Otherwise the owner marks it Ready. Use `gh pr merge <PR-URL> --merge --match-head-commit <reviewed-head>` and verify the merge.

The light gate trusts this laptop (orders 131 and 203). Any process with write access to `.chief/` can create a grant or change the local checker and its path checks. The chief stops if there is a conflict, a stale grant or an owner hold. If the checker reports bad grant history, keep the evidence and ask the owner to order a repair. A direct owner request can still authorize a merge.

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
This bar does not change `AGENTS.md` §7, §8 or §9, but step 5 of the section below has an owner's exception with limits for §9 in round 2 and in a later review (owner, 2026-11-12 and 2026-11-13).

## When the review of a P3 PR ends

A P3 PR is one of the P3 PRs before M3 ([status](../status.md#next), item 2).
This section is the owner's rule for these PRs (2026-11-12). For them it takes the place of the
two sentences about a P3 finding at the top of this file, and of "a complete review of the final
head" in [review guide §6](../review-guide.md#6-apply-the-merge-bar): round 1 is the complete
review, and round 2 and the check of step 4 read what changed after it.
For them it also takes the place of step 10 of the
[when review ends principle](../../.agents/skills/principle-when-review-ends/SKILL.md).

The reason: each review round of #105 found new P3 points, and some came from the fixes of the
round before it ([round log](../delivery-quality.md#6-review-round-log)).

A round is a review round as the [ledger](../delivery-quality.md#1-counting-rules) counts it, by
an independent reviewer.

After round 1, a PR takes only these changes, and the changes that steps 2, 4 and 5 name:

- A fix of a finding of round 1.
- The records that the definition of done (`AGENTS.md` §9) and the records check
  ([pull-request.md, "Before each push"](pull-request.md#before-each-push-check-the-records)) ask
  for: the rows of this PR in the ledger and in `docs/status.md`, and the state of other PRs
  ([step 6](pull-request.md#before-each-push-check-the-records)).
- A merge of `main`, or of the base branch of a stacked PR, with its conflicts solved and no
  other change.

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

   - The builder changes only the places that the review found. A wider search is not part of
     the correction.
   - The builder only removes or narrows words, and adds the `Not claimed` line under "Needs
     human review". No new fact, no new rule, and no change of code or tests.
   - If the correction needs more, the finding gets a ledger row, as each other P3 of that review.

   Steps 2 and 4 do not stop such a correction.

   Each round 2 correction gets its own issue row with the state `fixed`. The cell "Fix and
   verification" starts with the fixed words "Round 2 correction:".

   Measure: the check of step 5 reads each row of the PR that starts with "Round 2 correction:". It
   gives one result for each id: correct or wrong.

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
