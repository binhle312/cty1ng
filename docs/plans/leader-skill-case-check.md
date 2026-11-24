# The case check of the rule edits of #150

Brief: no brief file. The plan of the slice is [leader-skill.md](leader-skill.md); the first
redesign is [leader-skill-redesign.md](leader-skill-redesign.md). This file is the redesign that
`AGENTS.md` §9 asks for after review round 1 of that redesign.
Checkpoint: plan. The owner approves a redesign under `AGENTS.md` §9.
Approval: waiting for the owner. The owner chose the option on 2026-11-24 (decision page of the
redesign's round 1, Q1: "B Try the case check in #150").

## Why

When I removed role names for the Roles table (owner, "One home: the Roles table"), my new words
also changed what some rules ask. Review round 1 of the redesign found one change (D1-3, the risk
probe). A compare of all 47 changed sentence pairs found 6 more: 2 rules got wider, 1 record lost
a fact, 3 are unsure. The same fault came earlier in PR #118 (DQ-420) and in this PR (R2-8). The
Roles decision changed who does each job; it did not approve a change to what a rule asks.

## Design

A **case** is one situation that the old words of a rule cover. A **rule edit** is a changed
sentence that says what an agent or the owner must do, or that records who did what.

1. **Restore.** For each of the 7 changes, the new words keep the role-free form and get back the
   old case:

   | # | File (at `b1bd93a`) | The old case that comes back |
   | --- | --- | --- |
   | 1 | `docs/workflows/planning.md`, "Risk probes first" | A probe for each part that the planning agent has not used in this repository, also when the project used it |
   | 2 | `docs/workflows/coordination.md`, Roles, reviewer row | The forced-order review only for a changed screen with locks, live events or late answers, as `implementation.md` says |
   | 3 | `docs/workflows/merge-bar.md` and `coordination.md` | Ask the owner when the builder and the reviewer disagree about a severity |
   | 4 | `docs/workflows/pull-request.md` | The record keeps who made the DQ-152 decision (the builder agent, at the owner's request) |
   | 5 | `docs/review-guide.md` | A local review with a gate run at the reviewed commit, with no PR |
   | 6 | `docs/workflows/planning.md`, design skills | The builder may also use the `impeccable` skill |
   | 7 | `docs/status.md`, "Who updates it" | The same-PR timing applies to the records of the lead agent, not to the owner's later reviews |

   For changes 5 to 7 the compare was not sure. Step 3 decides each one: if the old case is real,
   it comes back; if not, the PR says why not.

2. **The case list.** For each rule edit of #150 (`main` to the final head), the PR description
   has one table row: the file and line, the old words, the new words, each case of the old words,
   and where the new words cover each case.

3. **The independent compare.** A second agent (read-only, GPT-6.2 Astra at `high`) gets only the
   old and the new sentences (`git diff main..<head> -- docs`). It lists the cases of each old
   sentence on its own, then checks each case in the new words and in my case list. Each case that
   the new words drop, and each difference from my list, is a finding. I fix it or answer it.

4. **The trial record.** The PR description and the prevention row of `docs/delivery-quality.md`
   get the counts: rule edits, cases, findings, the input tokens of the compare. The owner decides
   later whether this becomes a rule for later PRs.

The case check is for #150 only. It changes no skill and no workflow document.

## Test strategy

| # | Test | Pass when |
| --- | --- | --- |
| 1 | The compare finds a known miss: run step 3 on `main..b1bd93a` (before the restore), with no hint of the known changes | It reports change 1 (risk probe) and change 2 (screen review) without help |
| 2 | Each restore is in place | For each of changes 1 to 4, a `grep` of the restored case in the final head finds it; changes 5 to 7 are restored or have a written reason |
| 3 | The compare on the final head | No dropped case is left: each finding is fixed or answered in the PR |
| 4 | My list against the compare | The PR gives the count of cases that my list missed and that the compare missed |
| 5 | The checks | `pnpm lint`, `pnpm check:index`, `pnpm check:status` and `pnpm records:counts` pass on each commit; the full set of `AGENTS.md` §4 passes on the final head |

Then the commits of this redesign get their own review rounds 1 and 2
(`docs/workflows/merge-bar.md`, step 2).

## Open questions

None.
