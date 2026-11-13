# DQ-161: the break runner takes its file list from git

Brief: none. The source is DQ-161 and the owner's answers of 2026-11-13 (questions 5 and 6 of #107, D5, D8, D11).
Checkpoint: plan. A redesign after repeated fixes with one cause (`AGENTS.md` §9).
Approval: waiting for revision 5. Revision 4 is approved by the owner (2026-11-13). The owner answered the four points of revision 5 (D8, part 9). The owner did not approve the text of revision 5 and the test strategy yet: the owner's order 27 gave the night review to the orchestrator, and the description of #107 names this under `Needs human review`.

This text is revision 5. It is revision 4, plus the copy of the runner (D5), plus the answers of
D8, plus the probes of 2026-11-13 (part 6, "Probes of revision 5"), plus the points of part 12.
The orchestrator answered those points on 2026-11-13; the owner did not see them yet.

Where it is built (owner, 2026-11-13, D11): in #107, on the branch `fix-break-runner`. Not in a
new PR and not on a new branch. This file becomes `docs/plans/dq-161-runner-file-list.md` there.
On that branch, `AGENTS.md` §9 and `docs/review-guide.md` line 106 still say that a redesign is
built in its own PR. D11 replaces that rule. #112 changes the two texts, so the merge order is
#109, #112, then #107. #107 does not change them.

## 1. The problem

`pnpm check:breaks` refuses a break list that misses a test of the PR (`docs/testing.md` §5,
step 3). It finds the tests of the PR in the text of a `git diff` patch. That text is for
people, and git settings change it. A file that the patch text does not show as a changed file
needs no claim, and the list looks complete. The runner also makes its copy from a patch text.

Seven ways lose a file or a test with this cause:

| Way | State on `1eb3e5c` |
| --- | --- |
| Prefix settings | Fixed options |
| A copy | The reader stops |
| A name with a space | The reader reads it |
| A file that git shows as binary | Open (DQ-257): no hunk, no error |
| A rename to a test name (`cases.ts` to `cases.test.ts`) | Open (DQ-262): no hunk with no changed line; only the changed lines with a hunk |
| `diff.relative=true`, when git starts in a subfolder | Open: only the files of the subfolder (a probe of this plan) |
| The patch of the copy (`git diff HEAD --binary`, then `git apply`) | Open (DQ-263): with an external diff tool the patch is empty, and the copy keeps the text of `HEAD` with no error. With the file list of this plan, the old text and the new text of a changed test file are then the same, so no test counts |

One more defect is on the same lines (a finding of the prototype of revision 5; no ledger row
has it yet): the runner lists the new files with `git ls-files --others` and no `-z`. Git quotes
a name such as `né.test.ts`, and the runner stops with `ENOENT`.

## 2. The design (owner, 2026-11-13: option 2, with one condition; then D5 and D8 for the copy)

The runner reads no patch text. It asks git which files changed. It compares the tests of the
old text and the new text of each changed test file. It makes its copy from the files on disk.

### The file list

`git diff --name-status -z --no-renames --no-relative <base>` gives one status letter and one
name for each file, with no quotes. This output is for programs.

- `--no-renames` (owner): a renamed file is a deleted file and a new file. No row for a rename
  or a copy.
- `--no-relative`: with `diff.relative`, git lists only the files of the folder where it starts.

The reader of this text stops with an error if the text is not a list of pairs (a status, then a
name). It does not drop a part that it cannot read.

**The name rule.** A test file is a file that the name rule of `scripts/check-breaks.ts` matches
(`/\.(test|spec)\.[cm]?[jt]sx?$/`), not `isTestFile`. The rules below apply only to such a
file. A picture in `frontend/test/e2e/shell.spec.ts-snapshots/` is not a test file by name, so
no rule applies to it.

| Status of a test file | The runner |
| --- | --- |
| `A`, a new file | Each test of the file needs a claim |
| `M`, a changed file | Each test with a new key needs a claim (below) |
| `D`, a deleted file | No test, no stop |
| Another status | **Stops** and names the file |

- A new or changed test file that the runner cannot read **stops** the run. This is also true
  for the old text of a changed file. Today the runner ignores such a file with no message
  (`if (text === null) continue`).
- A new file that git does not track is not in a diff. Each of its tests needs a claim, as
  today. The list comes from `git ls-files -z --others --exclude-standard` (D8, point 4).
- The two stops apply also with `--only`.

`scripts/lib/breaks.ts` gets one function that gives the tests of the PR and the problems. It
gets the git command and the reader of the copy as arguments, so the file keeps its rule: no
file call and no process call.

### The key of a test (the owner's condition)

For a changed file, the runner reads the old text with `git cat-file blob <base>:<path>` and
the new text from the copy. The key of a test has three parts:

1. its name;
2. the first line of each `describe` group around it;
3. its text, from the first line of the test call to its last line.

A test of the new text needs a claim if the old text has no test with the same key. Two tests
with one key: each old test stands for one new test only. A line end of Windows is no change.

The reason for part 2: a group decides if its tests run. A test that moves out of a
`describe.skip` group starts to run, with no change of its text.

A `describe` group is a call whose name has `describe`: `describe(...)`, `describe.skip(...)`,
`describe.each(rows)(...)`, and `test.describe(...)` of Playwright. The line is the line as
written, with its spaces.

### The name of a test (part 12, point 5)

Today the runner sees only a test call whose name is a plain string. A test with `${…}` in its
name needs no claim, with no message; 2 tests of this repository have this form. The redesign
closes this, because its cause is the cause of DQ-161: a test that the reader does not see
needs no claim.

| The first argument of a test call | The name of the test |
| --- | --- |
| A plain string, or a template with no `${…}` | Its text, as today |
| A template with `${…}` | Its text, with `%s` in the place of each `${…}` |
| Another expression (for example a variable), when a later argument can be a function; or a spread (`...row`) | The text of the argument as written, for example `row.name` |

- `it.each` with a template table (``it.each`…`("name", …)``) is a test call. Today the reader
  does not see it.
- `%s` matches one or more characters of a reported name: `nameMatches` joins the parts of a
  name with `.+`, as today for `it.each`. So a `${…}` matches one or more characters too.
- No claim can name a test whose name is an expression. Such a test needs an `exempt` entry
  with that text as its name, or a plain name. The first text of this plan said that such a
  name "matches no reported name". That was wrong when another test has that text as its plain
  name (round 1 of the review; part 12, point 10).
- A claim stands for one test: the test whose name matches and that has the assertion text of
  the claim (part 12, point 10).
- A later argument can be a function unless it is a string, a template, a number, an object
  or an array as written (part 12, point 11). So the name of a function counts, and each other
  expression: the reader cannot know what it holds. The first text of this plan said "when a
  later argument is a function", and the code took only a function that is written in the
  call (round 3 of the review).
- A call with no argument (`test.slow()`) is no test call. A call whose first argument is such
  an expression is no test call when no later argument can be a function, such as
  `test.skip(condition, "reason")` inside a test of Playwright, and `it.each(rows)`.
- The cost of that rule: `test.skip(condition, reason)` with the reason in a variable is no
  test, but the runner reads a test with the name `condition` and asks for an `exempt` entry.
  The repository has no such call (part 12, point 11).
- The claim format does not change.

### The copy (owner, 2026-11-13, D5 and D8: way 2, no patch)

The runner reads the new text of each test file from its copy. So the copy must be the same as
the checkout, with each git setting. Today the copy is `git archive HEAD` plus a patch from a
plain `git diff HEAD --binary`.

The copy of this plan: `git archive HEAD`, then a second call of the reader of the file list,
against `HEAD`: `git diff --name-status -z --no-renames --no-relative HEAD`. It gives each
tracked file that is not as in `HEAD`.

| Status | The copy |
| --- | --- |
| `A`, `M`, `T` | Takes the file or the link from the disk, with its execute bit |
| `D` | Removes the file |
| Another status | The runner **stops** and names the file, before it makes the copy |

