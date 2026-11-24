# Guard speed test: the fastest of 3 runs for each 1 MB line (DQ-455)

Brief: DQ-455 in [delivery-quality.md](../delivery-quality.md) (the home was not set; the lead agent set it on 2026-11-18); no task brief exists
Checkpoint: none (one test changes; no product code, no UI, no new module)
Approval: lead agent, 2026-11-18, under the owner's order of 2026-11-14 (P3 questions to consultants); owner review pending. The lead agent asked for two proofs in the PR: the time of the test with the 1.1 s break (it must be far from the 20 s test timeout) and the normal time in the full suite

Revision 3 (2026-11-18): the owner's answer q5 Q5 A chose a redesign of the way that tests time
work. Its plan, test strategy and approval are in [p3-timed-tests.md](p3-timed-tests.md), a file of
its own ([plans README](README.md), rule 6). This file keeps the plan of the 48 lines of the guard
test, which did not change.

Revision 2 (2026-11-18, after review round 1; approved by the lead agent, 2026-11-18): a second
break (the last line), the red-run break of the first 3 lines, and the goal "one slow run does not
fail the test" in place of "a busy machine does not fail the test". The old words came from the
lead agent's brief, not from an owner-approved criterion. The owner's decision on a redesign is
in [p3-timed-tests.md](p3-timed-tests.md).

Code read at `origin/main` = `74a1ff2`.

## Cause

`sensitive-data.rules.test.ts`, the test "scans each 1 MB line of the new forms in well under a
second" (48 lines): each line is scanned one time, and one time over 1,000 ms fails the test. In
a full `pnpm test` the machine is busy, so one slow run can fail it. This is the cause of DQ-044
(#73) and of item 72 (#119). #119 added `fastestRun` (the fastest of up to 3 runs) for the first
timed test of the file and left this one.

## Fix

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
- No guard code changes. The helper `fastestRun` does not change.

Files: `backend/src/core/guard/sensitive-data.rules.test.ts`, `scripts/breaks/pr-<n>.json`, and
the records (`docs/delivery-quality.md`, `docs/status.md`, the table of `docs/plans/README.md`).

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
- A timing test cannot prove a linear scan; it proves that no line of the list takes over 1 s on
  the fastest of 3 runs.

## Open questions

None. The cause is the same as DQ-044 (#73) and item 72 (#119): this is a third fix of a one-run
time limit. `AGENTS.md` §9 asked for the owner's decision on a redesign. The owner chose one on
2026-11-18 (q5 Q5 A); it is built in this PR and planned in [p3-timed-tests.md](p3-timed-tests.md).
