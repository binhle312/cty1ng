# The pnpm links test of the static break check is fast enough for the full suite

Brief: the chief's task of 2026-11-18. The test "reads the packages that pnpm links, with no
false errors on code that the break keeps" (`scripts/lib/breaks-static.test.ts`, from #128) times
out in the full `pnpm test` (20 s limit) and passes when its file runs alone. Found by the gates
of #135 and #134 (two full runs of two).
Checkpoint: none (a change of one test file; no UI, no migration, no public API, no code design)
Approval: plan OK by the chief agent, 2026-11-18 (revision 1), with four conditions: break 1 (no `realpath`) and break 2 (the fixture check) each give a recorded red run; a comment at the fixture names the real case; the Not claimed line names where the real layout is still exercised; the test time alone and in three full runs. Owner review pending

## The cause, with numbers

The test runs `compileProblems` on a page of the real frontend
(`frontend/src/features/skills/skill-page.tsx`). The frontend has two projects
(`tsconfig.app.json`, `tsconfig.test.json`), and both read the page, so the check builds two
TypeScript programs of the whole frontend and type-checks the page in each. All of it is
synchronous CPU work in one Vitest worker.

Probe (this laptop, 2026-11-18, a script that times each phase with the code of `main`):

| Phase | `tsconfig.app.json` | `tsconfig.test.json` |
| --- | --- | --- |
| Source files in the program | 1300 | 1698 |
| First program (parse, bind, resolve) | 970 to 1222 ms | 1288 to 1522 ms |
| Program with the broken text | 50 to 106 ms | 68 ms |
| Semantic errors of the page | 515 to 699 ms | 446 to 508 ms |

Whole script: 3.7 to 4.7 s, 840 MB of memory. The test alone under Vitest: 3.7 to 4.2 s (two
runs). In the two failed full runs, the same test took 25.9 s and 32.0 s, and its whole file 42.2 s
(5.7 s alone): the suite runs about 140 files on all cores, so CPU work in a worker gets about
7 times slower. About 4 s of work times 7 is over the 20 s limit. Sharing one parse of the
library files between the two projects (a shared `DocumentRegistry`) saved memory (840 to
665 MB) but no clear time in the probe (the same 7 s, with other sessions on the laptop), so
it cannot give the margin.

What the test must prove: without the real path of each pnpm link, a package that a linked
package imports (for example `@tanstack/query-core` from `@tanstack/react-query`) does not
resolve, its types become `any`, and the page gets false errors (TS7006). The probe confirms
this on the real page: with the `realpath` line of the language service host removed, the check
gives `skill-page.tsx:76 TS7006 Parameter 'skill' implicitly has an 'any' type`.

## The fix: a small pnpm layout in the temporary folder of the test

The test makes the same layout as pnpm, in the temporary root that the other tests of
`compileProblems` use:

- `node_modules/a` is a link to `node_modules/.pnpm/a@1.0.0/node_modules/a`;
- `a` re-exports a function from `b`: `export { each } from "b";`;
- `b` is reachable only from the real folder of `a`
  (`node_modules/.pnpm/a@1.0.0/node_modules/b`, a link to the folder of `b` in the store);
- `b` gives the function a typed callback: `each(f: (item: { size: number }) => void)`;
- `app/use.ts`: `import { each } from "a"; each((item) => item.size);`, and the break edits a
  text of that file to the same text.

The probe of this layout, with the code of `main`: the check gives no problem in about 300 ms.
With the `realpath` line removed, it gives
`C1-a: the break does not compile: app/use.ts:2 TS7006 Parameter 'item' implicitly has an 'any' type.`:
the same error, by the same cause, as the real page.

The test keeps the guard of DQ-613 (the edit must apply, or no compile runs): it asserts that the
find text is in the file once. It also removes the link to `b` and asserts the TS7006 error, so
the test shows that the layout depends on the second package (not claimed by the test name; a
check of the fixture).

No change to `scripts/lib/breaks-static.ts`, to the CLI, to `vitest.config.ts`, or to a time
limit.

Options not chosen:

- A longer time limit for this one test: the work can be smaller, so the rule of the task does not
  allow it.
- One language service for the two projects, or a shared `DocumentRegistry`: still two programs
  of the real frontend (about 3 s alone, about 20 s under the suite); no margin.
- Fewer root files (only the broken file and its imports): changes what the check compiles, and
  a global declaration in another file of the project can then give a false error. A change of
  the check, not of the test.

## The CI job `check:breaks static`

It does not run this test. Its step "Check the break list of the PR" took 3 s (#128), 1 s (#134)
and 6 s (#132), and each whole job about 16 to 19 s (GitHub step times). So the cost does not
slow the job, and this fix does not change the job. On the laptop, the CLI on old lists of the
frontend takes 20 s (`pr-124.json`, 38 breaks) and 31 s (`pr-121.json`, 28 breaks): each break
builds a new program and type-checks its file in each project, about 0.5 s each. That is the
cost of the check by its design, not the defect of this PR; it is not changed here.

## Test strategy

| Behaviour | Test | Proof |
| --- | --- | --- |
| The check reads the packages that pnpm links, with no false error on code that the break keeps | The changed test, on the small layout | Break: remove the `realpath` line of the host in `breaks-static.ts`; the test fails at its assertion with TS7006 (by hand in a scratch copy, as the test is changed after the code) |
| The test passes in the full suite with a clear margin | The time of the test alone and in three full `pnpm test` runs, each in the heavy slot | Before: 25.9 s and 32.0 s in the suite. Target: under 2 s in each full run (a margin of 10 times) |
| The static check still catches what it caught | `pnpm check:breaks:static` on the old proof commits of #128 (the DQ-439, DQ-448, DQ-515 and DQ-517 cases) | The same problems as #128's description; the library code does not change, so this is a regression check of the test change only |

No order or race case: the change is one synchronous test.

## Not claimed

- The real frontend layout is no longer in a unit test. A change of how the repository links its
  packages is seen by the CI job on each PR whose list breaks a frontend file, not by
  `pnpm test`.
- The time of the CLI on long lists (20 to 31 s on the laptop) does not change.
- The times are from this laptop, with other sessions running; CI was not measured for the test.
