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
Revision 4, owner, 2026-11-24 ("Approve as written"): the section "Revision 4" below.
Revision 5, owner, 2026-11-24, after round 5: the section "Revision 5" below.
Revision 6, owner, 2026-11-25, after round 6 ("All your picks"): the section "Revision 6" below.
Revision 7, owner, 2026-11-25, after round 8 (Q1 L, Q2 F): the section "Revision 7" below.
Revision 8, owner, 2026-11-25, after round 9 (Q1 S, Q2 A, Q3 A, Q4 C): the section "Revision 8" below.
Revision 9, owner, 2026-11-25, after round 10 ("let goes with your picks": Q1 E, Q2 R, Q3 A): the section "Revision 9" below.

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

Line numbers below refer to `ba40948`. To repeat the search, run
`bash tmp/split-b7-reader-search.sh`. The search output is in `tmp/split-b7-reader-search.log`.

**Reader places**

- `docs/delivery-quality-prevention.md:3` and `:20` — fixed. The head names both files and shows where to find S1.
- `docs/delivery-quality-register.md:5`, `:25–26`, `:34`, and `:58–68` — right. The head sends §7 to the ledger. The Audit row and snapshots are in the register.
- `docs/delivery-quality-register.md:9–11` and `:41` — right. The PR population and M2 close check are in §2 of the same file.
- `AGENTS.md:144–146` — fixed. The owner chose one pointer to §7, which links the register.
- `AGENTS.md:158` and `.github/pull_request_template.md:45`, `:54` — right. The instructions name the files for the register and prevention actions.
- `docs/README.md:43`, `docs/status.md:4–6`, and `docs/delivery-quality-archive.md:4–6` — right. The entry points link the new files.
- `docs/delivery-quality.md:11–15`, `:42–52`, and `:208–210` — right. The head and stubs link the moved sections.
- `docs/delivery-quality.md:57–58`, `:149–152`, and `:156–157` — right. The snapshot notes and backfill instruction link to register §4.
- `docs/delivery-quality.md:136` and `:139` — right. The fix text of DQ-859 and the finding text of DQ-862 link the moved sections (revision 6 corrects this line).
- `docs/delivery-quality.md:176–177`, `:185–187`, and `:200–201` — right. The steps link the register or prevention file at the point of use.
- `docs/delivery-quality.md:191` — fixed. The close step links the PR population in register §2.
- `docs/workflows/pull-request.md:34` and `:55` — right. The same-cause search names the prevention file and its command names both moved files.
- `docs/workflows/pull-request.md:47` — fixed. The count instruction links the file for the Audit and register rows.
- `docs/workflows/egm.md:77`, `:81–83`, and `docs/testing.md:361–364` — right. The trial and CI instructions link the sections they use.
- `scripts/README.md:12`, `scripts/records-counts.ts:1–3`, `:18–19`, and `scripts/lib/records-counts.ts:345` — right. Each names the file by path, link, or the register path in the message.
- `scripts/lib/records-counts.ts:548` and `scripts/records-counts.ts:36` — fixed. Both search comments name the prevention file.
- `scripts/lib/README.md:13` and `scripts/lib/records-counts.ts:4–5` (R5A2R-F3) — history, unchanged since b45ef6f. The table names are the same as at the split base.
- `scripts/lib/records-counts.ts:168` and `:328` (R5A2R-F4) — history, unchanged since b45ef6f. The messages are the same as at the split base.
- `docs/status.md:15` and `:105` — history. Both describe the approved move and link its plan or PR.

**Round places**

