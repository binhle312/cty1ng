// The one way for a test to time work (docs/testing.md §3, "Timed tests"; owner, 2026-11-18,
// q5 Q5 A). A test that times one run and fails over a limit fails on a busy machine with nothing
// wrong (DQ-044, item 72, DQ-455). So the time is the fastest of up to MAX_RUNS runs. Work that is
// slow on every run is over the limit on the fastest run too. `pnpm lint` fails a test file that
// reads `performance.now` outside this file.
//
// The test keeps its own assertion: `expect(fastest, "label").toBeLessThan(limitMs)`. It passes
// the same `limitMs` to both: a constant in the test. A helper limit above the assertion's limit
// would stop at a run that the assertion refuses, and one slow run would fail the test again.
// An error that `work` throws or rejects with is not retried.
// `work` gives the same result each run and changes no state that the next run reads.
//
// This file has no imports, so a pure test of a `*.rules.ts` file can use it.

export const MAX_RUNS = 3;

/** The time in ms of the fastest run of `work`. It stops at the first run under `limitMs`. */
export function fastestRun(work: () => void, limitMs: number): number {
  let fastest = Number.POSITIVE_INFINITY;
  for (let run = 0; run < MAX_RUNS && fastest >= limitMs; run += 1) {
    const start = performance.now();
    work();
    fastest = Math.min(fastest, performance.now() - start);
  }
  return fastest;
}

/** As `fastestRun`, for work that returns a promise: each run ends when its promise does. */
export async function fastestRunAsync(
  work: () => Promise<unknown>,
  limitMs: number,
): Promise<number> {
  let fastest = Number.POSITIVE_INFINITY;
  for (let run = 0; run < MAX_RUNS && fastest >= limitMs; run += 1) {
    const start = performance.now();
    await work();
    fastest = Math.min(fastest, performance.now() - start);
  }
  return fastest;
}
