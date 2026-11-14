# Write a PR description

Use this template when you prepare an authorized draft PR. Before a protected action, check [AGENTS.md §7](../../AGENTS.md#7-what-needs-the-humans-approval-stop-and-ask-or-flag-it-clearly-in-the-pr).

```markdown
## What
One paragraph.

## Why
Link to the brief and decisions.

## Acceptance criteria
| AC | Evidence |
| --- | --- |
| UI-2.4 | `e2e/header-drag.spec.ts` "drop adds bot": expects the bot chip in the header after the drop; + screenshot |
| conversation-rules §1 table | `decide-runs.rules.test.ts` "human message: …" rows: one row per table line |
| Each default has one home (a claim with no test) | The search script in this description and its output on `abc1234`; the 21 places that it printed now point to the home. **Not claimed:** that no copy stays |

## Edge cases (one table for each changed screen, `testing.md` §3)
| Case | Test, or why the row does not apply |
| --- | --- |
| The same action twice | `bots.spec` "a second Clone …" |
| Keyboard only | Does not apply: this PR adds no control |

## Needs human review
- Migration `0003_skill_versions` (new tables, no data change)
- (or "none")

## Docs updated
- docs/domain-model.md §3 (added changelog column)

## Folder indexes
- README.md tables updated for every added, removed, renamed or repurposed file, and the
  descriptions still match what the files do (or "no file changes")

## Review fixes (when a review found something)
| Finding | Cause (the rule broken) | Same cause checked in | Same cause as an earlier fix? | Fix | Test |
| --- | --- | --- | --- | --- | --- |
| A late Profile answer brings back an old pin | An answer writes fields it does not own | Save answers, pin answers, dialog answers | No | Answers write an allowlist | `bot-edit-form.test` "takes from a save answer only …" |
| A late dialog answer brings back an old pin | An answer writes fields it does not own | Every answer that writes the form | Yes, the row above. Owner's decision: redesign, with one owner for the form state | The form state has one owner | `bot-edit-form.test` "takes from a dialog answer only …" |

## Follow-ups (not done here)
- ...
```

## A claim fits its proof

A claim with "all", "each", "every", "no" or "none" needs a check that covers each item. A test,
a lint rule or a script over a closed list is such a check. A search or a reading shows what it
found; it does not show that nothing else is there. With such a proof, say what you did and what
the proof shows, and add `Not claimed: …` (owner, 2026-11-11;
[lesson](../lessons-learned/claim-bigger-than-its-proof.md)). The reviewer tests these claims
first ([review guide §3](../review-guide.md#3-verify-what-the-evidence-proves)).

In the `Review fixes` table, "Same cause as an earlier fix?" covers earlier PRs too. Name the
search of the prevention actions ([delivery quality §7](../delivery-quality.md#7-update-and-assess))
and of the [lessons](../lessons-learned/README.md) in the answer.

## One home for each fact

Each fact has one home, and other records link to it (decided by the builder at the owner's request, 2026-11-09, DQ-152). The PR body
states no state, count or result that a file or a tool owns:

- The state of an issue or a prevention action lives only in its row of
  `docs/delivery-quality.md`. The PR body names the id.
- The results of a script live in its output. The PR body pastes the output unchanged, with the
  commit that it names. It does not retype numbers from it. `pnpm check:breaks --report <file>`
  writes such a report.
- What a test does lives in the test. The PR body names the test or the break id.

A new ledger row is short: one sentence for the finding and its cause, and a fix of a commit
plus a test or a break id. The whole row has 600 bytes or less (step 7 of the check below; owner, 2026-11-11).
The detail of a finding lives in the PR description, the test or the review record.

## Before each push: check the records

The records are the PR description and the rows that the PR adds or changes in
`docs/delivery-quality.md`, `docs/status.md` and other docs. Before each push, also after a
review fix, check them against the commit that you push (owner, 2026-11-08, DQ-125):

1. Read each claim in the records, and compare it with that commit. Each claim has its
   evidence, as [testing.md §5](../testing.md#5-evidence-in-prs) says: a run with its command
   and commit, `file:line` for a claim from the code, or "not run".
2. If a claim says that X fixes a failure, run it again without X. Write down that the run fails.
3. If a claim says that X causes a failure, run it again without X. Write down that the failure
   stops.
4. If you cannot show step 2 or 3, write that, and do not call X the fix or the cause.
5. If you correct a claim, search for its old text in all the records, and correct each copy.
6. Run `gh pr list --state all`. Correct the state of each PR that `docs/status.md` or the active
   audit file names. A PR cannot record its own merge, so the next push does it (owner, 2026-11-10).
   For a PR that is ready and has no record turn, the record of a later review goes into the next
   PR.
7. Measure each ledger row with an id above DQ-202. This command must print nothing:
   `LC_ALL=C awk -F'|' '/^\| DQ-/ { id = substr($2, 5) + 0; if (id > 202 && length($0) > 600) print "DQ-" id, length($0) }' docs/delivery-quality.md`.
   `LC_ALL=C` makes it count bytes, so each machine gives the same result. Make each row that it
   prints shorter, also when the PR only adds a fix to the row. A row up to DQ-202 can stay as it
   is (owner, 2026-11-10).
8. Run `wc -c < docs/delivery-quality.md`. If the result is larger than the limit in
   [§7 step 6 of the ledger](../delivery-quality.md#7-update-and-assess), write under Follow-ups
   of the PR description that a move of the closed rows is due. The move is a PR of its own. The
   one exception is the move of the P3 PRs in
   [§7 step 6 of the ledger](../delivery-quality.md#7-update-and-assess).

Before you say that a PR is ready: the description has no state line that is older than the head,
and `docs/status.md` names the PR.