- `docs/delivery-quality.md:180–182` — right. This is §7 step 2, the rule for the review destination.
- `docs/delivery-quality.md:24`, `:153–154`, and `:163–166` — right. The counting rule keeps the original issue ID, and the live issue and round sections send the review to step 2.
- `docs/delivery-quality.md:178`, `:183`, and `:192–193` — right. These lines cover issue rows, fix evidence, and the archive move after merge.
- `docs/delivery-quality-archive.md:9–10` — right. The archive head links to step 2 for which PRs use round rows.
- `docs/delivery-quality-archive.md:12–13` — fixed. The issue row goes back to the live ledger. Step 2 gives the destination for the reopen event.
- `docs/delivery-quality-register.md:22` and `:48–49` — right. The register counts distinct rounds and defines issue coverage for its own rows.
- `.github/pull_request_template.md:43–45` and `:51` — right. The records section points to step 2 and gives the locations of issue and register rows.
- `AGENTS.md:144–146` — fixed. The checklist points to §7.
- `AGENTS.md:154`, `:156–166` — right. These rules cover skill citations, issue evidence, redesign review scope, and the PR claim that needs owner review.
- `docs/workflows/pull-request.md:42–46` and `:90–92` — right. These lines name the issue row and the sources of evidence, and point to step 2 for the result.
- `docs/workflows/pull-request.md:113–114` — fixed. A later review follows step 2.
- `docs/workflows/implementation.md:32–33` — fixed (revision 8, R9W-F1). At handoff the PR reconciles its issue rows there; step 2 says where review rounds and review findings go.
- `docs/workflows/implementation.md:45–53` — right. The workflow links the rules for issue rows and their evidence.
- `docs/workflows/review.md:5–6` and `:27` — right. The workflow points to §7 for the review and uses the requested destination for the findings report.
- `docs/review-guide.md:13`, `:23`, `:101–105`, and `:109–122` — right. The guide tells the reviewer what to report and points to step 2 for its home.
- `docs/workflows/merge-bar.md:19`, `:51–55`, and `:68–93` — right. The bar points to step 2 for each check and gives the rules for issue rows and follow-ups.
- `docs/workflows/merge-bar.md:60`, `:63–65`, and `:106–108` — right. These lines assign owner decisions and work on issues found after merge.
- `docs/workflows/audit.md:17–30` and `docs/workflows/coordination.md:54` — right. These instructions cover evidence in an audit file, the search in a finding, and feedback about how a slice was built.
- `scripts/lib/records-counts.ts:1–3` — fixed. The comment points to step 2 for the review destination.

Revision 6 adds these places. Their line numbers refer to the commit that fixes the round 7 findings (R7W-F1 to R7W-F3).

- `docs/delivery-quality.md:181–188` — fixed. Step 2 gives the home of the review findings of a PR with no milestone (Q2 A), and limits the row rules to a PR in a milestone or an audit (revision 7).
- `docs/delivery-quality.md:65–66` — fixed (R6W-F3). A delivery PR does not move closed rows to the archive; a reopened row comes back from the archive, as the archive head says.
- `docs/delivery-quality.md:156` and `:172` — right. A duplicate report keeps one issue row and links each source; a round row names its source. Step 2 covers a PR with no milestone.
- `AGENTS.md:154–155` — fixed. The answer goes to the place that step 2 gives (Q2 A).
- `.github/pull_request_template.md:46–48` and `:52–53` — fixed. The description holds no state, count or fix commit of a ledger row; for its review findings, a PR with no milestone follows step 2, which is the one home of that rule (Q2 A, R7W-F1, R7L-F3).
- `docs/workflows/pull-request.md:46–47` and `:51–53` — fixed. For its review findings, a PR with no milestone follows step 2 (Q2 A, R7L-F3).
- `docs/workflows/merge-bar.md:19` — right (revision 7). Its P3 home is for a PR in a milestone or an audit; step 2 gives the home for a PR with no milestone.
- `docs/workflows/merge-bar.md:70`, `:90`, `:94–95` and `:97–103` — right (revision 7). Lines 70, 90 and 94 give a review finding a ledger row or an issue row, and the measure at 97–103 reads such rows, so they are for a PR in a milestone or an audit; step 2 says so.
- `docs/review-guide.md:94` — right. A plan difference goes under `Differences from the plan`; it is not a review record.

## Revision 6: the owner's answers after review round 6

Owner, 2026-11-25, after round 6 (the review of `bb9e78e`), on the round 6 page: "All your picks"
(Q1 A, Q2 A, Q3 A). The page told the owner that the cause of the checker findings repeats, so Q1 A
is the `AGENTS.md` §9 decision for them. The owner's answer of 2026-11-24 ("if there are issues, we
have to fix it") was about severity, not this decision.

