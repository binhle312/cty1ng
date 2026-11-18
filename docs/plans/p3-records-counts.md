# One home for record facts: a records script writes the counts

Brief: the owner's answers of 2026-11-18 (q4 "Q3: A"): "Redesign in one small PR with a plan: a
records script (extend count-audit.sh into `pnpm records:counts --write`) writes the Audit row and
the register counts; CI fails if they are stale; the PR description links to its ledger rows
instead of restating them (docs/workflows/pull-request.md and delivery-quality.md §7 change). The
open records rows of #127 and #128 close with it." And (q4 "Q6: A"): #129's causes (1), a "Same
cause?" answer written without a search, and (2), records not updated with the PR, are covered by
this redesign (no separate PR).
Checkpoint: none beyond the owner's design answer q4 Q3 A (a new check script and two workflow
texts; no shared state, module boundary or screen flow)
Approval: plan OK by the chief agent, 2026-11-18, against the owner's answers q4 Q3 A and Q6 A,
revision 2 (the chief's answers to the three open questions are in the sections below); owner
review pending

## The cause

One fact has several hand-written copies: the ledger row, the register row, the Audit row of §2,
a paragraph under the §2 table, `docs/status.md` and the PR description. A records turn changes one
copy and another lags. The late findings of #127, #128, #129, #130, #131, #132 and #133 were mostly
such slips; the "Same cause?" answers DQ-616, DQ-622, DQ-624 (#128), DQ-512 and DQ-538 name it.
#131 (the Done rows) and #133 (plans hold the design only) removed two copies. This PR removes the
others: a script writes every count, and the other records link to the row that holds a fact.

## Probes (`origin/main` at `5605954`, 2026-11-18)

1. **The script rule gives the hand counts of the register.** For each register row with the
   milestone "Audit 2026-11-05": the rows whose discovery PR (column 3, `… / #N / …`) is the PR, of
   any milestone and not `withdrawn`; open = `open` or `partial`; escaped = `escaped: yes` in the
   last cell; rounds = the round rows of the PR in the two round tables. From #105 to #133 (25
   rows) the four numbers equal the hand cells, with one difference: #114 says 2 escaped (DQ-541,
   DQ-542), and both rows say `escaped: no`. #73 to #96 count another way (the fixing PR, or the
   audit as the discoverer), so their cells are history.
2. **The Audit row.** The ledger rows with milestone `Audit`, not withdrawn, give 438 unique, 48
   open, escaped 13 in 411 rows that record it and 27 that do not: the row as it is. Its PR list is
   the 31 register rows with the milestone "Audit 2026-11-05". Their round rows add up to 152, the
   row as it is. The round tables name a PR as `[#N](…)` (most rows) or `#N` (#73, #78 in the
   archive); `count-audit.sh` reads both.
3. **Ledger rows live in two files only today.** `grep -rlE '^\| DQ-[0-9]' docs` prints
   `docs/delivery-quality.md` and `docs/delivery-quality-archive.md`.
4. **The ids DQ-751 to DQ-780** are on no branch of `origin` (`git grep` of each).
5. **The paragraphs under the §2 table** (lines 59 to 84) hold 13,935 bytes, one paragraph for
   most PRs since #105: counts, fix commits, owner answers, reserved id ranges and the output of
   `count-audit.sh`. Three open rows are wrong sentences there (DQ-626, DQ-627, and the #119 part
   of DQ-628).

## Facts with copies today