- This rule applies to each file, not only to a test file.
- The copy first removes each `D` file. Then it takes the other files. If a folder is in the
  place of a file in the copy, the copy removes that folder first. So the result does not depend
  on the order of the list (`diff.orderFile` changes the order: a probe of revision 5), and a
  folder can become a file.
- A new file that git does not track comes from the disk, as today: only a plain file, and no
  link. The list is `git ls-files -z --others --exclude-standard`.
- A listed path that is no plain file and no link on the disk stops the run.

**The list is against `HEAD`, not against the base** (D8, point 2). One case of the measure: a
commit changes a test file, and a local change gives it the base text again. The list against
the base does not name the file, so the copy keeps the text of `HEAD`: 0 of 1, with no error.
The list against `HEAD` gives 1 of 1.

**The copy step is a function** in the new file `scripts/lib/breaks-copy.ts` (D8, point 3), so
that a test can call it. `scripts/lib/breaks.ts` stays with no file call and no process call.

**The report line "Local changes".** Today its hash comes from the patch text. With this plan it
comes from the files as the copy takes them. The input is, for each listed file and each new
file, in the order of the paths: the status (a new file has `?`), the path, the type (a file, a
file with the execute bit, a link), and the content (for a link: its target). The line says
`none` if the two lists are empty. The hash of one state is then not the hash of today. The
type and the fixed order are an addition of revision 5 to the draft (part 12, point 4).

Way 1 (fixed options on the patch) is not built. Part 8 keeps its numbers as the record of the
decision.

### Which tests count (a run of 24 changes through the prototype, and the probes of revision 5)

| Change | Counts |
| --- | --- |
| A line changes in a test, or goes out of it | That test |
| A new test; a new row of `it.each`; `it` to `it.skip` | That test |
| More spaces before each line of a test | That test |
| A test moves inside its group, with the same text | **No test** (owner: approved change of meaning) |
| A test moves out of `describe.skip` into a group that runs | That test |
| A test moves into `describe.skip`, or from one group into another | That test |
| `describe.skip` becomes `describe` | Each test of the group |
| A group gets a new name | Each test of the group (owner: accepted cost) |
| A new `describe` comes around a group, with or with no change of the spaces | Each test of the group |
| The second of two tests with one name changes | That test |
| A test goes | No test |
| A helper above the tests changes; a `beforeEach` body changes | No test |
| The file has `-diff`, and a line of one test changes | That test |
| The file name has a quote, and a line of one test changes | That test |
| Only the mode, or only the time of the file changes | No test |
| The file gets a new name | Each test of the file |
| Line ends of Windows on disk (`core.autocrlf=true`), and a line of one test changes | That test |
| A test file becomes a folder with test files, or a folder becomes a test file (D8) | Each test of each new file: git gives `D` for the old paths and `A` for the new paths (or the new files are not tracked) |
| A test file is a link before and after, and the link gets a new target | Each test of the new target: git gives `M`, and the old text is the path of the old target |
| A merge that is not complete, with a test file in conflict (D8, "the status `U`") | git gives `M` or `A`, not `U` (part 12, point 2). Each test whose key is new counts, as for each `M` file |
| A new or changed test has `${…}` in its name, or a variable as its name, or comes from `it.each` with a template table | That test (part 12, point 5) |

### What goes out

`diffArgs`, `diffEnv`, `FILE_HEAD` and `changedLines` of `scripts/lib/breaks.ts`, with their
tests: the two tests of the changed lines and the group "the diff of a PR". The patch command
`git diff HEAD --binary` and `git apply` go out of `scripts/check-breaks.ts`.

The fixed option `-c diff.autoRefreshIndex=true` goes out with them. The owner approved it for
the patch command. With no patch command it has no job: a file whose time changed is in the
file list as `M`, its keys are the same, and no test counts (run in the prototype).

The sentence "Known gap: a test file that git shows as binary …" goes out of `docs/testing.md`
§5, with the same sentence of the code comment.

### What a builder does after a stop (owner's point 3)

No new type of entry. The message says what stopped, why, and what to do.

| Stop | The builder |
| --- | --- |
| The status `T` for a test file: a file became a link, or a link became a file | Keeps the type that the file has in the base. Or gives the changed file a new name: git then lists a deleted file and a new file, and each test of the new file needs a claim (part 12, point 3) |
| Another status that is not `A`, `M` or `D` for a test file | Reports it as a defect of the runner. No probe gave such a status |
| A status that is not `A`, `M`, `T` or `D` at the copy, for each file | Reports it as a defect of the runner. No probe gave such a status |
| A test file that the runner cannot read | Reports it as a defect of the runner |

Revision 4 said that a merge that is not complete gives "another status". The probes of
revision 5 show that this is not so (part 12, point 2).

### Not claimed

- That no git setting changes the file list. The file list is the only source for the files.
  `--no-renames` and `--no-relative` fix the two settings that the probes found.
- That the key holds each way to start or stop a test. It holds the first line of each
  `describe` group. It does not hold these ways:
  - a condition on a later line of a `describe` call;
  - an `if` around a test;
  - a skip that a `beforeEach` makes;
  - the config of the test runner;
  - `describe.only` or `it.only` goes out, and a different test with no change starts to run;
  - a loop around a test gets a new item.

  `main` has the same result for the last two, so they need no fix in this PR (owner, 2026-11-13).
- That a clean filter (such as LFS) gives the same result. The old text is the stored text, and
  the new text is the file on disk. Not run.
- That the copy is correct for a submodule, a sparse checkout, a clean filter (such as LFS) or
  an `export-ignore` attribute. Not run. Or for an `export-subst` attribute: the reviewer of
  round 1 ran it, and `git archive` then changes the text of a file with no local change.
- That the copy has a change that git does not list. Three cases of the probes: a file with the
  bit `assume-unchanged` or `skip-worktree` and a local change is not in the list (today's patch
  is also empty); with `core.fileMode=false`, a change of the execute bit is not in the list.
- That the copy is one moment of the checkout. The runner reads the list and then copies each
  file; a file that changes between the two is in the copy as it is at the copy.
- That no git setting changes the status list of the copy. `--no-renames` and `--no-relative`
  fix the two settings that the probes found; 21 settings cases gave the same copy.
- That the runner finds each test of a file that does not parse (for example a file with the
  marks of a merge conflict). The run with no break of a claim on such a file fails.
- That the runner sees each form of a test. It sees a call of `it` or `test`, also with the
  modifiers `only`, `skip`, `concurrent`, `fails`, `fixme`, `slow` and `each`, with a first
  argument of the table "The name of a test". A test of another form needs no claim, with no
  message. The forms that a probe ran (part 12, point 11):
  - another modifier: `it.skipIf(…)(…)`, `it.runIf(…)(…)`, `it.todo(…)`, `it.sequential(…)`,
    `it.for(…)(…)`, `test.for(…)(…)`, and `test.fail(…)` of Playwright;
  - a test function with another name: `import { it as spec }`, `const spec = it`,
    `bench(…)`, `vi.it(…)`, `globalThis.it(…)`;
  - `it` or `test` that is not written as a plain name: `(it)(…)`, `it["skip"](…)`,
    `it.call(…)`, `(it as T)(…)`, `it!(…)`;
  - `it(title)`, with an expression as its only argument (Vitest reads it as a todo, and it
    runs nothing);
  - a test in a file with another name than `*.test.*` or `*.spec.*` (the name rule above),
    and a test that a function of such a file makes for a test file. The three contract
    suites in `backend/test/contracts/` have 27 such tests.

  The 118 test files of this repository have none of the first four forms (a parse of
  2026-11-14).

## 3. Files to touch

