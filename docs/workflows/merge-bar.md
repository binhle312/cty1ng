# Merge bar

Builders and reviewers use this bar. Read it when you decide who may merge a PR, give a finding a severity, decide what a
finding blocks, write a state table or order test, set the limits of a pattern rule, or decide
when the review of a P3 PR ends.

Only P1 and P2 findings block a merge (owner, 2026-11-04). Fix each of them at once, in the PR that has it.
A P3 finding does not block a merge. Fix it at the end of the milestone, before the next milestone starts (owner, 2026-11-10).
This bar applies the [when review ends principle](../../.agents/skills/principle-when-review-ends/SKILL.md).

## Who may merge

The owner merges a PR, or asks for its merge. The chief may also merge a PR that a standing
permission of the owner covers, and each memory PR that `pnpm merge:check` passes (`AGENTS.md` §7;
owner, 2026-11-19, order 108). Before each chief merge, the chief runs `pnpm merge:check <PR>`
from a clean checkout of `origin/main`. A memory PR and a PR under a standing permission merge
only with the merge line that it prints. The script first checks the clone: the origin has one URL,
which is this repository on github.com, the clone has its full history, and no git setting can
change the diff. Then it reads one GitHub snapshot of the PR, compares its own code with the base
tip of that snapshot, and judges the git diff at the commit ids of that snapshot: first from the
paths, statuses, modes and CI checks alone, and only then from the texts that it still needs. It
reads those texts before it reads the snapshot again, and a change in between stops it (owner,
2026-11-20, orders 128, 130, 133, 147 and 152). Exit 1 means no chief merge under a
permission. The script stops at the first rule that fails, in this order:

1. Each PR: it comes from a fork, has another author or is for another base; a path is not
   printable ASCII ("the chief stops"); main changed a touched path after the branch split (merge
   main first); the PR mixes `.agents/chief/memories/` with other files.
2. A memory PR: a `short-term/` file other than its README is tracked (it must leave the PR);
   `restore.md` or `audit.md` changes, or a change is other than an added or changed `.md` file of
   the `long-term/` path grammar, such as a printable path outside the grammar ("the owner merges
   it"); a CI check is pending, red or missing; a memory text has a form that the script does not
   support ("the chief stops"); a file has `permission-rule` (the owner merges each one, order
   130); a text holds a private word; a quote of a rule is not in the owner record.
3. A code PR: a path that no permission covers (a listed path, or an added, deleted or retyped
   `package.json`); a CI check is pending, red or missing; a dependency field of a changed
   `package.json` changes.

Exit 2 means that the script cannot check: no chief merge. A PR that is not open, a failed check
of the clone, a text that git cannot read, a PR that changed during the check, and a memory PR with
no owner record or no private word list give exit 2. The record is checked once the PR reaches the
memory gate, after the checks of each PR. Exit 2 says "Do not merge it" when the owner record or
the private word list cannot be read (for each PR), and for a memory PR once the script has read
the diff. Before it has read the diff, the script does not know the kind of PR, and exit 2 says
"Treat it as listed: the owner merges it". When the owner's own message asks for a PR, a listed
path does not stop the merge (R-002 path 1): the chief merges with
`gh pr merge https://github.com/<owner>/<repo>/pull/<PR> --merge --match-head-commit <head>`, but
never a mixed PR.

Not claimed: the gate assumes a trusted machine and trusted tools (owner, 2026-11-20, order 131).
The start check finds a local setting that changed by mistake. Anyone who controls the machine can
merge with the owner's login.

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