| Fact | Homes now | Home after |
| --- | --- | --- |
| Counts of the Audit row (unique, open, escaped, rounds, the PR list) | §2 row, typed by hand from `count-audit.sh` (not in the repo); the paragraphs under the table; PR descriptions | §2 row, written by `pnpm records:counts --write`; CI checks it |
| Counts of a PR (unique, open, escaped, rounds) | Register row (by hand); §2 paragraph; PR description ("two round rows") | Register row of a PR with coverage `Ledger`, written by the script |
| State, fix commit and test of an issue | Ledger row; §2 paragraph ("fixed in `c8923ef`"); the Fix and Test columns of the description table; `docs/status.md` lines | Ledger row only; the description names the id |
| Result of a review round | Round row; description ("round 2 confirmed …"); §2 paragraph | Round row only |
| "Same cause as an earlier fix?" answer and its search | Description table (`AGENTS.md` §9) and the Fix cell of the ledger row | Description table only (`AGENTS.md` §9 unchanged); the row's last cell links the related ids |
| What a merged PR delivered | `docs/status.md` line (with file lists and claims, DQ-668, DQ-712) | `docs/status.md`: the state and a link, no file list, no count, no claim that a test owns |
| Owner answers, reserved id ranges | §2 paragraphs, ledger rows, `plans/README.md` | The ledger row of the issue; the plan approval in `plans/README.md`; a range needs no record (each PR greps the branches) |

## The design

### The script

- `scripts/lib/records-counts.ts` (pure: text in, text and problems out; no file reads, no git):
  - `parseLedger(files)`: the `| DQ-` rows of all files (id, milestone, discovery PR, state,
    escaped cell), the round rows of each round table (`## 6. Review round log`,
    `## Review rounds of merged PRs`), the §2 milestone table and the §3 register. It finds a table
    by its heading in whichever file has it; a heading in no file, or in two, is a problem.
  - `computeCounts(ledger)`: the cells below.
  - `checkCounts(ledger)`: one problem for each owned cell that differs, with the file, the row,
    the column, the cell now and the cell the rows give, and "run `pnpm records:counts --write`".
    Other problems: an id in two rows (a double count); an Audit row whose discovery PR has no
    register row (with the row to add); a file outside the list that holds `| DQ-` rows.
  - `writeCounts(ledger)`: the new text of each file, with only the owned cells changed.
- `scripts/records-counts.ts` (CLI): `pnpm records:counts` checks; `--write` writes the files and
  then checks. The file list is one constant, `LEDGER_FILES`, with the two files of probe 3. It
  scans `docs/**/*.md` for lines that start with `| DQ-<digits> |` (a table row; an id quoted
  inside text does not count), so a move of rows to a new file (the size move of
  `delivery-quality.md`, tied to #107) fails the check until the file is in the list. The probe of
  the current tree goes in the PR description.
- `package.json`: `"records:counts": "tsx scripts/records-counts.ts"`.
- `.github/workflows/ci.yml`: `records:counts` joins the `gate` matrix (no git history needed).

### The cells that the script owns

- **The §2 rows whose "Lesson source coverage" cell ends with "written by `pnpm records:counts`".**
  Today only the Audit row. The milestone of the ledger rows is the first word of the §2 name
  ("Audit 2026-11-05" → `Audit`); the register rows of the milestone are those whose "Milestone /
  slice" starts with the §2 name. The script writes:
  - "PRs in baseline population": `#73, #78, … (the register rows of this milestone)`, by number;
  - "Unique issues": `438 itemized`;
  - "Open issues": `48 (48 \`open\`)`, each state that is not zero;
  - "Escaped issues": `13 in the 411 rows that record it; 27 rows do not record it`;
  - "Review rounds": `152 logged` (the round rows of the PRs of the list).
- **The register rows with the coverage `Ledger`.** `Ledger` means: each finding of the PR has a
  ledger row, so the script writes the four count cells: "Unique issues" `15 (DQ-372 to DQ-386)`,
  "Open issues" `4 (DQ-374, DQ-381, DQ-385, DQ-386)` or `0`, "Escaped issues" in the same form,
  "Review rounds" `3`. A run of three or more ids is a range; two are listed. #105 to #133 get
  `Ledger` in this PR (probe 1), and later PRs at their creation (§7 step 1). Rows with `Partial`
  or `Unmeasured` keep their hand cells as history.
- The text that the old cells added ("it also fixes DQ-037", the heads of the reviews) has its home
  in the fix cell of that row and in the round log. The build checks each such text against its
  home before the cell changes, and the PR description lists any that has none.

### The paragraphs under the §2 table (the chief's answer: remove them)

Remove the per-PR paragraphs and the count sentences (lines 59 to 84), and keep the rules of lines
55 to 58 and the two checks of M2 (lines 86 to 97). One sentence replaces them: the script writes
the row, and git history has the old text. Before the removal, a script lists each owner answer,
fix commit and range note that a paragraph names, and finds its other home (a ledger row,
`plans/README.md`, `status.md`). The description gives the script's output; a fact with no other
home goes into its ledger row first. This removes 13,935 bytes and three wrong sentences.

### How a PR description links its rows (`docs/workflows/pull-request.md`)

- The template gets a section `## Records`: "Ledger rows DQ-a to DQ-b, the round rows of #N in
  §6 and the register row (`docs/delivery-quality.md`). `pnpm records:counts` passes (CI). This
  description holds no state, count, fix commit or round result."
- The `Defect and review fixes` table keeps Finding (now the id), Cause, Same cause checked in
  (the search command and its hits) and Same cause as an earlier fix?. It drops Fix and Test: the
  row has them. `AGENTS.md` §9 stays as it is: the answer is in that table.
- "One home for each fact" adds: the script writes the counts and nobody types them; a ledger row
  does not repeat the "Same cause?" answer (its last cell links the related ids); a `status.md`
  line has the state and the link of the PR, with no file list, count or claim.
- "Before each push" adds a step: after the merge of `origin/main`, run
  `pnpm records:counts --write`; CI runs the check.

### `docs/delivery-quality.md` §1 to §3 and §7, and the review brief

- §2: the sentence of the paragraphs (open question 1), and the marker in the Audit row.
- §3: the meaning of `Ledger`.
- §7 step 1: a PR whose findings all get rows has the coverage `Ledger`. Step 5: run
  `pnpm records:counts --write`; CI fails when a count is stale. The sentence "The reviewer checks
  its sources and counts" becomes: the reviewer checks that each row is true (its state, commit,
  test and source); a count that the script writes is not a finding, because CI checks it.