- **Q1 A, the checker findings** (R6B1-F1 to F4, R6B2-F1, R6B2-F2, R6C1-F1 to F3, R6C2-F1, R6C2-F2):
  - The old answer form (DQ-751 to DQ-777) goes back to the rule on `main`: the regular expression
    `OLD_ANSWER` tests the whole fix cell. The withdrawn check reads the State cell only (R5B-F2).
    This replaces the revision 5 bullet "Found issues get fixed" for the old form.
  - Result of the rule on `main` (lead agent, a probe of the six inputs): it accepts all six. So
    R6B1-F3 (a search place with parentheses) is fixed. R6B1-F2 (a colon in a quoted search),
    R6B1-F4 (a blank search) and the old-form part of R5BP-F2 (an answer only in a code span, a bare
    second marker, blank hits) are accepted as on `main`. The fixes of R5BP-F2 for the old form are
    withdrawn. The tests and break claims that only `e1f6fb1` added for them go:
    `rejects an old-form answer inside a code span`, `rejects an incomplete second old-form answer`,
    `rejects blank hits in an old-form answer` and their breaks. The old-form tests from `main` stay.
  - Test gaps: the break of `rejects blank hits` makes the checker accept blank hits (R6B2-F1). A
    test fails when the answer body treats escaped backticks as a code span (R6B2-F2). A test covers a
    legacy row that loses a word and keeps its byte length (R6C2-F1). The test name and claim of the
    aligned row say that its cells line up by heading (R6C2-F2): the revision 4 test
    `omits a row that did not shorten` becomes `omits an aligned row that did not shorten`.
  - The four patterns of revision 4 (`a+?`, `a{,3}`, `[a[:digit:]]`, `x[^]`) get a test that the
    checker accepts each, with a break claim (R6D-F1).
  - Limits that stay (owner, Q1 A), each in one Follow-ups row of `docs/status.md`: three backticks
    inside a code span (R6B1-F1); an extra space after the issue id or in the `Issue ID` heading of a
    row that `records:removed-words` reads (R6C1-F1, R6C1-F2; the id matcher is from `95e830e`,
    before #153, and the heading lookup from `b76a015` of #153); the place of a repeated phrase in its output (R6C1-F3); and the old-form inputs above.
    No row of the live ledger or the archive has these inputs today.
- **Q2 A, review findings of a PR with no milestone** (R6W-F2): ledger §7 step 2 is the one home.
  A PR with no milestone keeps its review rounds and its review findings in its description. Each
  finding has its fix and its "Same cause" answer with the search in the `Defect and review fixes`
  table, and gets no issue row. Where a rule names an issue row for a review finding, such a PR uses
  its line in that table. `AGENTS.md` §9, the PR template and `docs/workflows/pull-request.md` point
  to step 2. The new words of `AGENTS.md` §9 (the owner approved the change, Q2 A; the exact words
  go to the owner in the next report): "Each review fix answers "Same cause as an earlier fix?" with
  the search, in the place that `docs/delivery-quality.md` §7 step 2 gives."
- **Q3 A, the round places** (R6W-F1): the list "Round places" above adds the places that round 6 found, ledger
  line 65 (R6W-F3), and the texts that revision 6 changes. The claim gets smaller than revision 5:
  each place in the list agrees with §7 step 2. `Not claimed: every direction about review records
  outside the list.`
- **Round 7** (narrower than the revision 3 "complete review", owner, Q1 A): a review of
  `bb9e78e..` the final head by the merge bar: the checker and test changes, the doc and rule edits,
  and the PR description. Its brief names the limits above as owner decisions.
- **Fixes with no question:** DQ-859 quotes its real sentence from before the split (R6P-F1); the register head names the
  Audit row in §2 and S1 to S7 in §4 (R6R-F1, R6L-F1); DQ-862 says "Old home:" (R6R-F2); the plan
  index gives this plan revisions 1 to 6 and #151's plan revisions 1 to 4 (R6L-F2); the Reader
  places line of DQ-862 (R6L-F3).

## Revision 7: the owner's answers after review round 8

Owner, 2026-11-25, after round 8 (the review of `e3df058..c1efeee`), on the round 8 page: Q1 L and
Q2 F. The page told the owner that the cause of the Q2 A rule-text findings repeated in rounds 6, 7
and 8 (`AGENTS.md` §9), and that the round 6 page gave a wrong origin for R6C1-F2. Two consultants
(Opus 5.5 and GPT-6.2 Astra) checked the lead agent's first pick before the page; both rejected more
mapping words.

- **Q1 L, the row rules** (R8L-F1 to F3, R8W-F1 to F5, R8D-F2, R8D-F3): step 2 keeps each review
  finding of a PR with no milestone, open or fixed, in the `Defect and review fixes` table; an open
  finding is also a follow-up row. A rule that gives a review finding a ledger row or issue row is
  for a PR in a milestone or an audit. The review guide checks the "Same cause" answer of each line
  of that table. The mapping words of `c1efeee` go: the cell and id mapping, the columns, and the
  follow-up name in the line. The merge bar goes back to `main` at line 19 and at the round 2
  correction. The template says that its table is for ledger rows. This replaces the Q2 A sentence
  "Where a rule names an issue row for a review finding, such a PR uses its line in that table" of
  revision 6, and the Q3 A verdicts of the merge-bar places in "Round places".
  - Rules that L turns off for a review finding of such a PR: merge bar 19, 70, 90, 94–95 and the
    measure at 97–103; implementation 50 and 52; review guide 109. A PR with no milestone has no
    round 2 measure; #153 has 0 round 2 corrections.
  - Rules that stay on: the row size and removed-words rules of the PR workflow (lines 94, 118 and
    128), merge bar 28, and the defect rows of the template.
- **Q2 F, R6C1-F2** (an extra space in the `Issue ID` heading): `tablesWithHeader` compares the
  trimmed cells of a heading line that starts with `|`. The heading lookup itself is from
  `95e830e`; `b76a015` of #153 uses it for issue rows. The fix also lets `records:counts` find a
  padded heading of its own tables. R6C1-F1 (an extra space after the issue id) stays a limit.
- **Test strategy.** Test first: a test of a padded `Issue ID` heading, and a break that restores
  the exact heading match. The rule text has no code test. The round 9 brief replays two findings
  of #153 and one made-up case against step 2 and the merge bar: R7L-F5 (fixed: one table line, no
  follow-up row), R6B1-F1 (open: one table line and one follow-up row), and a round 2 correction
  (a table line that the measure does not read; #153 has none).
- **Round 9** reviews `c1efeee..` the final head and the PR description. Check D is split in two.
  Its brief says that the limit of L is known and tracked; reviewers report each issue that they
  find.
- **Fixes with no question:** the description facts of round 8 (R8D-F1, R8D-F4 to F9, R8L-F4) and
  the plan line R8W-F6. The line numbers of the round places that revision 7 changes refer to the
  revision 7 commit.

## Revision 8: the owner's answers after review round 9

Owner, 2026-11-25, after round 9 (the review of `c1efeee..dc23e78`), on the round 9 page: Q1 S,
Q2 A, Q3 A and Q4 C. Two consultants (Opus 5.5 and GPT-6.2 Astra) checked the questions first. The
page told the owner that R9W-F1 is the fourth round of the Q2 A rule-text cause after the redesign
L, and that the Q2 F fix changed a shared function, wider than the Q2 F page said (R9B-F1).

- **Q1 S, one heading rule** (R9B-F1): a line is the heading of a table when its trimmed cells
  match and a separator line follows it. The separator rule is the one of the split-table check,
  in one constant. This applies to each reader of `tablesWithHeader` (`records:counts` and
  `records:removed-words`), so an unpadded heading with no separator line no longer opens a table
  either. That older gap is from before #153.
- **Q2 A, two rule sentences** (R9W-F1, R9W-F2, R9L-F2):
  - `docs/workflows/implementation.md:33`: "At handoff, reconcile the PR's issue rows and their
    evidence there. Step 2 says where review rounds and review findings go."
  - Ledger §7 step 2: "The line holds the fix, or the decision that leaves the finding open, and
    the "Same cause" answer with its search; the finding gets no issue row (owner, 2026-11-25)."
- **Q3 A, answers in a PR description** (R9D2-F2, R9D2-F3): the owner's answer is the §9 decision
  for a repeated answer defect in the table of a PR description: fix it in place, and review checks
  each line. One Follow-ups row asks a later PR for a script check of that table.
- **Q4 C, round 10** is the complete review of the final head (review guide §6). It ends the review
  if it finds no P1 or P2. Its checks are split by file group, each under 35% of its context. The
  owner limits and the costs of Q1 L are not findings.
- **Test strategy for Q1 S.** Test first, each with a break claim: a padded heading with no
  separator line (the cells are compared as one raw row), an unpadded heading with no separator
  line, and a padded data row in another table (no second register).
- **Fixes with no question:** the description facts of round 9 (R9D1-F1 to F5, R9D2-F4, R9D2-F5),
  each "yes" answer of the description names its §9 step, and the plan lines R9W-F3, R9W-F4 and
  R9L-F4.

## Revision 9: the owner's answers after review round 10

Owner, 2026-11-25, after round 10 (the complete review of `328ae4c`; 16 of 18 checks stopped at
35% of their context), on the round 10 page: "let goes with your picks" (Q1 E, Q2 R, Q3 A). Two
consultants (Opus 5.5 and GPT-6.2 Astra) checked the questions first.

- **Q1 E, the end of the review.** This replaces the bar of revision 3 ("a complete review of the
  final head") and Q4 C of revision 8.
  - The builder fixes each issue that round 10 found.
  - Round 11 reads the diff of the fixes, probes `records:counts` with real inputs, traces each
    promise of this plan to its build, reads the text written since round 9, and reads the
    "Same cause" answer and §9 step of each line of the old round tables (rounds 1 to 9 of the
    PR description). A script lists those answers for the check. Each check is sized to end
    under 35% of its context.
  - The other cells of the old table lines are `Not claimed`.
  - End rule (merge bar steps 4 and 5): after round 11, only a P1 or P2 gets a fix, with one
    check of that commit and at most one more.
- **Q2 R, refuse the loose forms** (R10RW-F1, R10RW-F2; the §9 redesign of the cause of R5C-F1,
  R6C1-F1, R6C1-F2 and R9B-F1). The owner rates them P2.
  - One function in `scripts/lib/records-counts.ts` finds two forms in the delivery-quality files:
    a CR character (one problem for each file), and a line that starts like an issue row
    (`|`, spaces or tabs, `DQ-` and digits, spaces or tabs, `|`) but not exactly as `| DQ-n |`.
  - `records:counts` reports these problems, in check and in write mode, and writes nothing then.
    `records:removed-words` refuses a snapshot that has them, with the problems in its error.
  - The limit R6C1-F1 (a space after the id) closes. R10RW-F3 (an issue row inside a fenced
    example gives a false duplicate) goes to the limits row of `docs/status.md`.
- **Q3 A, the lines of this description** (R10D6-F2, R10D6-F3): for #153 only, a defect in a line
  of the PR description is fixed in place, and review checks it. The Follow-ups row of the
  script check also names a Differences row with no reason and a finding summary that leaves
  out a case.
- **Test strategy for Q2 R.** Test first, each with a break claim: `records:counts` refuses a
  padded id (a space before, and a space after), and CR line ends (one problem for the file);
  `records:removed-words` refuses a padded id and CR line ends in a snapshot; the real ledger
  files give no problem.
- **Fixes with no question:** the other round 10 findings, in place. R10D5-F1 cites round 8 Q1 L;
  R10D5-F2, R10D2-F1 and R10D6-F1 cite round 9 Q3 A; R10D2-F2 cites DQ-155 (owner, 2026-11-09,
  option A).
