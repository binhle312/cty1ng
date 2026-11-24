# Split the PR register and the prevention actions out of the ledger

Brief: the owner's answers of 2026-11-24 to the questions of PR #151: "Q1 A" (merge #151 first; the
limit rule change gets its own PR) and "Q2 C" (own files for the register and the prevention
actions; the 80,000-byte limit stays). Follow-ups row in `docs/status.md` (from #151).
Checkpoint: plan (it changes `AGENTS.md` §9 and the PR template: `AGENTS.md` §7)
Approval: owner, 2026-11-24, revision 1: "Approve both the plan and the split plan" (the plan, the two
file names, and the new words of `AGENTS.md` §9 under "Owner questions")
Revision 2, owner, 2026-11-24, after round 3 of the review of #153:
- S3-F1 (a second reader link that the searches missed; same cause as S1-F1): "Inventory by script".
  A script lists each link and section reference into the four delivery-quality files from the
  active docs, with its sentence and the heading it opens; each row is checked by its words.
- S2-F7 (ledger §7 step 2 and `AGENTS.md` §9 disagree on round rows): "No rows, fix §7". A PR with
  no milestone keeps its review rounds in its description; §7 step 2 says so.
- The new words of `AGENTS.md` §9, line 144 (owner, 2026-11-24): "the delivery records are updated
  as `docs/delivery-quality.md` §7 says".
Revision 3, owner, 2026-11-24, after round 4 of the review of #153:
- S4-F1: "Edit the 7 places". The seven places of the live ledger that name a moved part with no
  link name the new file: the open rows DQ-859 (line 133, "the §7 text", now in the prevention
  file) and DQ-862 (line 136, "the §2 sentence", now in the register), and the notes of §5 on the
  snapshots S2, S3 and S7 (lines 57, 58, 146, 147 and 150, now in register §4). Correction
  (lead agent, 2026-11-24): the question named DQ-443, DQ-820 and three notes; those two rows
  name no moved part, and the reviewer's list has these seven.
- S4-F2: "Finish it in #153". Each text about where review rounds go agrees with §7 step 2,
  including the PR template and §6.
- End of review: "Review until clean". A complete review of the final head with no P1 or P2
  (review guide §6).
- S4-F6: "Take them into #153". DQ-854, DQ-855, DQ-856, DQ-863, DQ-868 and DQ-870 are fixed in
  this PR, with the owner's answers of 2026-11-19 (#135 page Q3 A, Q4 A, Q6 A). Their code design
  and test strategy come in a section of this plan, for the owner's approval, before the code.

## Goal

`docs/delivery-quality.md` stays below 80,000 bytes after the next move of closed rows. On `main`
after #151 (`764abde`) it has 90,225 bytes. §2 to §4 (19,409 bytes) and the prevention actions of
§7 (13,661 bytes) never move with closed rows, so moves alone cannot bring it below the limit.
(The plan was approved with the sizes at `fa19669`: 90,097 and 13,533 bytes. #151 changed one
prevention action after that.)

Done means: the ledger has about 57,600 bytes, each moved section is byte for byte the same in its
new file, `pnpm records:counts` gives the same counts, and each reader that the old text sent to
those sections now finds the new file.

## Design

1. **Two new files, with the same section numbers.**
   - `docs/delivery-quality-register.md`: `## 2. Milestone view`, `## 3. PR register` and
     `## 4. Historical evidence snapshots`, moved unchanged.
   - `docs/delivery-quality-prevention.md`: the `### Prevention actions` text and table, moved
     unchanged, under a heading `## Prevention actions`.
   - A short head in each file: what it holds, and that the rules of the ledger apply.
   - Why the same numbers: many records say "delivery-quality.md §3" or "§7 step 6". The numbers of
     the ledger (§1, §5, §6, §7) do not change, and §2 to §4 keep their numbers in the new file.
2. **Stub headings in the ledger.** `## 2.`, `## 3.` and `## 4.` stay as headings with one line
   each that links to the new file. `### Prevention actions` stays with one line that links to
   its file. Old links and old "§3" references in records then still lead to the right text. The
   stubs cost about 400 bytes.
3. **The counts script.** `LEDGER_FILES` in `scripts/records-counts.ts` gets the register file.
   The script already finds the milestone view and the register by their table header in any file
   of that list. Its message "no register row in <path> §3" stays true, because the register file
   keeps §3. If the file is not in the list, the script fails with "No file has the table of the PR
   register" (CI).
4. **Texts that send a reader to a moved section.** Each gets the new file name:
   - `AGENTS.md` §9: "search the prevention actions of `docs/delivery-quality.md` §7" becomes
     "search `docs/delivery-quality-prevention.md`". Needs the owner's approval of the words.
   - `.github/pull_request_template.md`: the same-cause line (prevention actions) and the register
     line.
   - `docs/workflows/pull-request.md`: the "Name the search of the prevention actions" sentence and
     the `grep` command, which gets the new file next to the ledger and the archive.
   - `docs/delivery-quality.md`: the head paragraph ("This file holds the rules, the register…"),
     §7 step 1 (the register), step 5 ("the rows of §2"), step 7 (the prevention action).
   - `docs/workflows/egm.md` (3 links to §3), `docs/testing.md` (`records:counts` and §2),
     `scripts/README.md` and the comment on line 1 of `scripts/records-counts.ts`,
     `docs/README.md` (the map row), `docs/status.md` line 4.
   - Records of history (old plans, archive rows, lessons) do not change. The stubs serve them.
5. **No new size rule.** The limit of §7 step 6 stays for the ledger file only. The new files get
   no limit in this PR (scope: the owner's answer named the ledger limit only).

Not a code design checkpoint: no shared state, no module boundary, no screen flow. One list in a
script gets one more entry.

## Other options (rejected)

- New section numbers in each file (`## 1. PR register`): cleaner files, but each old "§3"
  reference then points to the wrong section. Rejected.
- No stubs: about 400 bytes less, but old links break, and agents that remember "§3 of the ledger"
  find nothing. Rejected.

## Proof (as in #151, rule of §7 step 6, owner 2026-11-24)

A script in the PR description, not in the commits, shows:

1. Each line of base §2 to §4 is in `docs/delivery-quality-register.md`, in order, with no change.
2. Each line of the base prevention actions is in `docs/delivery-quality-prevention.md`, in order,
   with no change.
3. The ledger lost only those lines, and got only the stub lines and the changed sentences of
   design step 4.
4. `pnpm records:counts --write` on the head changes no file (the counts are the same).

## Test strategy

| Behaviour | Test | Cases beyond the normal path |
|---|---|---|
| The script finds the register in a second file of `LEDGER_FILES` and writes its counts there | `scripts/records-counts.test.ts`, a fixture with the register in its own file | The register in two files (the existing "Two tables" test); the register file missing from the list ("No file has the table") |
| The real files give the same counts | `pnpm records:counts` in CI, and step 4 of the proof | A count cell that `--write` would change |
| Every moved line is unchanged | Proof steps 1 to 3 | A one-byte change in a moved row makes the proof fail (one break, run by the builder) |
| No reader text points to the old place | `grep -rn 'delivery-quality.md.*§[234]\|prevention actions of' --include='*.md' --include='*.ts'` outside history records | A link with an anchor `#3-pr-register` |

If the existing tests already prove the first row, the builder names that test and adds none.
A break list for the script change follows `docs/testing.md`.

## Build and review

- Branch `ledger-split` from `main` after #151 merges. Worktree `../cty1ng-ledger-split`.
- Builder: a Codex worker, `gpt-6.2-sol`, effort high (a script line, a proof, many text edits).
- Reviewer: a new Codex session, `gpt-6.2-astra`, effort high, with its own worktree to run the
  proof.
- Records: no milestone, so no register row. Guide: not changed (no new page, command, action or
  choice for the owner).
- After the merge: I update my own notes that name "delivery-quality.md §7" for the same-cause
  search.

## Owner questions

1. Approve this plan, with the two file names `docs/delivery-quality-register.md` and
   `docs/delivery-quality-prevention.md`.
2. Approve the new words of `AGENTS.md` §9: "search `docs/delivery-quality-prevention.md` and the
   lessons" in place of "search the prevention actions of `docs/delivery-quality.md` §7 and the
   lessons".

## Revision 4: the six rows of #135

Approved by the owner on 2026-11-24 ("Approve as written"), with three more answers:

- **The two count cells** ("Allow the 2 cells"): proof step 1 allows exactly the two `Open issues`
  cells below, with the values that `records:counts --write` makes. Every other byte of the
  moved §§2–4 stays the same as the base. This is the one exception to the byte-for-byte
  criterion of "Done means".
- **Rows over 600 bytes** ("May stay over"): a row that is already over 600 bytes may stay over
  when this PR edits it. This PR does not shorten rows by hand (DQ-868).
- **Evidence of the closed rows** (owner, 2026-11-24, "Short pointer, may pass 600"): DQ-854,
  DQ-855 and DQ-856 were under 600 bytes. Each keeps all its old text and adds only "Fixed in
  `d6f2d2a`; tests and proof in the #153 description", and may pass 600 bytes with it. The test
  names are in the PR description.
- **DQ-578** ("Home: Unicode PR"): this PR changes only its home text, to the next PR that changes
  `check:status`: the one for the Unicode misses of the typed-measure check (FR-F5, FR-F6 of
  #151, a row in the Follow-ups of `docs/status.md`). #151 changed `check:status` and did not
  take DQ-578.

- **DQ-854** stops at the first `)` or `;` and checks only the first answer. In
  `scripts/lib/records-counts.ts`, find every `Same cause:` marker outside single backtick spans.
  Parse to the outer `)` with balanced parentheses. Only the outer `; §9: ` starts a step.
  Check every whole DQ id in hits on matching lines other than the source row. Reject missing or
  malformed answers and colon continuations. A yes requires one step. A no takes none.
  Keep the current ID and state scope. Fixed delimiters need less code but can hide citations.
  Update the form in `docs/workflows/pull-request.md`.
- **DQ-855** claims grep and JavaScript always agree. Keep the pattern rule. In the PR workflow,
  describe the actual exclusions. Describe JavaScript matching in the `searchLines` comment.
  Use the parity fixture as evidence.
  Add `Not claimed: grep and the checker agree on all allowed patterns.` under
  `Needs human review`. Refusing four forms would narrow accepted input and leave other gaps.
- **DQ-856** has no test for an unknown §9 step or free text in an owner step. Add only the two
  tests in `scripts/records-counts.test.ts`.
- **DQ-863** accepts impossible dates. In the checker and PR workflow, use
  `owner, YYYY-MM-DD, <page> <question> <answer>` with exact spacing. Check the Gregorian date
  in years 0001–9999. The page is ASCII letters or digits with optional hyphens between groups,
  or `#` plus a positive number. A question is `Q` plus a positive number. Use decimal digits
  without leading zeros for both numbers. An answer is one uppercase ASCII letter.
- **DQ-868** loses facts when an editor shortens a row. Add the read-only command
  `pnpm records:removed-words <base> <head>` in `scripts/records-removed-words.ts`. Read the live
  ledger and archive at both explicit Git commit refs. The pure
  `scripts/lib/records-removed-words.ts` reuses the counts module's parser. Pair rows by ID across
  files. If the line or any trimmed cell shrinks in UTF-8 bytes, compare all cells by heading.
  Print the ID, paths, heading and removed words in old order. Split words at whitespace and
  count repeats. Compare raw lines if legacy cells do not align. Fail on missing input or
  duplicate IDs. Add the command to `package.json`. List each script file in its folder's README,
  including `scripts/README.md`. Add a PR workflow step. Before each push that edits issue rows, the
  builder saves the report from the PR merge base to the proposed head. The reviewer reads it.
  Git word diff needs less code but loses the ID match across files.
- **DQ-870** rejects a self-proposal in its own proposal row. Allow it if the trimmed fix cell
  starts with exact `Proposal:`. Update the checker and PR workflow. In `docs/delivery-quality.md`,
  change only the answers of DQ-866, DQ-868 and DQ-869 to yes with their self-proposal.

**Rows that newly fail.** The scratch check at `b0547a2` finds four colon continuations. Move
DQ-865's note before its answer. Use `it\.each` for DQ-866 (DQ-322, DQ-407), `shortened` for DQ-868
(DQ-623, DQ-874), and `its message names\|does not say that` for DQ-869 (DQ-838, DQ-875).
`q4 Q3 A` and `morning Q4 A` fit. DQ-869 has 562 bytes outside the answer. Approve an exception
to the 600-byte rule to keep the edit answer-only, or approve a shorter row.

**Pattern rules.** Keep the current test results. Accept `a+?`, `a{,3}`, `[a[:digit:]]` and `x[^]`.
Allow zero unexpected refusals on the ledger and archive at `b0547a2` after the four edits.
Reject every seeded bad case in the table. Reviewers judge meaning and decision references.
The word report covers paired IDs with a shorter line or cell.

**Records and commit order.**

1. Record owner approval. Keep the other round 4 fixes in their own commits.
2. Commit the answer checker, workflow, tests, breaks and four compatibility edits together.
3. Commit the word report, workflow step, indexes, tests and breaks together.
4. Mark all six rows `fixed` with fix and test evidence. Commit those edits and the output of
   `pnpm records:counts --write`. Only two register cells change, both `Open issues`.
   Audit 2026-11-05 goes from 61 to 55. #135 goes from 17 to 11.

Approve one exception to proof step 1. Start with the exact moved bytes from `b45ef6f`.
Run the count writer in scratch with only the six states changed from `b0547a2`.
Require exactly the two changes above. Apply only those cell values to the original bytes.
Compare the whole register with head. Extend step 3 with the approved ledger edits.
Keep the step 4 write check on head. Test step 1 with a wrong count and a changed historical byte.

**Test strategy.** Use plain test names. Record each applicable break below as a claim in
`scripts/breaks/pr-153.json`, with a passing run and a failure at the named assertion.
The answer tests use `scripts/records-counts.test.ts`. The word report uses
`scripts/records-removed-words.test.ts`.

| Case                                                                                     | Test name                                                                                      | Break                                                                                           |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| A real hit immediately after `(` in hits and on a matching line                          | `accepts an id in parenthesized hits`                                                          | Reject `(` in hits                                                                              |
| A missing hit after an inner `)`                                                         | `checks hits after a nested close`                                                             | Stop the hits at the first `)`                                                                  |
| A missing hit after a plain semicolon                                                    | `checks hits after a plain semicolon`                                                          | Stop the hits at the first `;`                                                                  |
| Two valid answers                                                                        | `accepts two answers in one cell`                                                              | Reject a second marker                                                                          |
| First answer valid, second cites a missing hit                                           | `checks the second answer in a cell`                                                           | Check only the first marker                                                                     |
| Invalid second answer with no search                                                     | `rejects a malformed second answer`                                                            | Skip malformed markers when another answer passes                                               |
| Quoted `Same cause:` marker inside a code span                                           | `ignores a quoted marker`                                                                      | Scan markers inside code spans                                                                  |
| A no with an outer §9 step                                                               | `rejects a section 9 step for a no`                                                            | Ignore the step on a no                                                                         |
| An answer with blank hits                                                                | `rejects blank hits`                                                                           | Accept empty hits                                                                               |
| A trailing `): see DQ-001`                                                               | `rejects a colon continuation after an answer`                                                 | Allow the colon continuation                                                                    |
| A yes with an unknown step                                                               | `rejects an unknown section 9 step`                                                            | Accept unrecognized steps                                                                       |
| Owner step with free text after the option                                               | `rejects free text in an owner step`                                                           | Allow arbitrary text after the option inside the step                                           |
| Valid leap day `2024-02-29` with `#135 Q3 A`                                             | `accepts a leap day on a PR page`                                                              | Reject February 29                                                                              |
| Impossible date `2026-02-30`                                                             | `rejects a date outside the month`                                                             | Check only the date shape                                                                       |
| `2026-02-29` in a non-leap year                                                          | `rejects a leap day outside a leap year`                                                       | Accept February 29 every year                                                                   |
| Year `0000`                                                                              | `rejects year zero`                                                                            | Remove the year floor                                                                           |
| A page with spaces, a `Q0`, or a multi-letter answer                                     | `rejects an owner page with spaces`, `rejects question zero`, `rejects a multi-letter answer`  | Allow spaces, zero, or multiple letters respectively                                            |
| Self-proposal at the start of a fix cell                                                 | `accepts a self-proposal with its prefix`                                                      | Reject all self-proposals                                                                       |
| Self-proposal with no prefix                                                             | `rejects a self-proposal without its prefix`                                                   | Accept self-proposals regardless of the prefix                                                  |
| Self-proposal with a prefix later in the cell                                            | `requires the self-proposal prefix at the start`                                               | Accept the prefix anywhere in the cell                                                          |
| The four disputed patterns and the parity fixture                                        | Existing parity test and the scratch `patternProblem` probe                                    | Keep the fixture scope. A scratch rejection of any of the four fails its acceptance probe       |
| Older rows, withdrawn rows, the two other §9 steps, escaped pipe and same-line-only hits | Existing checker tests                                                                         | Retain the prior regression tests                                                               |
| DQ-623-shaped loss of a repeated word, with a move to the archive                        | `pairs a row moved to the archive`, `counts removed repeated words`                            | Pair by file and ID, or compare sets of words respectively                                      |
| DQ-874-shaped loss in two cells while the row grows                                      | `reports removed words when only a cell shrinks`, `reports removals from the growing cell too` | Require the row to shrink, or compare only the shorter cell respectively                        |
| Same string length, fewer UTF-8 bytes                                                    | `measures shortening in UTF-8 bytes`                                                           | Measure JavaScript string length                                                                |
| Lost words from an old row with stray cell separators                                    | `reports removed words from a malformed legacy row`                                            | Skip the raw-row fallback                                                                       |
| A word changes without any shorter line or cell, and an ID present on only one side      | `omits a row that did not shorten`, `omits an unpaired row`                                    | Report all paired rows, or treat an unpaired ID as a row with empty cells respectively          |
| Bad revision and duplicate ID                                                            | `fails for an invalid commit`, `rejects a duplicate issue id`                                  | Treat the failed Git read as an empty snapshot, or keep only one of the duplicates respectively |

## Revision 5: the owner's answers after review round 5

Owner, 2026-11-24, after round 5 (the review of `a3c1952`):

- **The edge of the reader criterion** ("Heads + active texts"): each moved file's head says where
  a bare section number, the Audit row and the snapshots S1 to S7 point. Each active instruction
  (the docs, the PR template, `AGENTS.md`, the workflows) that tells a reader to act on a moved
  part names its file. The finding text of a row and code text that did not change since
  `b45ef6f` are history and stay. The builder writes the list of places below; the review checks
  that list.
- **The round rule** ("Finish here, list"): each direction about where a review record goes agrees
  with ledger §7 step 2. The builder reads every direction about a review record, its result or a
  reopened issue (not a word search) and writes the list below.
- **Found issues get fixed** (owner: "if there are issues, we have to fix it"): the findings of
  round 5 are fixed in this PR, P2 and P3 alike. This includes the same-cause check of the old
  form (DQ-751 to DQ-777) and hits that are neither ids nor `none`.
- **Old rows in `records:removed-words`** ("Always compare"): if the cells of a row do not line up
  by heading, the command compares the raw lines and reports every lost word, also when nothing
  got shorter.
- **DQ-859, DQ-862 and DQ-869** ("Fix all three here"): DQ-869 adds its rule to `docs/testing.md`.
  DQ-859 and DQ-862 correct their sentences in the moved bytes; the move proof allows exactly these
  two edits. The three rows close. The count cells that `records:counts --write` writes for the
  closed rows change; the proof allows exactly those cells, and the PR lists each one.
- **`AGENTS.md` lines 144 to 146** ("Cite §7 only"): "For a PR in a milestone, update the delivery
  records as `docs/delivery-quality.md` §7 says."

### Places (written by the builder)

To come with the fixes.