- A new prevention action for the cause, with the measure below.
- `docs/review-guide.md` §5: the same sentence for reviewers; `docs/workflows/review.md`: no change
  (it points to the guide).
- `docs/testing.md` §4 (the CI gates), the scripts line of `docs/architecture.md`, a row in
  `docs/plans/README.md`. `AGENTS.md` §4 does not list `check:status` either; it stays unchanged
  (the owner changes it): Needs human review.

### Measure (the new prevention action)

In the reviews of the next three PRs with ledger rows, count the findings about a count or a copy
of a fact. Goal: none about a count (the script writes them), and at most one about a copy.

## Test strategy (test first; `scripts/records-counts.test.ts`)

No break list: these tests come before the code, and none is a security or an order test (owner,
2026-11-09); the red runs are recorded in the PR description.

| Behaviour | Test (fixture texts) | Red run |
| --- | --- | --- |
| A stale Audit count fails, and the message names the file, the row, the cell, the value now and the value the rows give | Audit row with 2 unique, rows give 3 | Before the code: the module does not exist |
| `--write` fixes it: after the write the check has no problem, and a second write changes nothing | The same fixture | Same |
| Archive rows count | A row only in the archive text adds one unique and one state | Same |
| A `withdrawn` row is skipped; `dropped` counts in unique, not open; `partial` counts as open | Four rows | Same |
| Escaped: `yes` counts; `no` records it; `unknown` and a missing cell do not record it | Four rows | Same |
| A `Ledger` register row gets its four cells by discovery PR, any milestone; a `Partial` row stays byte for byte | Two register rows | Same |
| A round row counts in both forms (`[#N](…) /`, `#N /`) and in both round tables | Rows in §6 and in the archive table | Same |
| The Audit PR list comes from the register; its rounds are the sum for those PRs | Three register rows, one of another milestone | Same |
| An Audit row whose discovery PR has no register row is a problem, with the row to add | Fixture | Same |
| One id in two rows is a problem | The same id in both files | Same |
| A file outside the list with `| DQ-` rows is a problem; a missing table heading is a problem | Fixture map of files | Same |
| Ids: three or more in a run are a range, two are listed | `DQ-1, DQ-2, DQ-3, DQ-7, DQ-8` | Same |

