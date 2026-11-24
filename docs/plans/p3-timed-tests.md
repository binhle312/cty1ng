# Timed tests: one helper, one lint rule, four tests moved (DQ-805, DQ-809 to DQ-811; owner's q5 Q5 A)

Brief: DQ-805 in [delivery-quality.md](../delivery-quality.md) (the owner's decision on a repeated cause); the first plan of this PR is [p3-guard-speed-test.md](p3-guard-speed-test.md); no task brief exists
Checkpoint: none (test helper and lint config only; no product code, no UI; the owner decided the design)
Approval: Owner, 2026-11-18, q5 Q5 A (the design); plan review: lead agent, 2026-11-18 (with two changes: the rule covers the frontend and shared tests too, and this plan has its own file); owner review pending

Revision 2 (2026-11-18, after review round 1 of the redesign; no change of the owner's decision):
the plan text now matches the build in six places: the status of the bots test is checked inside
`work` and its error body after the runs (R1-3); the break of the PATCH test is in `firstSensitive`,
the function that the save paths call (R1-3); the words about the state that the PATCH test
checks are smaller (R1-4); each test holds its limit in one constant that the helper and the
assertion share (R1-1); the lint rule also covers `scripts/fixtures/` (R1-7); the list of what the rule
does not see is longer (R1-2). The first guard test also has a claim now.

Revision 1 (2026-11-18). A redesign after a review gets its own file ([plans README](README.md),
rule 6, and `AGENTS.md` §9: built in the PR that found the issue). It is built in #137, and its commits
get their own review rounds as new work ([merge bar](../workflows/merge-bar.md#when-the-review-of-a-p3-pr-ends),
step 2).

Code read at `origin/main` = `74a1ff2`.

## Cause

A test that checks that work is fast times one run with `performance.now` and fails over a limit.
One slow run on a busy machine fails it with nothing wrong. This happened three times in the guard
tests: DQ-044 (#73), item 72 (#119) and DQ-455 (this PR, part 1 in
[p3-guard-speed-test.md](p3-guard-speed-test.md)). Each fix covered one test. #119 added the
helper `fastestRun` inside one test file. Three more tests still time one run:
`backend/src/core/skills/skill-md.test.ts` (two tests, 500 ms each) and
`backend/test/api/bots.test.ts` (one test, 2,000 ms). The cause is the way of timing, not one test.

## The decision (owner, 2026-11-18, q5 Q5 A, word for word)

"One shared helper for timed tests (fastest of up to 3 runs) in a test helper module;
docs/testing.md says timed tests use it; a check fails a test file that times a single run with
performance.now outside the helper; the three other timed tests move to it. Built in #137."

## Fix

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
- The test holds its limit in one constant and passes it to the helper and to the assertion
  (`const limitMs = 500;`), so the two cannot differ: a helper limit above the assertion's limit
  would stop at a run that the assertion refuses.
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
`eslint.config.js`, in two blocks. Block 1: `backend/src/**/*.test.ts`, `backend/test/**/*.ts` and
`scripts/**/*.test.ts` and `scripts/fixtures/**/*.ts`, with `backend/test/timed.ts` as the only exception; the message names the
helper. Block 2: the frontend and shared test files (below), no exception, a message of its own.
Options that I compared:

| Option | Runs in CI | Cost | Verdict |
| --- | --- | --- | --- |
| ESLint `no-restricted-properties` | yes, the job `lint` (`pnpm lint`) | one config block, no code; `scripts/lint-rules.test.ts` already tests lint rules on snippets with the real config | chosen |
| ESLint `no-restricted-syntax` | yes | the last block that sets `no-restricted-syntax` wins for a file, so the rule must be copied into 5 blocks (the file says so); the snippet test of "each file gets its rule sets" must grow | more places to keep in step; the form `performance.now` is no more than `no-restricted-properties` sees |
| A script in the gates (`check:timed`) | needs a new CI job, a package script and a script test | a new tool for one pattern | rejected: more than a lint rule |
| A Vitest test that reads the files | yes, `pnpm test` | a test that reads source text with a regex | rejected: ESLint reads the syntax tree, a regex reads text, so it also finds a word in a comment |

The rule reads the form `performance.now` (also `performance["now"]` and a destructured `now`).
It uses a block of its own: `no-restricted-properties` is another rule from `no-restricted-syntax`,
so it does not meet the "last block wins" problem.

**The frontend and shared tests** (lead agent, plan review, 2026-11-18). The helper lives in
`backend/test/`; `frontend/` and `shared/` may not import `backend/` (the import rules
`frontend-not-to-backend` and `shared-not-to-packages`). No frontend or shared test times work
today, so nothing breaks. The same rule covers them with no exception: `frontend/**/*.{test,spec}.{ts,tsx}`,
`frontend/test/**/*.{ts,tsx}` and `shared/**/*.test.ts`, with its own message: "Timed tests use the
helper of docs/testing.md; add a helper for this package first". The day a test there needs a timer,
lint stops it, and the helper for that package is added then, under the same rule of
`docs/testing.md`. No ledger row.

**The three tests move** (the label of each assertion is new and unique in its file, because the
break list needs the assertion text exactly once):

| Test | Limit | Work in `fastestRun` | State between runs |
| --- | --- | --- | --- |
| `skill-md.test.ts` "reports 40,000 keys at once, with no parse" | 500 ms | `parseSkillMd(text)` (a pure function), with the `toEqual(tooLarge)` check inside `work` | none |
| `skill-md.test.ts` "finds no closing --- line in a 1 MB file quickly" | 500 ms | `parseSkillMd(text)`, with its `toEqual` check inside `work` | none |
| `bots.test.ts` "PATCH refuses a 1 MB description on its length, fast, after the guard scan" | 2,000 ms | `fastestRunAsync`: one `PATCH` with the same body; the time is the time of `await send(...)` as today; the status is checked inside `work`, and the error body of each response after the runs, so the timed span stays the request | the request is refused with 422 before any write (`bots.service.ts`: the text check throws before `updateBot`), so the bot row does not change. A write to the bot would change `row_version`, and the next run would answer 409: the status check inside `work` fails. The test adds an assertion after the runs: `GET` shows `row_version: 1` and the old description. Not checked: a write to another table |

The text of each test and its limit do not change. Each limit gets the margin comment that the
guard tests have: measured alone and under 24 busy processes (the numbers go in the PR
description). The limit changes only if the numbers show a reason.

The first guard test (`scans a 1 MB line of short code-like words`) and the 48-line test change
their import (the local `fastestRun` goes, the one of `timed.ts` comes) and keep their limit in a
constant. The first test gets its own claim and break in the break list (a wait for the line), because
it is a changed test of a security folder.

Files of part 2: `backend/test/timed.ts`, `backend/test/timed.test.ts`, `eslint.config.js`,
`scripts/lint-rules.test.ts`, the 3 moved tests and `sensitive-data.rules.test.ts` (import),
`docs/testing.md`, `scripts/breaks/pr-137.json`, and the records (`docs/delivery-quality.md`,
`docs/status.md`: the Follow-ups row on timed tests closes).

## Test strategy

Test first: the test of the helper and the lint cases are written before the helper and the rule,
and each is run red first (no module, no rule). Part 2 changes tests of the guard folder and of
two other files, so each moved test gets a claim and a break, as the guard test has.

| Case | How it is proved |
| --- | --- |
| The helper stops at the first run under the limit | `backend/test/timed.test.ts`, with `performance.now` replaced by a fixed list of times (`vi.spyOn(performance, "now")`; the string form is not the property form that the rule reads): `work` is called once; the same for the async one |
| The helper runs up to 3 times and returns the fastest | Times 100, 10, 40 ms with a limit of 5 ms: 3 calls, 10 returned. Times 100, 10 with a limit of 50 ms: 2 calls, 10 returned. A fourth run never starts. Same for the async one |
| An error is not retried | `work` throws (rejects) on its first call: the helper throws (rejects) with the same error and `work` was called once |
| A test file with `performance.now` fails the check | `scripts/lint-rules.test.ts`: a snippet that times one run, at the path of a test of `backend/src/`, of `backend/test/`, of `scripts/`, of `frontend/src/` and of `shared/src/` (one case for each package), gets the rule's message; the frontend and shared cases get the message "add a helper for this package first". Red run: before the config block, the same cases fail. Also run once with a real scratch test file and `pnpm lint` (build fact, in the PR description) |
| The helper itself, a product file and other tests are not refused | Snippets: `backend/test/timed.ts`, `backend/src/adapters/http/middleware.ts` (it times a request with `performance.now`) and a frontend file that is not a test (`frontend/src/lib/now.ts`) give no message from this rule |
| The rule sees these forms | `performance.now()`, `performance["now"]()`, `const { now } = performance`. Written as cases, so that the claim is no bigger than the cases |
| A moved test still fails on a slow scan | One claim for each moved test in `scripts/breaks/pr-137.json`, each with a break in product code (a value changes, nothing throws): `parseSkillMd` waits 600 ms in the path of the 40,000 keys; it waits 600 ms in the path of the file with no closing line (so each claim fails alone); `firstSensitive` (the function that the save paths call) waits 2.1 s for a text over 500,000 characters (the PATCH test; 3 runs of 2.1 s stay inside the 20 s test timeout). Each caught at the line of its own assertion by `pnpm check:breaks` |
| A moved test does not fail on one slow run | A break that is slow only in the first call (not in the list, because the runner counts only a failure): the old form of each test fails, the new form passes. Run on the test of each file and written in the PR description |
| The bots test changes no state between runs | The new `GET` assertion after the runs; the break with a 422 that writes is not built (it needs a code change that no one plans). Claimed: the assertion is in the test. Not claimed: a break that proves it fails |

The tests of `timed.test.ts` and the lint cases are new, so by `docs/testing.md` §5 they record their
red run and need no break list. The static check of `check:breaks` still asks for a claim or an
exemption for each test that the PR adds or changes: the helper tests and the lint cases get
exemption lines with the reason "test first: the red run is in the PR description".

Order and timing: the fastest of 3 stops at the first run under the limit, so a fast machine runs
each line one time. The loop keeps the first failing line in the message.

## Not claimed

- That no test in the repository times a single run. The rule reads the form `performance.now` in
  the test files of `backend/`, `scripts/`, `frontend/` and `shared/`. Not seen: other clocks
  (`Date.now()`, `process.hrtime`, `new Date().getTime()`), `performance.mark()` and `measure()`, an
  alias (`const p = performance; p.now()`, `globalThis.performance.now()`, an import of
  `performance` under another name), a key in a variable (`performance[key]()`), and a test that
  times a run and never uses the number. The forms are checked in the build and the result goes in
  the PR description.
- That the fastest of 3 is the right method for each test. It is the owner's choice (q5 Q5 A). A
  timing-free method was measured in #119 and was less stable (growth ratio 2.7 to 12.0 under load).
- That a scan that is slow only in its first run fails a moved test (for example a regular
  expression that V8 interprets in its first run and compiles after that). The same cost as in part
  1, now for the three moved tests.
- That the 20 s test timeout never fails a moved test. Three runs of a slow bots request (2.1 s
  each) stay inside it; many slow runs in one test do not.
- That the limits are right for each machine. Each limit stays as it is, with a measured margin.
- That a helper exists for frontend and shared tests. The rule stops a timer there and says to add
  one first.

## Open questions

None for the owner. The decision is the owner's answer q5 Q5 A, quoted above.

Choices that I made inside the decision, for the plan review (all approved by the lead agent): the
helper is a new file `backend/test/timed.ts`, not `helpers.ts`; the check is an ESLint rule; the
helper returns the time and the test keeps its assertion.
