# The break runner keeps the local changes when TMPDIR is inside a git repository (DQ-618)

Brief: the owner's answer of 2026-11-18, "Q1: A": "Fix it now in a small PR: the runner runs
`git apply` so that git cannot use an outer repository, and it fails if a local edit did not
reach the copy. One test: TMPDIR inside a temporary git repo, a tracked edit, the edit must reach
the copy. When #107 merges, its new copy code replaces this."
Checkpoint: none (a fix inside the copy step of one script; no UI, no migration, no public API)
Approval: plan OK by the chief agent, 2026-11-18, against the owner's answer q3 Q1 A (revision 1); owner review pending

## The cause

`pnpm check:breaks` makes its copy in `$TMPDIR` with `git archive HEAD | tar -x` (no `.git`), and
then runs `git apply` of `git diff HEAD --binary` with the copy as its working folder
(`scripts/check-breaks.ts`, the copy step). Git looks for a repository from that folder upwards.
When `$TMPDIR` is inside a git repository, git finds that outer repository. It then reads the
paths of the patch from the root of the outer repository, so they are outside the copy, and
`git apply` skips them with exit 0. The hash in "Local changes: sha256 …" comes from the patch in
the real checkout, before the apply, so the report names changes that the copy does not have.
The run then tests HEAD. Since the first version of the runner (73fd4aa, 2026-11-09). Found by
#128 (`tmp/worktrees/ci-break-static/proof/full-b.log`: a removed exemption gave `0 problem(s)`
with TMPDIR inside the main checkout, and the refusal with TMPDIR outside it).

## Probe (git 2.53.0, this laptop, 2026-11-18)

A source repository with three tracked changes (a changed line, a deleted file, a new executable
bit), its `git archive` in `outer/tmp-*/copy`, where `outer` is a git repository:

| `git apply` in the copy | Exit | Changed line | Deleted file | Executable bit |
| --- | --- | --- | --- | --- |
| plain (the runner of `main`) | 0 | not applied | still there | not applied |
| `GIT_CEILING_DIRECTORIES=<parent of the copy>` | 0 | applied | removed | applied |
| `GIT_DIR=/nonexistent` | 0 | applied | removed | applied |
| ceiling, and `GIT_DIR=<outer>/.git` in the environment | 0 | applied | – | – |

`git apply --directory=<path of the copy in the outer repository>` also works on paper, but it
needs that relative path and depends on where git finds a repository. Not chosen.

## The fix

1. `scripts/lib/breaks-apply.ts` (new, small):
   - `applyPatch(copy, patch)`: runs `git apply --whitespace=nowarn` in the copy with
     `GIT_CEILING_DIRECTORIES` set to the parent folder of the copy, and with `GIT_DIR` and
     `GIT_WORK_TREE` removed from the environment (a git hook sets them; with them, git can use a
     repository again). Git then finds no repository and applies the patch to the copy.
   - `changesMissing({ repo, copy, files })`: for each changed or new file, compares the copy with
     the checkout: both absent (a deleted file), or the same kind (file or link), the same bytes
     (or link target), and the same executable bit. It returns the files that differ.
2. `scripts/check-breaks.ts`, the copy step only: `applyPatch` replaces the inline `git apply`.
   After the new files are written, the runner lists the changed files
   (`git diff HEAD --name-only --no-renames -z`, so a rename gives the old and the new path) and
   the new files, and calls `changesMissing`. If a file differs, it prints each file and
   "the copy does not have these local changes", and exits 1 before `pnpm install`.
   So "Local changes: sha256 …" in a report now also means that the copy has those changes.
3. `docs/testing.md` §5, step 1: one sentence for the apply and the check.

Why a check and not only the environment: the check does not depend on how git finds a
repository. Another way to lose an edit (a git setting, a future git change, a file that
`git archive` leaves out) stops the run: the check names the file, or `git apply` fails.

## Test strategy (`scripts/lib/breaks-apply.test.ts`, test first)

| Behaviour | Test | Red run |
| --- | --- | --- |
| A tracked edit reaches the copy when the copy is inside a git repository (the owner's one test) | A temporary source repository with a committed file and an uncommitted edit; a second temporary git repository holds the copy folder; `git archive` into it; `applyPatch` with `git diff HEAD --binary`; the copy's file has the edit. Also a deleted file and an executable bit, in the same patch | First commit: `applyPatch` holds the code of `main` (a plain `git apply`), the test fails at the assertion of the edit. Second commit: the fix, the test passes |
| The runner stops when a change did not reach the copy | `changesMissing` names a changed file whose copy has the old text; a deleted file that the copy still has; a file whose executable bit differs; a new file that is missing in the copy; and returns nothing when the copy equals the checkout | Test first: the function does not exist; then each case fails on a stub that returns `[]` (recorded) |

The wiring in `check-breaks.ts` (three lines) is checked by the proof below, not by a unit test:
the runner is a top-level script.

Proof (step C, the heavy slot from the chief):

- #128's case on the fixed runner: TMPDIR inside `cty1ng/tmp`, a list with a local tracked edit
  that the runner must refuse. The refusal line must show.
- The same with the ceiling removed by hand (a break of the fix): the runner must exit 1 with the
  new message and the file name, before `pnpm install`.
- A normal run with TMPDIR outside each repository (`cty1ng-breaks-tmp/runner-tmpdir`) and no
  local changes: unchanged output.

## Interplay with #107 and #128

- #128 moves the tests-of-the-PR block of `check-breaks.ts` into `scripts/lib/breaks-static.ts`
  and changes the imports. This PR does not touch that block, keeps the variable names
  (`untracked`, `patch`), and adds its import on its own line before the import of
  `./lib/breaks.ts`. Expected merge: clean or a one-line conflict in the imports.
- #107 replaces the whole copy step with `makeCopy` (copies the files, no `git apply`). When #107
  merges after this PR, its copy step wins: the merge removes `applyPatch`, the call to
  `changesMissing` and `scripts/lib/breaks-apply.ts` with its test (or #107 keeps
  `changesMissing` as an extra check; #107 decides). The sentence in testing.md §5 is replaced by
  #107's text.

## Not claimed

- Break reports made before this PR with "Local changes: sha256 …" are not checked again here
  (the audit `tmp/reviews/tmpdir-defect-audit.md` covers them: no merged claim rests only on such a run).
- Other git settings that change what `git archive` puts in the copy (for example a
  `.gitattributes` export rule; the repository has none) are not tested. The check stops such a
  run if it drops a changed or new file; it does not see a file that no local change touches.
- The rule that TMPDIR must be outside each git repository stays in the common prompt of the
  agents (the chief owns it).

## Open questions

None.