Real runs, recorded in the description: (1) the check on the files of `main` after the `Ledger`
markers, before `--write`: it lists the stale cells; (2) a scratch copy with one count changed by
hand: the check fails; `--write`, then it passes; (3) the diff of the first `--write` on the real
files, each difference checked against its rows.

## Not claimed

- The script does not check that a row is true (its state against the commit, its test). The
  reviewer checks that.
- It does not read PR descriptions or `docs/status.md`; the link rule there is a written rule.
- It does not check the 600-byte limit of a row (pull-request.md step 7; about 120 rows are over it
  on `main`) or the file size (§7 step 6).
- Rows of a PR branch count only after that branch merges. Two PRs that merge one after the other
  can leave `main` stale until the next PR runs `--write`; CI on `main` shows it red.
- No test reads the line of `ci.yml`.

## Open rows: how each one ends

The end rules (the chief's answer, 2026-11-18; `dropped` is not used: the owner's q4 Q3 A says
the rows "close with it" and gives no "do not fix"):

- **A wrong fact in a home** (a ledger cell, a round row, a `status.md` line, `plans/README.md`):
  corrected; state `fixed`.
- **A wrong restated fact in a PR description**, merged or open: the restated text is replaced with
  the new `## Records` link form (`gh api -X PATCH repos/binhle312/cty1ng/pulls/<n> -F body=@<file>`);
  state `fixed`. A copy of each old body stays in the leader's files folder, and the description of
  this PR lists each edited PR. GitHub keeps the edit history.
- **An old "Same cause?" answer written without a search**: the search runs now and goes into the
  row, with the search named; state `fixed`. If the search shows that the old answer was wrong, it is
  not patched: it goes to the chief as an `AGENTS.md` §9 owner case, and the row stays `open`.
- **A wrong copy in the §2 paragraphs**: the paragraphs are removed (above); state `fixed`.
- Any row that cannot close stays `open` with its reason.
- The row closures start only when #127, #128, #129 and #132 are on `main` (the chief tells the
  leader after each merge). Rows of a branch that is not merged then stay out of this PR.
- DQ-618 and DQ-669 are not in this PR: the chief's merge preparation of #128 ends them.
- #114's register row says 2 escaped (DQ-541, DQ-542); both rows say `escaped: no`. The build finds
  which side is true, with evidence, and corrects that side; the fact lives in the rows.

