# One home: a check for typed measures in docs/status.md

Brief: the owner's answers of 2026-11-24 on the page "One home for facts": "Q1: A In #151, as §9
says" and "Q3: A One line in AGENTS.md §10". The cause is finding F4 of review round 1 of #151. A
byte count that I typed into `docs/status.md` went stale one commit later. Its answer was "Same
cause: yes" (DQ-570, and the prevention action "One fact had hand copies…"). So `AGENTS.md` §9
asks for a redesign in #151. "Q2: A Own script, after #151" (a copy check for docs and code) is
not in this plan. It gets its own plan and PR after #151.
Checkpoint: plan (an `AGENTS.md` §9 redesign, and a change of `AGENTS.md`: §7)
Approval: owner, 2026-11-24, revision 1 (`aea29a1`): "Approve both the plan and the split plan". The
owner's decisions in it: Q1 A, Q3 A and the words of design step 4.
Revision 2, owner, 2026-11-24, answer "A" to R1-F4 of the review of the build (a scratch break of the
singular `token` passed all tests; same cause in kind as DQ-856): the break list proves each part of
the pattern with a break, in place of the exemptions.

## Goal

`pnpm check:status` fails when `docs/status.md` has a typed measure in the form of design step 1,
such as `89,987 bytes` (F4). The value stays in the tool output or in the record that owns it. The
status line links to it.

Every agent reads the general rule "one home" in `AGENTS.md` before its first change. The review
prompt asks for a second home in other words, because no script finds those.

Not claimed: the check does not find a measure in another form, such as `bytes: 89,987`, `90 MB`
or `12 lines`. It does not find a count with another unit, such as `55 issues`. It does not find a
copy in another file. The review item and the later copy check (Q2 A) cover parts of that.

## The failure, measured

- F4: `git grep -n '89,987' fa19669 -- docs` prints one line, in `docs/status.md`. The number came
  from `wc -c` output, not from another file. So a check for copied text cannot find it.
- The rule exists, and it did not stop F4. It is in `docs/workflows/pull-request.md`, "One home
  for each fact": "A `docs/status.md` line of a PR has its state, its date and its link. It has no
  list of files, no count and no claim that a test or a row owns." No check enforces it.

## Design

1. **The check.** `scripts/lib/check-status.ts` gets a pure function. It returns one problem for
   each typed measure in `docs/status.md`.
   - A typed measure is a number, then a space or a hyphen, then a unit.
   - The units are `byte`, `bytes`, `KB`, `row`, `rows`, `token` and `tokens`, in any case.
   - Numbers with commas and decimals count: `89,987 bytes`, `80,000-byte`, `1.5 tokens`.
   - `checkStatus` adds these problems, so `pnpm check:status` fails in CI.
   - The message gives the line number, the matched text and the fix: "link to the record or the
     rule that owns the value (One home for each fact, `docs/workflows/pull-request.md`)".