| File | Change |
| --- | --- |
| `scripts/lib/breaks.ts` | Out: part 2, "What goes out". In: the arguments of the file list, a reader of the `-z` text, the keys of the tests of a text, the tests with a new key, one function that gives the tests of the PR and the problems, and one function that gives the problems that stop a run. `testCalls` gets the names of part 2, "The name of a test" |
| `scripts/lib/breaks-copy.ts` (new) | The copy function: `git archive`, the status list against `HEAD`, the new files, and the text of the line "Local changes". It can call git and the disk |
| `scripts/check-breaks.ts` | It calls the copy function. It calls the function for the tests of the PR, prints each problem and exits with 1. The copy step and the loop go out of the top-level code |
| `scripts/lib/breaks.test.ts` | The tests of part 5 for the tests of the PR. Out: the tests of the code that goes out |
| `scripts/lib/breaks-copy.test.ts` (new) | The tests of part 5 for the copy |
| `docs/testing.md` §5 | Step 1: how the runner makes the copy, and the stop for another status. Step 3: the file list, the key, the stops, the `Not claimed` lines; no "Known gap" sentence. Step 6: what the hash of the local changes is |
| `docs/plans/README.md`, `docs/plans/dq-161-runner-file-list.md` | The plan and its row |
| `docs/delivery-quality.md`, `docs/status.md` | DQ-161, DQ-257, DQ-262 and DQ-263; the row of the `-z` defect (DQ-300); the row of the test names (DQ-301); the records of the PR. DQ ids: DQ-264 and DQ-300 to DQ-309 |

No migration, no new dependency, no API change, no screen, no security-sensitive code. The
runner does not run in CI; only `package.json` names it. `scripts/` has no folder index;
`docs/plans/README.md` is the only index that changes. The Guide does not change: it has no
text about the break runner.

## 4. Acceptance criteria

1. For each status of the table "Status of a test file" in part 2, the runner does what the
   table says.
2. For each row of "Which tests count", the runner counts those tests.
3. Each stop names the file and the action.
4. A rename needs a claim for each test of the new file. Three named cases: `cases.ts` to
   `cases.test.ts` with no changed line; the same with 3 changed lines; `parked.test.ts.skip`
   to `parked.test.ts`.
5. The settings `diff.renames`, `diff.renameLimit`, `diff.relative`, `diff.autoRefreshIndex`,
   `diff.orderFile`, a text filter and an external diff tool do not change the result and do
   not change the copy.
6. `docs/testing.md` §5 has the rules and the actions of the builder.
7. The copy is the same as the checkout for each tracked file and each new file that git does
   not ignore: the type, the content and the execute bit. Named cases: a changed file (staged
   and not staged), a deleted file, a mode change, a binary file, a renamed file, a new file
   with a name that git quotes, a file that becomes a link, a local change that gives a file
   the base text again, a file that becomes a folder, a folder that becomes a file (D8), and a
   merge that is not complete (D8). The status `U` stops the copy and names the file (D8).
8. A new or changed test whose name is no plain string needs a claim or an exemption, for
   these forms: a name with `${…}`; a variable or another expression as the name, when a
   later argument can be a function (part 2, "The name of a test"); a spread as the first
   argument; and `it.each` with a template table. The forms of the line "That the runner sees
   each form of a test" in part 2, "Not claimed", are not part of this criterion.

## 5. Test strategy