| Row | Finding (short) | End |
| --- | --- | --- |
| DQ-626 (#128) | §2 sentence: DQ-624 "fixed in the step 5 commit" | Fixed: the paragraph is removed; DQ-624's row is right |
| DQ-627 (#128) | §2 sentence: counts "from the script on the records commit" | Fixed: the paragraph is removed; the script writes the counts |
| DQ-628 (#128) | Body "two round rows"; DQ-620, DQ-622 fix-induced `no`; §2 #119 sentence | Fixed: DQ-620 and DQ-622 get the fix-induced value that the commits show; the §2 sentence is removed; the body gets the link form |
| DQ-629 (#128) | DQ-622's precedent DQ-512 is another cause | Search runs now and goes into DQ-622; fixed, or a §9 case for the chief |
| DQ-630 (#128) | DQ-625 lacks the fixed words; the measure count 1 not told | Fixed: DQ-625's last cell gets "fix-induced: yes (the round 2 correction DQ-617)"; Needs human review tells the owner that the measure count of step 5 is 1 |
| DQ-591 (#129) | Description row R3-3 "Same row as above" | Fixed: the body gets the link form, with the search of R3-3 named |
| DQ-592 (#129) | DQ-649, DQ-650 and R4 rows name no search | Search runs now and goes into the rows; fixed, or a §9 case |
| DQ-593 (#129) | The search of DQ-646 is not exact | Search runs now with its exact hits into DQ-646; fixed, or a §9 case |
| DQ-594 (#129) | Description stops at check 3; DQ-640, DQ-641 keep a wrong "Check 3" note | Fixed: the note leaves DQ-640 and DQ-641; the body gets the link form |
| DQ-595 (#129) | DQ-649 contradicts the fixed answer used by DQ-640 | Fixed in DQ-649 by the facts of the two rows, or a §9 case |
| DQ-663, DQ-664 (#130) | Runner defects on `main` | Open: home #107 (not in this PR) |
| DQ-665 (#130) | DQ-652 answers "No" with no search | Search runs now into DQ-652; fixed, or a §9 case |
| DQ-666 (#130) | DQ-657, DQ-659, DQ-662 not the fixed answer | Fixed: the rows get the fixed answer of `AGENTS.md` §9, and the `Not claimed` line goes under Needs human review of this PR; or a §9 case |
| DQ-667 (#130) | Round 2 row says DQ-652 confirmed | Fixed: the round row says what round 2 read |
| DQ-668 (#130) | Status line of #130 claims more than testing.md | Fixed: the status line becomes the state and the link |
| DQ-670 (#130) | Description says DQ-263, DQ-302 open on #107 | Fixed: the body gets the link form |
| DQ-688 (#131) | The plan's test rows describe the tests as built | Open: the §7 action of #133 says the owner decides it under plans rule 6 |
| DQ-689 (#131) | DQ-683, DQ-685 cite DQ-565, DQ-570 as if on `main` | Fixed when #127 is on `main` (the rows are then there; `git grep`); else open |
| DQ-691 (#131) | The R1-3 proposal recommends its own PR | Fixed: the body gets the link form, and the proposal says what the rules say |
| DQ-692 (#131) | DQ-684's cell "As DQ-652" unclear; R1-4 not in the table | Search runs now into DQ-684; the body gets the link form with R1-4; fixed, or a §9 case |
| DQ-711 (#133) | The description's search names a line range | Fixed: the body gets the link form with a search that gives the hit |
| DQ-712 (#133) | Status line of #133 has a file list without two files | Fixed: the status line becomes the state and the link |
| DQ-713 (#133) | The short DQ-542 drops that the response keeps `z.string()` | Fixed: DQ-542 gets the words back |
| DQ-571 (#127) | DQ-565 "yes" with no redesign | Fixed: #131 built the redesign (`pnpm check:status` in CI) |
| DQ-573 (#127) | DQ-570, DQ-572 cells: no "Same cause?" answer or search | Search runs now into the rows; fixed, or a §9 case |
| DQ-575 (#127) | No `Defect and review fixes` table in the description | Fixed: the body gets the table in the new form |
| DQ-576 (#127) | DQ-571 says "built in its own PR" and misnames DQ-207, DQ-212 | Fixed: DQ-571's cell is rewritten when it closes |
| DQ-577 (#127) | DQ-565 names list PR 22 as the home | Fixed: DQ-565's cell names #131 |
| DQ-578, DQ-579, DQ-581 (#127) | "Same cause?" answers and searches of DQ-570 to DQ-575 | Searches run now into the rows (with the §7 actions and the lessons); fixed, or a §9 case |
| DQ-580 (#127) | DQ-570 says DQ-571 handles the cause | Fixed: DQ-570's cell names #131 (Done rows) and this PR (counts and links) |
| DQ-582 (#127) | DQ-570, DQ-572, DQ-573, DQ-575 over 600 bytes | Fixed: the four rows are rewritten under 600 bytes |
| DQ-583 (#127) | Check 4 round row "none yet"; the §2 paragraph; the body | Fixed: the round row says what check 4 found; the paragraph is removed; the body gets the link form |
| DQ-722 to DQ-728 (#132) | Check 3 of #132 | Only the rows whose cause is a records copy or slip, each fixed in its home (a status line, `plans/README.md`, DQ-679, DQ-678, DQ-671, the body). A row about behaviour (the hung setup call of run 87, slowness under load) stays open, as the owner said in q4 Q7 A |
