# CI check of the break list rules (DQ-517 D, DQ-448 B)

Brief: the owner's answers of 2026-11-18 in `decisions.html`: "DQ-517: D" and "DQ-448: B" (a CI
check that runs the static rules of the break runner on each PR, in its own small PR with a plan)
Checkpoint: code design (a new script and a new module of `scripts/lib/`); no UI, no migration
Approval: plan OK by the lead agent, 2026-11-18, against the owner's answers DQ-517 D and DQ-448 B (revision 1; Q1: option B; Q2 and Q3 as recommended); owner review pending

## The cause

Three times a test or a break list was pushed before the runner checked it, and the list was
wrong: DQ-439 (#117, the break S14 did not compile), DQ-448 (#119, the break T4 did not compile),
DQ-515 and DQ-517 (#124, an assertion outside its test, a changed test with no claim, then an
assertion found two times). Each time the cause was a person who did not run the rules before the
push. A CI job runs them on each push of a PR.

## Probes (on `main` `dcf619b`, and `aa85cb9` for `pr-124.json`; this laptop)

| Probe | Result |
| --- | --- |
| `linkProblems` on each list of `scripts/breaks/`, read from the checkout (no copy, no install) | 1.5 s wall for all 16 lists. 14 lists: 0 problems (on `aa85cb9`, `pr-124.json`: 38 claims, 0 problems, 0.3 s). `pr-86.json` (7) and `pr-91.json` (5) fail: the code moved after their merge. So the job checks only the list of its own PR |
| `tsc -p` of one project with a break (what the full runner does for each break) | `frontend/tsconfig.app.json` 6.2 s, `frontend/tsconfig.test.json` 9.5 s, `backend` 6.2 s, root 6.3 s. A frontend break costs about 16 s; the 38 breaks of #124 about 10 minutes |
| A compile check in one process: one TypeScript language service for each project, the broken file replaced in memory, only the diagnostics of the broken file | 2.5 s to 28.5 s wall for each of 14 lists (pr-121, 28 breaks, is the slowest), 0 false errors; `pr-124.json` (38 breaks): 31 s wall, 0 false errors. It catches both real cases: S14 of #117 before `d2adf6a` (TS2339 `dataUpdateCount`) and T4 of #119 before `6463df2` (TS2339 on `never`) |
| The same probe without `realpath` in the host | false errors (TS7006) on unbroken files: pnpm links need `realpath`. A test keeps it |

## Code design

### Options

| Option | Gain | Cost | Risk |
| --- | --- | --- | --- |
| A. Link and coverage rules only | 1.5 s; matches the words of DQ-517 D | Does not stop the cause of DQ-439 and DQ-448 (a break that does not compile) | DQ-448 B says "the same CI check", so its cause stays open |
| **B. A + a cheap compile check of each break (recommended)** | Stops all three causes; measured up to 31 s | A second compile engine next to the runner's `tsc`; it reads only the broken file | An error that the break causes in another file passes the job (the full runner still fails it) |
| C. A + `tsc -p` for each break, as the runner | Same check as the runner | About 16 s for each frontend break; 10 minutes for #124 | Slow CI; no new proof over B for the real cases |

### Modules (option B)

- `scripts/lib/breaks-static.ts` (new): `prProblems({ list, only, diff, newFiles, read })` moves
  the block of `check-breaks.ts` that finds the tests of the PR and calls `linkProblems` and
  `coverageProblems`, so the runner and the job use one home for these rules.
  `compileProblems({ list, root, read })` gives the TypeScript errors of each broken file (one
  language service for each project of `projectsOf`, file text replaced in memory), and a problem
  for a TypeScript file that no project reads (the runner's rule).
- `scripts/check-breaks.ts`: calls `prProblems` in place of its block. No other change.
- `scripts/check-breaks-static.ts` (new), `pnpm check:breaks:static <list> [--base <ref>]`: reads
  the checkout (HEAD, local changes and new files, as the runner's copy has them), runs
  `prProblems` and `compileProblems`, prints each problem, exit 1 when there is one. A missing list
  is no error: it prints that the list is missing and that testing.md §5 says which PRs need one,
  exit 0.
- `scripts/lib/breaks.ts`: no change.
- `.github/workflows/ci.yml`: a job `check:breaks static`, on `pull_request` only. Checkout with
  `fetch-depth: 2`; the job runs `pnpm check:breaks:static scripts/breaks/pr-$PR.json --base HEAD^1`
  (`HEAD^1` of the merge commit of GitHub is the base branch, so the diff is the change of the PR).
  The PR number comes from `github.event.pull_request.number` through an environment variable.
  It runs on each PR: with no list it passes in a few seconds. It stays an optional check: the lead agent checks it before each merge (owner, 2026-11-18, q4 Q2 B).

### Failure paths

- No list: pass, with the message. A list that is not valid JSON or not valid by the schema: exit 1
  with the error of the parser.
- A list of an older PR that this PR changes: not checked (a list is evidence for its own review).
- A break of a file that is not TypeScript (`.json`, `.css`): no compile check, as in the runner.

### The rule for a PR with tests and no list

testing.md §5 says that a PR needs a list only for late tests, security tests, and order and race
tests. A machine cannot tell these tests. So the job passes with no list; the reviewer still checks
that a PR that needs a list has one. No new rule.

## Interplay with #107

#107 (open, on hold) replaces the block that `prProblems` takes with `testsOfPr` and
`listProblems`, and changes the coverage rule (a test counts by its key, not by its changed lines).

- If this PR merges first: #107 has one conflict in `check-breaks.ts` (the same block). Its
  resolution: `prProblems` calls #107's `testsOfPr` and `listProblems`; the static script stays.
  The conflict is the guard: the job and the runner cannot keep two copies of the coverage rule.
- If #107 merges first: this PR takes #107's functions in `prProblems` before its merge.
- `breaks.ts` gets no change here, so no conflict there.

## Files

`scripts/lib/breaks-static.ts`, `scripts/lib/breaks-static.test.ts`, `scripts/check-breaks-static.ts`,
`scripts/check-breaks-static.test.ts`, `scripts/check-breaks.ts`, `package.json` (one script line),
`.github/workflows/ci.yml`, `docs/testing.md` (§4 one line, §5 one paragraph), this plan and
`docs/plans/README.md`; in the records turn `docs/delivery-quality.md` and `docs/status.md`.
No new dependency (`typescript` is in the root already).

## Test strategy (test first; each new test red on a stub before the code)

| Behaviour | Test | Level | Red run on |
| --- | --- | --- | --- |
| An assertion found two times in the test file is refused (DQ-517) | `breaks-static.test.ts` | unit | a stub `prProblems` that returns `[]` |
| A test that the PR changes and no claim or exemption names is refused (DQ-515) | same | unit | stub |
| An assertion outside its named test is refused (DQ-515) | same | unit | stub |
| Each test of a new (untracked) test file counts; a test whose lines the PR did not touch does not | same | unit | stub |
| With `only`, coverage is not checked and only matching claims are linked (runner behaviour kept) | same | unit | stub |
| A break that does not compile gives the TypeScript error; one that compiles gives none | same (temp project in the system temp folder) | unit | a stub `compileProblems` that returns `[]` |
| A TypeScript file that no project reads is refused; a `.json` break is not compiled | same | unit | stub |
| A package that pnpm links resolves (the `realpath` case of the probe) | same: an import through a linked folder | unit | the host without `realpath` |
| CLI: no list, exit 0 and the message; a valid list, exit 0; the DQ-517 list, exit 1 with the problem; `--base` sets the diff; a new untracked test file counts | `check-breaks-static.test.ts` (a temp git repo, the script run by `node`) | process | stub script |
| The job on GitHub: red with a list that misses an exemption, green after the fix | this PR's own CI (two pushes) | CI | the red push |

Order cases: none in the app. In the job: the list and the tests come from one checkout, so no
race.

## Proof plan (step C)

- `pnpm check:breaks:static` on at least three lists of `main` with `--base HEAD`: pass.
- On the pre-fix list of #124 (`092c257`): fails on C21 (assertion found more than once). Timed.
- The full `pnpm check:breaks` on one small list after the refactor of `check-breaks.ts` (heavy
  slot), and on the #124 pre-fix list: the same refusal lines as the static job.

## Not claimed

- The job does not prove that breaks are caught: only the full `pnpm check:breaks` does.
- The compile check reads the broken file only. An error that a break causes in another file is
  not found here.
- A PR that needs a list and has none passes the job.
- Lists of older PRs are not checked.

## Open questions (for the lead agent; owner items go under `Needs human review`)

1. Option B (with the compile check) or A? Recommendation: B.
2. Required check: the owner's setting in the ruleset "Protected main". Recommendation: make
   `check:breaks static` required (it always reports, so a PR without a list is not blocked).
   This PR does not change the ruleset.
   Answer: the owner chose to keep it optional (2026-11-18, q4 Q2 B); the lead agent checks it before
   each merge.