Written before any code (owner's rule of 2026-11-03). The column "On the old code" is what I
expect from a read of the code and from the prototypes. It is not run yet: the build records
the real message of each red run, and the description of #107 has them. If a test does not do
on the old code what this part expects, the description says so.

### 5.1 The order of the work

1. **Commit 1, the plan:** this file and its row in `docs/plans/README.md`.
2. **Commit 2, the two moves, no change of behaviour.**
   - `testsOfPr({ base, newFiles, git, read })` in `scripts/lib/breaks.ts` gives
     `{ tests, problems }`. It has the loop of today: `changedLines(git(diffArgs(base)))`, then
     the tests on the changed lines. `problems` is empty, because the reader of today throws.
   - `listProblems({ list, only, pr, read })` in `scripts/lib/breaks.ts` gives the problems
     that stop a run: the problems of `--only`, the problems of `pr`, the missing links, and
     (with no `--only`) the missing tests.
   - `makeCopy({ repo, copy, git })` in the new file `scripts/lib/breaks-copy.ts` has the copy
     step of today. It gives `{ local, newFiles }`: the text of the line "Local changes" and
     the new files. `git` is the function that runs a git command in `repo`. The script gives
     one with its environment, and a test gives one with its own environment. The install
     stays in the script.
3. **The proof of the two moves** (owner, 2026-11-13): the runs of 5.7.
4. **The tests of 5.3 to 5.5, each before its code.** I run each new test on the code of commit
   2 and record the result. A test that fails there is a claim, with that message as its red
   run. A test that passes there is a guard, not a claim: the description names it
   (`docs/testing.md` §5). For a guard that holds one part of the new code, I take that part
   out of the new code, run the test, and record that it fails (5.6).
5. **The new code**, in small commits: the file list and the stops; the key; the names; the
   copy; then the old reader and its tests go out.
6. `docs/testing.md` §5, then the records.

No break list for #107: each test is written before its code (part 12, point 1).

### 5.2 The levels

| Level | What it is | Tests |
| --- | --- | --- |
| Git folder | A temporary git repository with its own environment and no user settings (`PATH`, `GIT_CONFIG_GLOBAL=/dev/null`, `GIT_CONFIG_NOSYSTEM=1`), as the test of #107. The test calls `testsOfPr` or `makeCopy` with a real git | 70 (107 with the cases of `it.each`) |
| Unit | `testsOfPr`, `makeCopy`, `listProblems` or `testCalls` with an input of the test. For `testsOfPr` and `makeCopy`, the `git` of the test gives a text that a real git does not give (a status `X` or `U`, a text that is no list) | 11 |
| Read | The sentences of `docs/testing.md` §5 against the code | Criterion 6 |
| Run of the script | `pnpm check:breaks` itself (5.7). The top-level code has no test: it copies the repository and installs it | 4 runs for the moves, 2 at the end |

Why a git folder and not two texts (part 12, point 6): a test of a function that the old code
does not have fails there only with "is not a function". `testsOfPr` and `makeCopy` exist after
commit 2, so each test has a real result on the old code.

### 5.3 The tests of the PR (`scripts/lib/breaks.test.ts`)

Helper: `counted({ before, now })` makes a git folder with the test file `s.test.ts`, commits
`before`, writes `now`, and gives the names of the tests that `testsOfPr` counts. The text
`before` is the file of the prototype: the groups `group`, `parked` (`describe.skip`) and
`second`, with the tests `one`, `two`, `three`, `row %s`, `four` and a second `one`.

**Criterion 2: one test for each row of "Which tests count".** Group: "which tests count".

| # | Test | Expected | On the old code |
| --- | --- | --- | --- |
| 1 | "counts a test with a changed line" | `two` | passes: guard |
| 2 | "counts a test that loses a line" | `two` | passes: guard |
| 3 | "counts a new test" | `five` | passes: guard |
| 4 | "counts a test of it.each that gets a new row" | `row %s` | passes: guard |
| 5 | "counts a test that becomes it.skip" | `three` | passes: guard |
| 6 | "counts a test that gets more spaces before each line" | `one` | passes: guard |
| 7 | "counts no test when a test moves inside its group with the same text" | none | **fails:** it counts `three` |
| 8 | "counts a test that moves out of describe.skip into a group that runs" | `four` | passes: guard |
| 9 | "counts a test that moves into describe.skip" | `three` | passes: guard |
| 10 | "counts a test that moves from one group into another" | `three` | passes: guard |
| 11 | "counts each test of a group when describe.skip becomes describe" | `four` | **fails:** no test |
| 12 | "counts each test of a group that gets a new name" | `one`, `two`, `three`, `row %s` | **fails:** no test |
| 13 | "counts each test of a group when a new describe comes around it, with more spaces" | `one` (of the group `second`) | passes: guard |
| 14 | "counts each test of a group when a new describe comes around it, with the same spaces" | `one` (of the group `second`) | **fails:** no test |
| 15 | "counts only the second of two tests with one name when it changes" | `one`, at the line of the second | passes: guard |
| 16 | "gives each old test to one new test only" (a second copy of a test with the same key comes) | one of the two | passes: guard |
| 17 | "counts no test when a test goes" | none | passes: guard |
| 18 | "counts no test when a helper or a beforeEach body changes" | none | passes: guard |
| 19 | "counts no test when a line changes and changes back" (a commit changes the line; the local change gives the base text again) | none | passes: guard |
| 20 | "reads a describe group of Playwright" (`test.describe.skip` becomes `test.describe`) | each test of the group | **fails:** no test |
| 21 | "counts a changed test of a file with the attribute -diff" | `two` | **fails:** no test (DQ-257) |
| 22 | "counts a changed test of a file with a quote in its name" | `two` | **fails:** the old reader stops at the quoted file line |
| 23 | "counts no test when only the mode of the file changes" | none | passes: guard |
| 24 | "counts no test when only the time of the file changes (diff.autoRefreshIndex=false)" | none | passes: guard |
| 25 | "counts a changed test of a file with line ends of Windows on disk (core.autocrlf=true)" | `two` | passes: guard (the copy of this case is C22) |
| 26 | "counts each test of the new files when a test file becomes a folder" (D8) | each test of `a.test.ts/in.test.ts` | passes: guard |
| 27 | "counts each test of the new file when a folder becomes a test file" (D8) | each test of `d.test.ts` | passes: guard |
| 28 | "counts each test of the new target when a link gets a new target" | the 2 tests of the new target | **fails:** it counts only the test on line 1 |
| 29 | "counts the test with the marks of a conflict in a merge that is not complete" (D8) | the test in conflict | passes: guard |

**Criterion 4: a rename.** Group: "a renamed file".

| # | Test | Expected | On the old code |
| --- | --- | --- | --- |
| 30 | "counts each test when cases.ts becomes cases.test.ts with no changed line" | each test | **fails:** no test (DQ-262) |
| 31 | "counts each test when cases.ts becomes cases.test.ts with 3 changed lines" | each test | **fails:** only the tests on the 3 lines |
| 32 | "counts each test when parked.test.ts.skip becomes parked.test.ts" | each test | **fails:** no test |

**Criterion 1: the status of a test file.** Group: "the status of a test file".

| # | Test | Level | Expected | On the old code |
| --- | --- | --- | --- | --- |
| 33 | "counts each test of a new file" | Git folder | each test | passes: guard |
| 34 | "counts no test of a new empty file" | Git folder | none, no problem | passes: guard |
| 35 | "counts each test of a new file with the attribute -diff" | Git folder | each test | **fails:** no test |
| 36 | "counts a test with %s" for: a staged change; a change that is not staged; the two in one file | Git folder | the changed tests | passes: guard |
| 37 | "counts no test of a deleted file, and does not stop" | Git folder | none, no problem | passes: guard |
| 38 | "counts each test of a new file that git does not track" | Git folder | each test | passes: guard |
| 39 | "applies no rule to a changed picture in a snapshots folder" | Git folder | none, no problem | passes: guard |
| 40 | "applies no rule to a status that it does not know, if the file is no test file" | Unit | none, no problem | **fails:** the old code asks git for a patch, and the `git` of the test has no answer for that command |

**Criteria 1 and 3: the stops.** Group: "the stops".

| # | Test | Level | Expected | On the old code |
| --- | --- | --- | --- | --- |
| 41 | "stops at a test file that became a link, and names the file and the action" | Git folder | one problem: the path, `T`, and the two actions of part 2 | **fails:** no problem |
| 42 | "stops at a link that became a plain test file, with the same action" | Git folder | one problem, as 41 | **fails:** no problem |
| 43 | "stops at a status that it does not know, and names the file" (status `X`) | Unit | one problem: the path, the letter, "a defect of the runner" | **fails:** as 40 |
| 44 | "stops at a new test file that it cannot read" (a new link to a file that is not there) | Git folder | one problem with the path | **fails:** no problem (`continue`) |
| 45 | "stops when it cannot read the old text of a changed test file" | Unit | one problem with the path | **fails:** as 40 |
| 46 | "refuses a file list that is no list of pairs" (2 cases: no end mark; a rename row with two names) | Unit | an error "cannot read the file list" | **fails:** as 40 (another error text) |
| 47 | "names a stop also with --only, and no missing test" (`listProblems`) | Unit | the stop; no "has no claim" line | passes: guard, with a removal run |

**Criterion 5: the settings and the result.** Group: "git settings". One git folder with: a
renamed test file with 3 changed lines, a second renamed file (so that `diff.renameLimit=1`
has an effect), a changed test file, a new test file `né.test.ts`, a deleted test file.

| # | Test | Expected | On the old code |
| --- | --- | --- | --- |
| 48 | "counts the same tests with %s" for 13 cases: no setting; `diff.renames=copies`; `diff.renames=false`; `diff.renameLimit=1`; `diff.autoRefreshIndex=false`; `diff.orderFile`; a text filter; `diff.external` with `GIT_EXTERNAL_DIFF`; `diff.noprefix`; `diff.mnemonicPrefix`; `color.ui=always`; `core.quotePath=true`; `diff.relative=true` | one fixed result: each test of the two renamed files, the changed test, each test of the new file | **fails for each case:** the old rule counts a renamed file by its changed lines. So these red runs do not show the effect of one setting. The removal runs of 5.6 show what the two fixed options hold |
| 49 | "counts the files of the whole repository when git starts in a subfolder with diff.relative=true" | the tests of `root.test.ts` and `sub/in.test.ts` | **fails:** no test (the old reader gets only `in.test.ts`, with no folder) |

**Criterion 8: the name of a test.** Group: "the name of a test".

| # | Test | Level | Expected | On the old code |
| --- | --- | --- | --- | --- |
| 50 | "finds a test with ${…} in its name, with %s in the place of each" (`testCalls`) | Unit | the name `opens %s directly and after a reload`, with its lines | **fails:** no test call |
| 51 | "finds a test with a variable as its name, by the text of the argument" (`testCalls`) | Unit | the name `row.name` | **fails:** no test call |
| 52 | "finds a test of it.each with a template table" (`testCalls`) | Unit | the test call | **fails:** no test call |
| 53 | "reads a call with no function after its first argument as no test" (`test.skip(condition, "reason")` inside a test) | Unit | only the test around it | passes: guard, with a removal run |
| 54 | "needs a claim or an exemption for a new test with ${…} in its name" (`testsOfPr`, then `coverageProblems`: no entry, a claim with a reported name, an `exempt` entry with the `%s` name) | Git folder | "has no claim"; no problem; no problem | **fails:** no problem for the list with no entry |

54 tests here: 9 unit, 45 in a git folder (59 with the cases of `it.each`).

### 5.4 The copy (`scripts/lib/breaks-copy.test.ts`)

Helper: `differences(repo, copy)` gives each path where the copy is not the same as the
checkout: the type (file or link), the content, the execute bit. The paths are each file that
git tracks, each new file that git does not ignore, and each file of the copy. A test expects
an empty list.

**Criterion 7: the named cases.** Group: "the copy is the same as the checkout".

| # | Test | On the old code |
| --- | --- | --- |
| C1 | "with no local change" (and the line "Local changes" is `none`) | passes: guard |
| C2 | "with a changed file that is not staged" | passes: guard |
| C3 | "with a changed file that is staged" | passes: guard |
| C4 | "with a deleted file" | passes: guard, with a removal run |
| C5 | "with a file that only has a new mode" | passes: guard, with a removal run |
| C6 | "with a changed binary file" | passes: guard |
| C7 | "with a renamed file" | passes: guard |
| C8 | "with a new file that git does not track, in a new folder" | passes: guard |
| C9 | "with a new file that has a name that git quotes (né.test.ts), and lists it as a new file" | **fails:** `ENOENT … lstat '"n\303\251.test.ts"'` (the `-z` defect, DQ-300) |
| C10 | "with a file that becomes a link" | passes: guard, with a removal run |
| C11 | "with a link that becomes a file" | passes: guard |
| C12 | "with a local change that gives a file the base text again" | passes: guard, with a removal run |
| C13 | "with a file that becomes a folder" (2 cases: staged, not staged) (D8) | passes: guard |
| C14 | "with a folder that becomes a file" (2 cases: staged, not staged) (D8) | expected: passes. Guard, with a removal run |
| C15 | "in a merge that is not complete" (D8) | passes: guard |
| C16 | "with a new folder that is a git repository of its own: it is not copied" | passes: guard |

**Criteria 3 and 7: the stops of the copy.** Group: "the stops of the copy".

| # | Test | Level | On the old code |
| --- | --- | --- | --- |
| C17 | "stops at the status U, names the file, and makes no copy" (D8) | Unit: the `git` of the test gives `U` for the list command | **fails:** no error (the old copy does not read the list) |
| C18 | "stops at a listed path that is no plain file and no link" | Unit: the `git` of the test lists a folder | **fails:** no error |

**Criterion 5: the settings and the copy.** Group: "git settings and the copy". The folder has a
local change of each type (C2 to C8).

| # | Test | On the old code |
| --- | --- | --- |
| C19 | **"has a local change when an external diff tool is set"** (owner, D5): `diff.external=true` and `GIT_EXTERNAL_DIFF=true`; a committed test file with `old`, a local change `new` | **fails:** `expected 'old\n' to be 'new\n'` (run in the prototype) |
| C20 | "is the same as the checkout with %s" for the 21 settings cases of `results.md`, and `diff.orderFile` (22 cases) | **fails for 10 cases** (measured for the copy of today): the 3 cases with an external diff tool are wrong; `diff.noprefix`, `color.diff`, `color.ui`, the text filter, `diff.context=0`, `GIT_DIFF_OPTS=--unified=0` and `diff.srcPrefix` stop. The other 12 cases pass: guards |
| C21 | "is the same as the checkout with diff.orderFile when a file becomes a folder" | expected: passes. Guard, with a removal run |
| C22 | "is the same as the checkout with line ends of Windows on disk (core.autocrlf=true)" | **fails:** `git apply` stops (`patch failed`) |

**The line "Local changes".** Group: "the hash of the local changes".

| # | Test | On the old code |
| --- | --- | --- |
| C23 | "gives a new hash when the content of a file changes, and the same hash for the same state" | passes: guard |
| C24 | "gives a new hash when only the execute bit changes" | passes: guard, with a removal run |
| C25 | "gives the same hash with diff.orderFile" | **fails:** the patch has another order |
| C26 | "does not say none for a local change when an external diff tool is set" | **fails:** `none` |
| C27 | "counts the new files in the line" | passes: guard |

27 tests here: 2 unit, 25 in a git folder (48 with the cases of `it.each`).

### 5.5 Which tests have no real red run, and why

- **Guards, 48 tests** (each row above with "passes"). The old code gives the right answer
  for these cases, so no run on the old code can fail. They hold that the redesign keeps that
  answer. 19 of them hold one part of the new code and have a removal run (5.6). The other 29
  have no failing run at all: 3, 13, 15, 17, 18, 19, 23, 24, 26, 27, 29, 33, 34,
  36, 37, 38, 39, C1, C2, C3, C6, C7, C8, C11, C13, C15, C16, C23, C27.
- **The other 33 tests fail on the old code.** They are the claims.
- **Unit tests with the `git` of the test, 4 of those 33** (40, 43, 45, 46). They fail on the old
  code, but only because the old code asks for a patch and not for a list. The red run shows
  that the old code does not have the rule. It does not show more.
- **The 13 cases of test 48.** They fail on the old code for one reason, the rename rule, not
  for the reason of each setting.

### 5.6 Removal runs (for a guard that holds one part of the new code)

I take the part out of the final code, run the named tests, record that they fail, and put the
part back. The description has the table. A test of this table that does not fail is a
finding: I report it.

| Out of the new code | The tests that must fail |
| --- | --- |
| `--no-renames` | 30, 31, 32, 48 |
| `--no-relative` | 49 |
| The text of the test in the key | 1, 2, 4, 5, 6 |
| The first line of each `describe` group in the key | 8, 9, 10, 11, 12, 14, 20 |
| "Each old test stands for one new test only" | 16 |
| "A line end of Windows is no change" | 25 |
| The stops with `--only` | 47 |
| "A later argument is a function" in the name rule | 53, and the 6 cases of "reads a call whose later arguments are plain values as no test" (round 3) |
| A plain value is no function (round 3) | 53, and 5 of those 6 cases: each case with a later argument (`it.each(rows)` has none) |
| A claim stands only for the test that has its assertion (round 1) | "does not take a claim for a row of it.each as a claim for a plain name with %s"; "takes a claim only for the test that has its assertion, of two tests with one name" |
| No claim names a test whose name is an expression (round 1) | "does not take a claim for a plain name as a claim for a variable with the same text" |
| `-z` of the list of new files | C9 |
| The `D` files of the copy | C4 |
| The execute bit of the copy | C5 |
| The link of the copy | C10 |
| The list of the copy against `HEAD` (use the base) | C12 |
| The `D` files first, and the folder that goes (use the order of the list) | C14 (staged), C21 |
| The type in the hash | C24 |
| The fixed order in the hash | C25 |

### 5.7 The runs of the script (the proof of the two moves, and the end)

The list: `scripts/breaks/pr-96.json`. The same two local changes for each run: one changed
line in the first test of `scripts/lib/process-group.test.ts`, and one new test file
`scripts/lib/zz-proof.test.ts` that git does not track. A script makes them with exact edits
and undoes them; `git status -sb` is clean after the runs.

| Run | Command | When | The result that I record |
| --- | --- | --- | --- |
| A | `pnpm check:breaks scripts/breaks/pr-96.json` | Before commit 2 and after it | The output is the same, byte for byte |
| B | `pnpm check:breaks scripts/breaks/pr-96.json --only D1` | Before commit 2 and after it | The output is the same but for the line "Commit": the same hash of the local changes, and the same result of D1-a |
| A and B | the same | On the final code, one time each | The output of the new rule. I compare the tests that run A names with a read of the changed test files |

The two runs before commit 2 are done (2026-11-13, on `1eb3e5c`):

- Run A: exit 1, 15 lines "has no claim": 13 tests of `scripts/lib/breaks.test.ts`, the changed
  test of `process-group.test.ts`, and the test of `zz-proof.test.ts`.
- Run B: exit 0, `Local changes: sha256 429c04985df09116 (1 new files)`, "D1-a: caught",
  "0 problem(s)".

### 5.8 Order and time cases

- **The order of the list.** The copy and the hash give the same result for each order: C14,
  C21, C25.
- **A staged change, a change that is not staged, and the two in one file:** 36, C2, C3.
- **A value that changes and changes back:** 19 and C12. A commit changes a file, and a local
  change gives it the base text again: no test counts, and the copy has the base text.
- **A file that was new and that goes away before the run** is not in the file list. This is
  the state of C1.
- **The files change during a run.** The copy has each file as it is at the moment of its
  copy, and the tests of the PR come from the copy. No test changes a file during a run
  (revision 4, approved). This stays a `Not claimed` line.
- The runner is one process, and it makes no request. So no test here is an order or race
  test of `docs/testing.md` §5.

### 5.9 Not tested

- The top-level code of `scripts/check-breaks.ts`, but for the runs of 5.7.
- A submodule, a sparse checkout, a clean filter, `export-ignore`, `assume-unchanged`,
  `skip-worktree`, `core.fileMode=false`: `Not claimed` lines of part 2.
- Criterion 6 is a read of `docs/testing.md` §5 against the code.

## 6. Risk probes (git 2.53.0, temporary folders with no user settings)

**Probes of revision 4 (2026-11-13):**

| Probe | Result |
| --- | --- |
| `git diff --name-status -z --no-renames` for each type of change | Changed `M`; deleted `D`; each rename `D` and `A`; a file with `-diff` `M` or `A`; a mode change `M`; a file to a link `T`; a name with a quote: the plain name |
| The same with `diff.renames=copies` and `diff.renameLimit=1` | The same list |
| `diff.relative=true`, started in `sub/` | Only `in.test.ts`. With `--no-relative`: `root.test.ts` and `sub/in.test.ts` |
| A touched file with `diff.autoRefreshIndex=false` | In the list as `M`. The prototype counts no test |
| `git cat-file blob <base>:<path>` with a text filter set | The stored text |
| `git diff --name-status` with `GIT_EXTERNAL_DIFF` and `diff.external` | The same list |
| 24 changes of one test file through the prototype | The table "Which tests count" |

Not probed: the full runner in a subfolder. `git archive HEAD` there packs only the subfolder,
so I expect that the runner fails for another reason. So `--no-relative` is a guard.

**Probes of the draft of revision 5 (2026-11-13; `results.md` of the prototypes has each case):**

| Probe | Result |
| --- | --- |
| The copy in 21 settings cases, with local changes of each type | Today: 11 equal, 3 wrong with no error (an external diff tool), 7 stop. Way 1: 21 equal. Way 2: 21 equal |
| `git diff --name-status -z --no-renames --no-relative HEAD` for each type of local change | Changed `M` (staged or not); deleted `D`; a rename `D` and `A`; a binary file `M`; a mode change `M`; a staged new file `A`; a file to a link `T` |
| The same with `diff.external`, `GIT_EXTERNAL_DIFF`, a text filter, `diff.noprefix`, colours | The same copy |
| `core.autocrlf=true`, one changed file and one file with no change | Way 2: 2 of 2. Way 1 and today: `git apply` stops |
| Way 1 with one option out, 21 cases again | Each option but `--no-relative` has a case that fails; `--no-ext-diff` out is wrong with no error |
| The status list against the base, for a local change that gives the base text again | 0 of 1, no error |
| `git ls-files --others` with no `-z`, a new file `né.test.ts` | Today the runner stops: `ENOENT … lstat '"n\303\251.test.ts"'` |

**Probes of revision 5 (2026-11-13, the leader of #107; the same list command):**

| Probe | Result |
| --- | --- |
| A tracked file becomes a folder with one file | Not staged: `D a.test.ts`, and `a.test.ts/in.test.ts` is a new file that git does not track. Staged or committed: `D a.test.ts`, then `A a.test.ts/in.test.ts` |
| A tracked folder becomes a file | Not staged: `D d.test.ts/in.test.ts`, and `d.test.ts` is a new file. Staged: `A d.test.ts`, then `D d.test.ts/in.test.ts`: the new file is before the deleted file |
| A merge that is not complete, four types of conflict | Against a commit, git gives no `U`. It gives the state of the disk: `M` (the two sides change a file; the two sides add a file), `A` (this side deleted the file, the other side changed it), or no row. Only `git diff` with no commit gives `U`. `git archive HEAD` works |
| A link that gets a new target | `M`. `git cat-file blob` gives the path of the old target |
| A file becomes a link; a link becomes a file | `T` for the two |
| `diff.orderFile` | It changes the order of the list |
| A file with `assume-unchanged` or `skip-worktree`, and a local change | Not in the list. The patch of today has 0 bytes |
| `core.fileMode=false`, and a change of the execute bit | Not in the list |
| `git add -N` (intent to add) | `A` |
| `git cat-file blob HEAD:<path>` for names with a quote, `é`, a space, and a folder `:d` | The stored text, each time |
| A new folder that is a git repository of its own | `git ls-files` gives `inner/`; it is no plain file, so it is not copied, as today |
| Test names in this repository that `testCalls` does not see | 2 tests have a name with `${…}`: `backend/src/adapters/http/uploads/skill-zip.test.ts:102` and `frontend/test/e2e/shell.spec.ts:73`. No test uses `it.each` with a template table. No test has a variable as its name (a search for a call at the start of a line) |

The prototypes and the runs are in `tmp/plans/dq-161-prototypes/` (revision 4), in its folder
`rev5/` (the draft), and in `tmp/worktrees/runner/scratch/rev5b/` (revision 5). They are not the
code of the PR, and they had no review.

## 7. Risks

- **A rename costs more.** A PR with a break list that renames a test file needs a claim or an
  `exempt` entry for each test of the file. The same applies to a new name of a group. The
  owner accepted these costs.
- **The key misses a way to start a test** (part 2, "Not claimed"). A reviewer can still ask
  for a break of a claim that they doubt.
- **Old break lists.** The lists in `scripts/breaks/` belong to merged PRs. Nothing runs them
  again, so the new rule does not change their result.
- **The copy takes file by file.** A file that the runner cannot read stops the run with the
  error of Node.
- **The hash of the line "Local changes" changes its input.** A report of before this PR and a
  report of after it do not have the same hash for the same state.
- **The redesign is new work in a PR that had two review rounds.** Its commits get their own
  review rounds (owner, D11; rule words W1 and W4.2, which #112 commits).

Not in this PR: DQ-169; the command cell of DQ-179; a new type of `exempt` entry; DQ-176.

## 8. The numbers that the owner compared

**Revision 2.** Option 1 kept the patch reader of #107 and compared it with the file list. The
numbers are from two prototypes with no tests and no review. A line is a line that is not blank.

| | Option 1 | Option 2, before the condition | Option 2, with the key of part 2 |
| --- | --- | --- | --- |
| Code: adds, removes | 76, 15 | 80, 95 | 111, 95 |
| Tests: adds (an estimate) | 24, about 290 lines | 26, about 310 lines | 38, about 400 lines |
| Tests: removes | none | 146 lines | 146 lines |
| Fixed git options | 13 | 2 | 2 |
| Line forms of a patch that the code must know | 15 | none | none |

**Revision 5: two ways for the copy** (prototypes with no review; `results.md` has each case).
Way 1 kept the patch, with fixed options: `git diff --binary --no-color --no-ext-diff
--no-textconv --src-prefix=a/ --dst-prefix=b/ --unified=3 --no-relative HEAD`, with no
`GIT_DIFF_OPTS` in the environment, then `git apply`. Way 2 is the copy of part 2.

| | Today | Way 1 | Way 2 |
| --- | --- | --- | --- |
| The copy equals the checkout, in 21 settings cases | 11; 3 wrong with no error; 7 stop | 21 | 21 |
| Line ends of Windows on disk (`core.autocrlf=true`), one changed line | stops | stops (`git apply`) | equal |
| Binary file, mode only, deleted, rename, new file | each correct | each correct | each correct |
| Fixed git options for the copy | none | 8, and 1 variable out of the environment | 2, the two of the file list |
| A program reads patch text | yes | yes (`git apply`) | no |
| Code in `scripts/check-breaks.ts`: adds, removes (estimate) | | 9, 3 | 30, 10 |
| Code in the library: adds (estimate) | | 24 | none more than the reader |
| Time of the copy step, 3 runs, 945 files | 749, 829, 470 ms | 620, 574, 524 ms | 506, 576, 495 ms |

Why way 2: it removes the cause of DQ-161 from the copy too. No program reads a text that git
makes for people. Way 1 keeps a list of options, and each new git setting can be a new way to
break it. With `core.autocrlf=true`, `git apply` stops, and fixed options do not solve that.

## 9. The owner's decisions (2026-11-13)

**On revision 1:**

- Approved: a deleted file passes. Approved: `--no-relative`. Approved: the stops apply also
  with `--only`. Approved: the stop for another status and for a file that the runner cannot
  read; the plan says for each stop which files get it, and it uses the name rule of
  `check-breaks.ts`, not `isTestFile`.
- Approved for option 1, and out of the design now: `-c diff.autoRefreshIndex=true`, the stop
  for a file that only the patch reader has, and the table row for a binary file that is not a
  test file by name (part 2 has the name rule and a test for the picture).
- The rule of two sources is not a full guard. `Not claimed` lines: part 2.
- Option 2 must be a real option with numbers. "Two rounds reviewed the code" is not a cost.

**On revision 2: option 2, with one condition.** The exact words:

> Option 2, with one condition.
> Condition: the key of a test is its name, its text, and the first line of each describe
> group around it. Reason, from a run of the two prototypes with five more changes: a test
> that moves out of a describe.skip group into a group that runs starts to run in this PR.
> Option 1 and main count it. Option 2 as it is counts no test.
> The condition also closes "describe.skip becomes describe", so that case comes into this
> PR and needs no separate ledger row. Its cost: a new name for a group makes each test of
> the group count. I accept that cost.
> Approved change of meaning: a test that moves inside its group, with the same text, does
> not count.
> Add to the plan and its tests: the two moves between groups, describe.skip to describe, a
> new name for a group, and a new describe around a group.
> The code reads the old text with git cat-file blob, as the plan says. The prototype uses
> git show.

**On revision 3: approved, with two additions.** The exact words:

> Revision 3: approved, with two additions.
> Points 1 to 4 of part 10: approved.
> Addition 1, the second "Not claimed" line: add two ways that the key does not hold.
> - describe.only or it.only goes out, and a different test with no change starts to run.
> - A loop around a test gets a new item.
> main has the same result for the two, so they need no fix in this PR.
> Addition 2, part 5: say what proves "no change of behaviour" for the first commit. Run
> pnpm check:breaks with the same list before and after that commit, and record that the
> output is the same.

**On the copy (D5).** The exact words:

> D5: A. The redesign PR takes line 72, and the plan gets a revision 5.
> - The second opinion ran the case: with diff.external=true, git diff HEAD --binary prints
>   0 bytes and exits with 0. The file list still names the file as M. With the redesign,
>   the old text and the new text are then the same, so no test counts and no error shows.
>   So this cannot wait for the cleanup PR.
> - Revision 5 gives two ways for the copy, with numbers from a prototype of each (my rule
>   of today): 1. fixed options on the patch; 2. no patch: the copy takes each new and
>   changed file of the file list from the disk, and removes each deleted file. Way 2 uses
>   the reader that the redesign adds, and the runner then reads no patch text.
> - One test with diff.external holds the copy.

**On the four points of revision 5 (D8).** The exact words:

> Other questions have agree answers, so follow the answers

The answer that these words point to is the row D8 of the arena synthesis of 2026-11-13 (a
local file of the owner's machine, `tmp/owner/arena-2026-11-13/synthesis.md`, line 63). That
row says:

> **Yes ×4.** Add two cases that were not measured (a file that becomes a folder or the reverse;
> the status `U`) as named cases of the plan. The `-z` fix gets a ledger row from the range of
> the redesign

The four points are in part 11.

**On where the redesign is built (D11).** The exact words, from two messages:

> No more addition PR please. I don't want to make another PR just to fix an issue found in
> current PR. Fix that in the same PR that where the issue is found.

> D11: No more addtional PR, if reviewer found issues in #107, you will work with agent leader
> of 107

So the redesign is built in #107. This replaces the answer to question 6 of #107 (the redesign
as its own PR) and the first sentences of revision 4.

## 10. The four points of revision 3 (all approved)

1. `-c diff.autoRefreshIndex=true` goes out, because the patch command goes out (part 2).
2. What a `describe` group is, and that the key has the line as written, with its spaces (part 2).
3. The three `Not claimed` lines of part 2.
4. The order of the work in part 5: first a commit with no change of behaviour, so that each
   new test has a real red run.

## 11. The four points of revision 5 (each has the answer "yes", D8)

1. **Way 2** for the copy: no patch.
2. **The status list for the copy is against `HEAD`**, a second call of the reader. The list
   against the base loses one case.
3. **The copy function is in the new file `scripts/lib/breaks-copy.ts`** with its test file, so
   that `breaks.ts` stays with no file call and no process call.
4. **`git ls-files -z` comes into this redesign.** The defect gets a ledger row from the range
   of the redesign.

D8 also adds two named cases: a file that becomes a folder or the reverse, and the status `U`.
They are in "Which tests count", in criterion 7, and in the probes of part 6.

## 12. The points of revision 5 that no owner decision answers

No decision of the owner (D5, D8, revision 4) answers these points. Each has the view of the
builder and the answer of the orchestrator (2026-11-13, under the owner's order 27). The owner
did not see them. Points 2, 3, 5 and 9 have one line each under `Needs human review` in the
description of #107.

1. **The list for the proof of the two moves, and a break list for #107.**
   - The proof uses `scripts/breaks/pr-96.json`: 9 claims, each a Vitest test, no `exempt`
     entry, so the run needs no e2e server. It is the list that the description of #107 used
     for its runs of the script.
   - Run A: `pnpm check:breaks scripts/breaks/pr-96.json` (no `--only`). I expect that it stops
     at the check for a missing test and exits with 1, because that list has no claim for the
     tests of #107. Its output names each test of the PR with its file and line: that is the
     result of the moved loop. No claim runs.
   - Run B: `pnpm check:breaks scripts/breaks/pr-96.json --only D1`. One claim runs to its end,
     and the report has the line "Local changes".
   - The two runs have the same local changes each time, so that the patch step and the step
     of the new files run: one changed line in a tracked test file, and one new test file that
     git does not track. I remove them after the runs.
   - The two moves are one commit. Run A and run B before it, and again after it. The output
     must be the same, but for the line "Commit". Four runs.
   - My view: #107 needs no break list of its own. `docs/testing.md` §5 asks for a list only
     for tests added after their code, security tests, and order and race tests. Each test of
     the redesign is written before its code, with its red run. The runner is one process
     with no requests, so no test is an order or race test.
   - **Answer: approved,** with the two moves in one commit and four runs. No break list for
     #107 (the owner's rule of 2026-11-09 limits break lists to late, security and order or
     race tests).
2. **The status `U` (D8).** The probes show that the list command of this plan gives no `U` in
   a merge that is not complete: it compares a commit with the disk. So the sentence of
   revision 4 "a merge is not complete" was wrong for the stop of another status. Options:
   - A (my view): no new check. The copy is the same as the checkout in that state (a test in
     a git folder holds it). A unit test holds the stop for the letter `U`, if git gives it.
     The plan and `docs/testing.md` say what git gives.
   - B: a new check with `git ls-files -u`, and a stop "a merge is not complete". It is a new
     detector that no decision asks for.
   - **Answer: A.** The owner said on 2026-11-09: no new detectors for the runner. The test of
     a merge that is not complete and the unit test for the letter `U` are the two named cases
     of D8.
3. **A link that becomes a plain test file also has the status `T`** (probe). The approved
   table stops there, and its action ("make the test file a plain file again") does not help:
   the file is a plain file. Options:
   - A (my view): for `T`, the runner looks at the copy. A plain file there is a new file: each
     test needs a claim. A link there stops, as approved.
   - B: the stop stays for the two directions, and the action text is true for each.
   - **Answer: B.** The owner approved the stop for `T` in revision 4, and no test file of
     this repository is a link. The action of part 2 is new: the builder keeps the type of the
     base, or gives the changed file a new name.
4. **The input of the hash of "Local changes".** The draft said: the status, the name and the
   content. I add the type (file, file with the execute bit, link) and a fixed order (by path),
   so that a mode change gives a new hash and `diff.orderFile` does not. My view: add them.
   **Answer: yes.**
5. **Test calls that the runner does not see** (a new finding of this plan; no ledger row).
   `testCalls` keeps only a call whose name is a plain string. A test with `${…}` in its name
   (2 in this repository), with a variable as its name, or from `it.each` with a template table
   needs no claim, with no message. The code is of #86, not of #107. Options:
   - A (my view): in this redesign, with one ledger row (DQ-301) and tests first. The name of a
     test is its first argument as written. Each `${…}` of a template stands for any text, as
     `%s` does. A name that is no string matches no claim, so such a test needs an `exempt`
     entry or a plain name. `it.each` with a template table is a test call. About 15 lines in
     `testCalls` and `nameMatches`, and 4 unit tests.
   - B: not in #107. A `Not claimed` line in `docs/testing.md` §5 and a ledger row. Its end
     needs the owner's words.
   - **Answer: A,** in this redesign, with the row DQ-301 and tests first. Reason: the owner's
     order is to fix an issue in the PR where it is found, and it is the same type of defect
     as the PR repairs (the runner checks less than it says). Part 2, "The name of a test", has
     the rule. If the fix needs more than about 40 lines or a change of the claim format, the
     builder stops and asks.
6. **The level of the tests of criterion 2.** Revision 4 has "unit, with two texts". Such a
   test calls a function that the old code does not have, so its red run is only "not a
   function". My view: each row of "Which tests count" runs through the moved function in a
   git folder, so that it has a real result on the old code. **Answer: yes.**
7. **The link to the plan.** `docs/plans/README.md` rule 3 says that the first comment of the
   PR links to the plan file. My view: the link goes into the description of #107. **Answer:**
   one PR comment with the link, after the push of the plan file, and the link also in the
   description.
8. **DQ-176** (open, a row of #86) names three functions of `scripts/lib/breaks.ts` with two
   positional strings. It is not a row of #107, and I do not change those three functions. Each
   new function of the redesign takes an object where it has two arguments of one type. **Answer:**
   not a row of #107; its home is the style PR for `max-params`.

9. **Modifiers and names of a test function that the reader does not see** (found with point
   5): `it.skipIf(…)`, `it.runIf(…)`, `test.for(…)`, and a test function with another name.
   No test of this repository has such a form. **Answer:** not fixed in #107; the 40 lines of
   point 5 stay the limit. The `Not claimed` line of part 2 and of `docs/testing.md` §5 names
   them, with one line under `Needs human review`.

10. **A fix of review round 1 (Codex on `dc8a1d5`, 2026-11-14): what a claim covers.** The
    reviewer found that `it(title, …)` and `it("title", …)` get one name, so one claim covered
    the two (P2; row DQ-303). The cause is older than this plan: the check for a missing test
    took a claim by the name only. Two paths of #86 have it too: two tests with one name in two
    groups, and the `%s` of an `it.each` name, which matches the name of another test. Options:
    - A (the builder's view): a claim covers a test call only if the name matches and the
      assertion text of the claim is inside that call. The runner has that line already, for
      the check "the assertion is not inside the named test". The claim format does not change.
    - B: only a rule that no claim names an expression, and a `Not claimed` line for the two
      older paths.
    - **Answer: A.** R1 is a P2 and cannot stay open; the rule exists in the runner already, so
      it is no new detector. About 55 added lines for the test names in total is approved.
    - An `exempt` entry has a name and no assertion. One entry stands for each test of its
      file with that name. That stays, with a `Not claimed` line in `docs/testing.md` §5.
    - Round 1 also found that six new helpers took two arguments of one type, against point 8
      (P3; row DQ-304). Each takes one object now.
    - Round 2 (Codex on `7118ecc`) found that the fix compared lines: two test calls on one
      line still had one claim (P2; row DQ-305). Now the test that has the assertion is the
      innermost test call around the exact place of the assertion, by line and column.

11. **A fix of review round 3 (Codex on `959a4bd`, 2026-11-14): which calls the reader sees.**
    The reviewer found that `it(title, check)` was no test call: the code of point 5 took an
    expression as a name only when a later argument was a function that is written in the
    call (P3; row DQ-306). The test needed no claim and no exemption, with no message. That is
    the cause of DQ-301. `main` has the path too: its reader takes only a plain string as a
    name. The fix of DQ-301 did not close it, because its guard took only a function that is
    written in the call.
    - The fix turns the guard around. A call with an expression as its name is a test call
      unless no later argument can be a function. A string, a template, a number, an object
      and an array as written are no function. A spread as the first argument is a test call
      too. So a form that the reader cannot read for sure gives a message that asks for an
      `exempt` entry, not a silent pass. About 10 code lines.
    - The numbers (a parse of the 118 test files, 2026-11-14; the scripts and their outputs
      are in the description of #107): on `959a4bd`, 1557 calls of `it` or `test` with the
      modifiers; 117 have a first argument that is no string and no template; each of the
      117 is `it.each(rows)` with one argument. So the fix changes no result in this
      repository: 0 tests of the missed form, and 0 calls such as
      `test.skip(condition, reason)`.
    - The tests, each written before the fix: "finds a test with a variable as its name and
      no inline function" (6 cases), "finds a test whose arguments are a spread, by the text
      of the argument", and "needs an exemption for a new test with a variable as its name
      and no inline function" (in a git folder) fail on `959a4bd`. "reads a call whose later
      arguments are plain values as no test" (6 cases) is a guard, with a removal run (5.6).
    - **The orchestrator's answer (2026-11-14):** fix it in #107, and close the area by a
      list: part 2 and `docs/testing.md` §5 name each form that the reader sees and what it
      gives, and each form that it does not see is a `Not claimed` line. Criterion 8 names
      the forms that the tests prove.
    - "Same cause as an earlier fix?" Yes (DQ-301). No owner decision answers it: one line
      under `Needs human review`, with two options for the owner. A: the turned guard is
      enough, because a form that the reader cannot read for sure now gives a message. B: a
      redesign in which the runner asks the test runner for the tests of a file
      (`vitest list`, `playwright test --list`) and has no reader of its own.

## 13. The end of each open row and each correction that waits

The ends: (a) fix here; (c) part of the redesign, built in #107; (d) needs the owner's words.

| Row or correction | State now | End | What closes it |
| --- | --- | --- | --- |
| DQ-161 | `partial` | (c) | Criteria 1 to 5: the runner reads no patch text. `fixed` |
| DQ-257 (a binary test file) | `open` | (c) | Criterion 2, the row "The file has `-diff`". `fixed` |
| DQ-262 (renames) | `open` | (c) | Criterion 4, and `diff.renameLimit` of criterion 5. `fixed` |
| DQ-263 (the patch of the copy) | `open` | (c) | Criteria 5 and 7; the test with `diff.external`. `fixed` |
| The `-z` defect (no row) | none | (c) | A new row DQ-300, `fixed`: criterion 7, "a new file with a name that git quotes" |
| The mark on DQ-258 | `fixed`, with a wrong mark | (a) | Remove "Round 2 correction:" from its fix cell (decision O2); the row keeps 600 bytes or less |
| DQ-251 | `fixed` | none | Its cell has "read, not run" already |
| The sentence "Known gap …" of `docs/testing.md` §5 and of the code comment | in the text | (c) | It goes out with `changedLines` |
| The description of #107: "Follow-ups: the redesign … in its own PR", the `Not claimed` line for a rename, the lines for DQ-257 and DQ-263 under `Needs human review` | stale after the redesign | (a) | The new description (after the build) |
| Test calls that the runner does not see (part 12, point 5) | no row | (c) | A new row DQ-301, `fixed`: criterion 8. One line under `Needs human review`: a design choice that the owner did not see |
| The status `U` sentence of revision 4 (part 12, point 2) | corrected in this text | (a) | One line under `Needs human review`: D8 named the status `U`, and the probe shows that this list command does not give it |
| A link that becomes a file stops with an action that does not help (part 12, point 3) | in the approved table | (a) | The stop stays; the action text of part 2 is true for each direction. One line under `Needs human review`, with option A as the other choice |
| The owner's approval of revision 5 and of the test strategy | waits | (d) | One line under `Needs human review`; the report says "ready except the owner's approval" |
| The merge order #109, #112, then #107 (D11, W1, W3) | waits | (d) | One line under `Needs human review` |
| Modifiers that the reader does not see (part 12, point 9) | no row | (d) | A `Not claimed` line in `docs/testing.md` §5, and one line under `Needs human review` |
| A test whose function is no inline function (part 12, point 11; round 3) | no row | (a) | A new row DQ-306, `fixed`. The repeat of the cause of DQ-301: one line under `Needs human review` |
| DQ-176 | `open`, a row of #86 | not a row of #107 | Its home is the style PR for `max-params` (part 12, point 8) |

Free ids after this table: DQ-264 and DQ-307 to DQ-309 (the review rounds used DQ-302 to DQ-306).
