# Guard speed test: the fastest of 3 runs for each 1 MB line (DQ-455), and one helper for all timed tests

Brief: DQ-455 in [delivery-quality.md](../delivery-quality.md) (the home was not set; the chief agent set it on 2026-11-18); no task brief exists
Checkpoint: none (one test changes; no product code, no UI, no new module)
Approval: chief agent, 2026-11-18, under the owner's order of 2026-11-14 (P3 questions to consultants); owner review pending. The chief agent asked for two proofs in the PR: the time of the test with the 1.1 s break (it must be far from the 20 s test timeout) and the normal time in the full suite
Approval (revision 3, the redesign, part 2): Owner, 2026-11-18, q5 Q5 A (the design); plan review: chief agent; owner review pending

Revision 3 (2026-11-18, after the owner's answer q5 Q5 A; approved by: see the line above): the
owner chose a redesign of the way that tests time work. Part 2 of "Fix" is new, with its own test
strategy. Part 1 (the 48 lines of the guard test) did not change; it is built and has had review
rounds 1 and 2 and check 3. The "Open questions" section is now closed.

Revision 2 (2026-11-18, after review round 1; approved by the chief agent, 2026-11-18): a second
break (the last line), the red-run break of the first 3 lines, and the goal "one slow run does not
fail the test" in place of "a busy machine does not fail the test". The old words came from the
chief agent's brief, not from an owner-approved criterion. The owner's decision on a redesign is
open (see "Open questions").

Code read at `origin/main` = `74a1ff2`.

## Cause

`sensitive-data.rules.test.ts`, the test "scans each 1 MB line of the new forms in well under a
second" (48 lines): each line is scanned one time, and one time over 1,000 ms fails the test. In
a full `pnpm test` the machine is busy, so one slow run can fail it. This is the cause of DQ-044
(#73) and of item 72 (#119). #119 added `fastestRun` (the fastest of up to 3 runs) for the first
timed test of the file and left this one.

The cause is not one test, it is the way of timing: a test times one run with `performance.now`
and fails over a limit. Three more tests do this today: `backend/src/core/skills/skill-md.test.ts`
(two tests, 500 ms each) and `backend/test/api/bots.test.ts` (one test, 2,000 ms). Each fix so far
was one test at a time (DQ-044, item 72, DQ-455). The owner's decision (q5 Q5 A, 2026-11-18, words
in "The decision" below) removes the cause for every test.

## The decision (owner, 2026-11-18, q5 Q5 A, word for word)

"One shared helper for timed tests (fastest of up to 3 runs) in a test helper module;
docs/testing.md says timed tests use it; a check fails a test file that times a single run with
performance.now outside the helper; the three other timed tests move to it. Built in #137."

## Fix

### Part 1: the 48 lines of the guard test (built; unchanged by revision 3)

- Use `fastestRun(() => { findSensitive(line); }, 1_000)` for each line. A burst of load slows
  one run. A slow scan (a quadratic loop, a wait) is slow in every run, so the fastest of 3 is still
  over the limit and the test fails. A scan that is slow only in its first run (for example a
  regular expression before V8 compiles it) passes: see "Not claimed".
- The assertion stays in the test body, not in the helper, and has its own text with the line
  number: `expect(fastest, ...).toBeLessThan(1_000)`.
- The limit stays at 1,000 ms. The build measures the time of the slowest line alone and under
  load, and the PR description gives the numbers. The limit changes only if those numbers show a
  reason. The comment of the test gets the measured margin, as the comment of the first timed
  test has.
- No guard code changes. In part 1 the helper `fastestRun` did not change; in part 2 it moves.

Files of part 1: `backend/src/core/guard/sensitive-data.rules.test.ts`,
`scripts/breaks/pr-<n>.json`, and the records (`docs/delivery-quality.md`, `docs/status.md`, the
table of `docs/plans/README.md`).

### Part 2: one helper, one rule, one check, three tests moved

**The helper: `backend/test/timed.ts`** (new file, no imports, no vitest). Tests of the backend
already import from `backend/test/` (`helpers.ts`, including the tests in `backend/src/core/`), and
the import rules allow it. A separate small file, not `helpers.ts`, because `helpers.ts` imports
the adapters and the app: a pure test of a `*.rules.ts` file must not load them. It is not an
indexed folder (`check:index` lists `backend/test/contracts` only), so no README row.

```ts
export function fastestRun(work: () => void, limitMs: number): number;
export function fastestRunAsync(work: () => Promise<unknown>, limitMs: number): Promise<number>;
```

- The number of runs is one constant in the file, `MAX_RUNS = 3` (the owner's "up to 3").
- Each returns the time in ms of the fastest run. It stops at the first run under `limitMs`, so a
  fast machine runs `work` once. The loop is the one that `sensitive-data.rules.test.ts` has today
  (`fastest >= limitMs`), moved without change; the async one awaits each run in turn.
- The assertion stays in the test body (testing.md §5: "the assertion is in the test itself, not
  in a shared helper", and the break runner refuses a break of a test helper). The test writes
  `expect(fastest, "label").toBeLessThan(limit)`.
- An error that `work` throws or rejects with is not retried: it ends the test at once. So a
  correctness assertion inside `work` fails on the first wrong run.
- `work` must give the same result each run and change no state that the next run reads. A test
  with `work` that writes state makes fresh state for each run, or does not use the helper.

**The rule in testing.md.** §3 "Test helpers" gets one table row for the two functions, and one
paragraph "Timed tests" after "Fake secrets": a test that checks that work is fast times it only
with these helpers, never one run with `performance.now`; why (DQ-044, item 72, DQ-455: one slow
run on a busy machine fails a test with nothing wrong); the condition on `work` (above); the
limit has a measured margin in a comment; what the check does not see (below). §4 "CI gates"
names the rule in its ESLint line.

**The check: an ESLint rule** (`no-restricted-properties` for `performance.now`) in
`eslint.config.js`, for `backend/src/**/*.test.ts`, `backend/test/**/*.ts` and
`scripts/**/*.test.ts`, with `backend/test/timed.ts` as the only exception. Options that I
compared:

| Option | Runs in CI | Cost | Verdict |
| --- | --- | --- | --- |
| ESLint `no-restricted-properties` | yes, the job `lint` (`pnpm lint`) | one config block, no code; `scripts/lint-rules.test.ts` already tests lint rules on snippets with the real config | chosen |
| ESLint `no-restricted-syntax` | yes | the last block that sets `no-restricted-syntax` wins for a file, so the rule must be copied into 5 blocks (the file says so); the snippet test of "each file gets its rule sets" must grow | more places to keep in step; the form `performance.now` is no more than `no-restricted-properties` sees |
| A script in the gates (`check:timed`) | needs a new CI job, a package script and a script test | a new tool for one pattern | rejected: more than a lint rule |
| A Vitest test that reads the files | yes, `pnpm test` | a test that reads source text with a regex | rejected: ESLint reads the syntax tree, a regex reads text, so it also finds a word in a comment |

The rule reads the form `performance.now` (also `performance["now"]` and a destructured `now`).
It uses a block of its own: `no-restricted-properties` is another rule from `no-restricted-syntax`,
so it does not meet the "last block wins" problem.

**Why backend and scripts only.** The helper lives in `backend/test/`; `frontend/` may not import
`backend/` (the import rule `frontend-not-to-backend`), and `shared/` may not either. No frontend
or shared test times work today. A timed test there needs its own decision about where its helper
lives. This is in "Not claimed", and it gets one ledger row.

**The three tests move** (the label of each assertion is new and unique in its file, because the
break list needs the assertion text exactly once):

| Test | Limit | Work in `fastestRun` | State between runs |
| --- | --- | --- | --- |
| `skill-md.test.ts` "reports 40,000 keys at once, with no parse" | 500 ms | `parseSkillMd(text)` (a pure function), with the `toEqual(tooLarge)` check inside `work` | none |
| `skill-md.test.ts` "finds no closing --- line in a 1 MB file quickly" | 500 ms | `parseSkillMd(text)`, with its `toEqual` check inside `work` | none |
| `bots.test.ts` "PATCH refuses a 1 MB description on its length, fast, after the guard scan" | 2,000 ms | `fastestRunAsync`: one `PATCH` with the same body; the time is the time of `await send(...)` as today; the status and the error body are checked inside `work` | the request is refused with 422 before any write, so no row, event or `row_version` changes. The test adds an assertion after the runs: `GET` shows `row_version: 1` and the old description. If a 422 ever wrote state, this assertion fails |

The text of each test and its limit do not change. Each limit gets the margin comment that the
guard tests have: measured alone and under 24 busy processes (the numbers go in the PR
description). The limit changes only if the numbers show a reason.

The first guard test (`scans a 1 MB line of short code-like words`) and the 48-line test change
only their import: the local `fastestRun` goes, the one of `timed.ts` comes.

Files of part 2: `backend/test/timed.ts`, `backend/test/timed.test.ts`, `eslint.config.js`,
`scripts/lint-rules.test.ts`, the 3 moved tests and `sensitive-data.rules.test.ts` (import),
`docs/testing.md`, `scripts/breaks/pr-137.json`, and the records (`docs/delivery-quality.md`,
`docs/status.md`: the Follow-ups row on timed tests closes).

## Test strategy

The change is to a test of a security folder (the guard), so it gets a break list, even though it
is not a late test.

| Case | How it is proved |
| --- | --- |
| A slow scan still fails the test | Two breaks in `sensitive-data.rules.ts` (a value changes, nothing throws), both in the break list: `findSensitive` waits 1.1 s in each call (the assertion of line 1 fails), and it waits 1.1 s only for the last line (the loop reaches line 48 and the message names it). Each of the 3 runs is over the limit. 3 runs of 1.1 s stay inside the 20 s test timeout |
| One slow run on a busy machine does not fail the test | Break (not in the list, because the runner counts only a failure): `findSensitive` waits 1.1 s only in the first call of each of the first 3 lines. The old test fails, the new test passes. Both runs are in the PR description. This is the red run of the defect, on the old test. A wait on the first call of all 48 lines is not used: its 53 s total is over the 20 s test timeout, a second limit that the test shares |
| The old test fails on one slow run | The same one-slow-run break on the old test file: red. Same run as above |
| Time alone and in a full run | Time of the test alone, and in 3 full `pnpm test` runs (the JSON reporter gives the time of the test) |
| Margin | The slowest line alone and with 24 busy processes, fastest of 3 |

### Part 2: the helper, the rule and the moved tests

Test first: the test of the helper and the lint cases are written before the helper and the rule,
and each is run red first (no module, no rule). Part 2 changes tests of the guard folder and of
two other files, so each moved test gets a claim and a break, as the guard test has.

| Case | How it is proved |
| --- | --- |
| The helper stops at the first run under the limit | `backend/test/timed.test.ts`, with `performance.now` replaced by a fixed list of times (`vi.spyOn(performance, "now")`; the string form is not the property form that the rule reads): `work` is called once; the same for the async one |
| The helper runs up to 3 times and returns the fastest | Times 100, 10, 40 ms with a limit of 5 ms: 3 calls, 10 returned. Times 100, 10 with a limit of 50 ms: 2 calls, 10 returned. A fourth run never starts. Same for the async one |
| An error is not retried | `work` throws (rejects) on its first call: the helper throws (rejects) with the same error and `work` was called once |
| A test file with `performance.now` fails the check | `scripts/lint-rules.test.ts`: a snippet that times one run, at the path of a test of `backend/src/`, of `backend/test/` and of `scripts/`, gets the rule's message. Red run: before the config block, the same cases fail. Also run once with a real scratch test file and `pnpm lint` (build fact, in the PR description) |
| The helper itself, a product file and other tests are not refused | Snippets: `backend/test/timed.ts`, `backend/src/adapters/http/middleware.ts` (it times a request with `performance.now`) and a frontend test give no message from this rule |
| The rule sees these forms | `performance.now()`, `performance["now"]()`, `const { now } = performance`. Written as cases, so that the claim is no bigger than the cases |
| A moved test still fails on a slow scan | One claim for each moved test in `scripts/breaks/pr-137.json`, each with a break in product code (a value changes, nothing throws): `parseSkillMd` waits 600 ms in the path of the 40,000 keys; it waits 600 ms in the path of the file with no closing line (so each claim fails alone); `findSensitive` waits 2.1 s for a text over 500,000 characters (the PATCH test; 3 runs of 2.1 s stay inside the 20 s test timeout). Each caught at the line of its own assertion by `pnpm check:breaks` |
| A moved test does not fail on one slow run | A break that is slow only in the first call (not in the list, because the runner counts only a failure): the old form of each test fails, the new form passes. Run on the test of each file and written in the PR description |
| The bots test changes no state between runs | The new `GET` assertion after the runs; the break with a 422 that writes is not built (it needs a code change that no one plans). Claimed: the assertion is in the test. Not claimed: a break that proves it fails |

The tests of `timed.test.ts` and the lint cases are new, so by `docs/testing.md` §5 they record their
red run and need no break list. The static check of `check:breaks` still asks for a claim or an
exemption for each test that the PR adds or changes: the helper tests and the lint cases get
exemption lines with the reason "test first: the red run is in the PR description".

Order and timing: the fastest of 3 stops at the first run under the limit, so a fast machine runs
each line one time. The loop keeps the first failing line in the message.

## Not claimed

- That the limit is right for each machine: the limit stays 1,000 ms for a 1 MB line, and a very
  slow CI runner can still fail it. Not run on CI before the push.
- That a slow scan that is slower on only some of the 3 runs fails: a scan that is fast in one run
  of three passes. This is the cost of the fastest-of-3 rule, as in #119. One known case: V8
  interprets a regular expression in its first run and compiles it after that, so a backtracking
  regular expression can be slow in its first run only. Not claimed: that the test catches it.
- That a busy machine never fails the test: the test has a second limit, the 20 s test timeout.
  Slow runs that add up to more than 20 s (about 18 lines with one slow run each) still fail it.
- The first timed test (`scans a 1 MB line of short code-like words`) is not changed.
- Part 2: that no test in the repository times a single run. The rule reads the form
  `performance.now` in the test files of `backend/` and `scripts/` only. Not seen: other clocks
  (`Date.now()`, `process.hrtime`), an alias (`const p = performance; p.now()`,
  `globalThis.performance.now()`, an import of `performance` under another name), a timer in a
  frontend test or a shared test, and a test that times a run and never uses the number. The
  forms are checked in the build and the result goes in the PR description.
- Part 2: that the fastest of 3 is the right method for each test. It is the owner's choice (q5
  Q5 A). A timing-free method was measured in #119 and was less stable (growth ratio 2.7 to 12.0
  under load).
- Part 2: that a scan that is slow only in its first run fails a moved test (the V8 case above).
  The same cost as in part 1, now for four more tests.
- Part 2: that the 20 s test timeout never fails a moved test. Three runs of a slow bots request
  (2.1 s each) stay inside it; many slow runs in one test do not.
- A timing test cannot prove a linear scan; it proves that no line of the list takes over 1 s on
  the fastest of 3 runs.

## Open questions

None for the owner. The decision on the redesign is the owner's answer q5 Q5 A (2026-11-18),
quoted above. `AGENTS.md` §9: the redesign is built in this PR, and its commits get their own
review rounds as new work ([merge bar](../workflows/merge-bar.md#when-the-review-of-a-p3-pr-ends),
step 2).

Choices that I made inside the decision, for the plan review: the helper is a new file
`backend/test/timed.ts`, not `helpers.ts`; the check is an ESLint rule for backend and script
tests; frontend and shared tests are not covered, because they cannot import the helper (the
frontend row of "Not claimed"); the helper returns the time and the test keeps its assertion.