2. **Why these units.** Agents copy these measures from tool output into records: `wc -c`, sizes,
   row counts and token counts.
   - A probe with more units (`MB`, `lines`, `words`, `characters`) found 6 hits in
     `docs/status.md` at `f7f54a7`. 4 of them are not copies.
   - Two are test names: "the 1 MB guard test" and "the 48-line guard test".
   - One is the rule of the Done table in its home: "15 words or less".
   - One is a Follow-ups row that describes a limit in code.
   - The units of step 1 find only one row on this branch: the Follow-ups row "Move §2 to §4 …".
     It is my own copy of the limit of `docs/delivery-quality.md` §7 step 6, with two hits.
   - They find no hit in `docs/status.md` of `origin/main`. They also find none on the open
     branches `fix-break-runner` (#107), `codex-workers` (#149) and `leader-skill` (#150). So the
     check does not make their CI fail after this merge.
3. **The row "Move §2 to §4 …".** Both hits change, and the value stays only in the ledger.
   - The item says "keep the size limit of §7 step 6", with a link to that step.
   - "Found in" says "the ledger is still above that limit after the move".
4. **`AGENTS.md` §10.** One new item comes after "No hardcoded values". It has the words that the
   owner approved on the page: "**One home** (owner, 2026-11-24): a fact, rule, value or code block
   lives in one place. Other places link to it. For PR records, see
   [One home for each fact](docs/workflows/pull-request.md#one-home-for-each-fact)."
5. **`docs/workflows/review.md`.** The review prompt gets one item: "One home: a fact, rule, value
   or code block that has a second home, also in other words."
   - The copies of today (5 in docs, 6 in code, measured on 2026-11-24) belong to the Q2
     follow-up.
   - So a reviewer names a new copy, not one of those.
6. **Texts that describe `check:status`.** Each gets one short change, and none repeats the unit
   list.
   - `docs/testing.md`: its list of checks.
   - `scripts/README.md`: the row of `check-status.ts`.
   - The top comments of `scripts/check-status.ts` and `scripts/lib/check-status.ts`.
   - `docs/workflows/pull-request.md`, "One home for each fact": "`pnpm check:status` fails on a
     typed measure; its units are in `scripts/lib/check-status.ts`".
   - Only the code, its tests and this plan name the units.
7. **The prevention action.** The prevention action "One fact had hand copies…" of
   `docs/delivery-quality.md` gets two additions.
   - Its enforcement cell names the new check.
   - Its evidence names F4 of #151.
   - No moved row changes.

Not a code design checkpoint: the change adds no shared state, no module boundary and no screen
flow. It adds one pure function to an existing check.

## Other options (rejected)

- More units (`MB`, `lines`, `words`). They give 4 false hits today, so the check needs a list of
  exceptions. That list grows into a second home of its own. Rejected.
- A check of every Markdown file. The ledger rows and the PR evidence must hold measures. Rejected.
- A check of the sections "Now" and "Follow-ups" only. F4 was in Follow-ups, but a Done row or a
  Next item can get the same copy. The units of step 1 have no false hit in the whole file.
  Rejected.

## Test strategy (test first)

Each new test runs red on the code before the change, and the PR records the red run.

The break list `scripts/breaks/pr-151.json` has a claim for each new test, with breaks of
`scripts/lib/check-status.ts` (revision 2). `pnpm check:breaks scripts/breaks/pr-151.json` proves
that each break makes its test fail.

- One break for each part of the pattern: each unit in singular and plural (`byte`, `bytes`, `KB`,
  `row`, `rows`, `token`, `tokens`), the hyphen, the comma group, the decimal, the leading decimal,
  and the letter and digit look-arounds (emphasis, `rowspan`, `5 rowers`).
- The test of each part has a case that the break makes fail. If a part has no such case, the
  builder adds the case first (for example `1 token`).

| Behaviour | Test (`scripts/check-status.test.ts`) | Cases beyond the normal path |
|---|---|---|
| A typed byte count fails | "rejects a typed byte count" | `89,987 bytes`; `80,000-byte` (hyphen); `1 byte` (singular); `3 Bytes` (case); `90 KB` |
| A typed row or token count fails | "rejects a typed row or token count" | `78 rows`; `12 row`; `120,000 tokens`; `1.5 tokens` (decimal) |
| The problem names the line and the text | "names the line number and the measure" | Two measures on one line give two problems; a measure on the last line, with no newline |
| Other numbers pass | "permits numbers that are not measures" | `#151`, `2026-11-24`, `DQ-570`, `§7 step 6`, `Q1 A`, `PR 5`, `M2b`, a commit `fa19669`, `15 words`, `1 MB`, `48-line`, `rowspan`, `5 rowers` |
| The real file passes after the fix of the row "Move §2 to §4 …" | `pnpm check:status` in CI and locally | Before that fix, it fails with 2 problems on that row |
| The Done-row checks still work | The existing tests of the file | No change of their fixtures |

The builder also does one break by hand on the final head:

1. Type "12 rows" into a copy of `docs/status.md`.
2. Run the check on the copy. It must fail.
3. Restore the file, and record the result in the PR description.

## Build and review

- Branch `ledger-archive-move`, worktree `/home/binh/projects/personal/cty1ng-ledger-move`, on
  top of this plan's commit.
- Builder: a new Codex session, `gpt-6.2-sol`, effort high, with this plan as its brief.
  - It is not the session that built the move. That session's second turn read about 9.7 million
    input tokens, and it knows the move, not `check-status`.
  - The brief lists the lead agent's commits after `e26cb75`.
- Review: the merge bar ("When the review of a P3 PR ends", step 2) gives a redesign under
  `AGENTS.md` §9 its own round 1 and round 2.
  - Round 1 is a new Codex session (`gpt-6.2-astra`, effort high) with its own worktree.
  - It reads the commits after `fa19669`, the last reviewed head. So it also reads `f7f54a7`, the
    fixes of the first round 1.
  - Round 2 reads the fix commits of that round.
  - The owner can choose another number of rounds.
  - The move commits keep their proof and their review.
- Records: the PR description gets the plan link, the test results and the red runs.
  - No ledger rows: the PR has no milestone.
  - `docs/status.md`: the "Now" line names the check.
  - Guide: not changed. The owner gets no new page, command, action or choice.
- The copy check for docs and code (Q2 A) has a Follow-ups row in `docs/status.md`. Its target is
  "its own plan and PR after #151".
