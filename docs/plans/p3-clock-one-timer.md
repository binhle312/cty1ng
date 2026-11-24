# Check that the app keeps one clock timer (DQ-537)

Brief: the owner's answer of 2026-11-18 (q5 Q4, choice "A"): "Keep §1 as it is and add a check: a test (or lint rule) fails when `createClock` is called anywhere but `appClock` in now.ts. A small PR with a plan; it closes DQ-537."
Checkpoint: none beyond the owner's answer (one new test file; no shared state, no module boundary, no screen, no migration, no public API, no new dependency)
Approval: lead agent, 2026-11-18, against the owner's answer q5 Q4 A (the owner chose the check; the choice of a test over a lint rule is the builder's); owner review pending

## The cause

`docs/design/components/time-format.md` §1 says: "The frontend keeps one timer for all of them
(`frontend/src/lib/now.ts`)." Today this is true: `createClock` is called once outside the tests,
in `now.ts` (`export const appClock = createClock()`). The test "three subscribers share one
timer" holds the rule for the readers of one clock. Nothing stops a second `createClock()` call, and
a second clock is a second timer, so the sentence of §1 would become false with no sign (DQ-537).
The owner keeps §1 as it is and asks for a check.

## The check

A test fails when a non-test file of `frontend/src/` uses the name `createClock` anywhere but in two
places of `frontend/src/lib/now.ts`: the declaration of the function, and the one call that is the
value of the top-level `const appClock` (a clock made in a function would be made again at each
call). Test files may call `createClock` (`now.test.ts` makes its own clocks).

The test reads the files as syntax trees with the TypeScript compiler (`ts.createSourceFile`, no
program), which is already a dev dependency of the root package. It looks at the name, not at the
call: an import, an alias (`import { createClock as c }`), a re-export, a property of a namespace
import (`n.createClock`) and `n["createClock"]`, `Reflect.get(n, "createClock")` and a string key in a destructuring all fail:
any string with that text counts. Comments are not code and do not fail.

The check is stricter than "called" in the owner's words: an alias or a re-export is a way to call the function, and a check on calls alone passes it.

Why name and not call: a rule that sees only the call `createClock()` passes
`import { createClock as c }` followed by `c()`. Any other code that uses the name
`createClock` (a function, a variable, a key) fails too. Its fix is to rename it.

## Lint rule or test (the choice)

Recommended: **a test**, `scripts/one-clock.test.ts`, in the Node project of `pnpm test`.

| Option | Gain | Cost |
| --- | --- | --- |
| Lint rule (`no-restricted-syntax` selector for `CallExpression[callee.name='createClock']`) | Shows at lint time and in the editor | Sees only a call by its own name: an alias or a namespace passes. In `now.ts` it must tell the allowed call from another call in the same file, so the selector needs a `:not(…)` form. Each block of `eslint.config.js` that sets `no-restricted-syntax` must list it ("the last block wins"; the comment in `scripts/lint-rules.test.ts` names a review where `bot-list-store.ts` lost rules), so it adds one more case to "each file gets its rule sets" |
| Test (recommended) | One file, no link to the ESLint block order. Checks the name, so aliases fail. A test of the checker with small snippets proves that it fails, as `lint-rules.test.ts` does for the lint rules | Runs in `pnpm test` (CI), not in `pnpm lint` or the editor, so a developer sees it later |

## Test strategy (before code)

TDD: write the tests first and record their red run. Level: unit (Node project). One claim in each
test name.

The checker is a function `clockNameUses(path, text)` inside the test file. It returns the places
of the name that the rule does not allow. Snippet tests give it a path and a text:

| Case | Expected |
| --- | --- |
| A second call in `lib/now.ts` (`export const other = createClock();`) | rejected |
| A call in a feature file | rejected |
| An aliased import (`import { createClock as c }`) | rejected |
| A property of a namespace import (`n.createClock()`) | rejected |
| `n["createClock"]`, a string key in a destructuring, a computed key, `Reflect.get(n, "createClock")`, a string name in an import specifier | rejected |
| `const appClock = createClock();` inside a function in `lib/now.ts` | rejected (only the top-level `const` counts) |
| A re-export (`export { createClock } from "./now.ts"`) | rejected |
| `export const appClock = createClock();` in another file than `lib/now.ts` | rejected (the path counts, not the name of the value) |
| `export const appClock2 = createClock();` in `lib/now.ts` | rejected (only the value `appClock` counts) |
| `lib/now.ts` as it is (declaration and the `appClock` call) | allowed |
| A call in `foo.test.ts` and in `foo.test.tsx` | allowed |
| A comment that names `createClock` | allowed |

Test of the tree: the checker runs on each non-test file of `frontend/src/` (the generated client is
skipped) and finds no use. Two guards stop a pass with nothing read: the test finds more than 100
files (as `lint-rules.test.ts` does), and `lib/now.ts` has exactly one allowed call.

Red run (the PR description records it):

1. The snippet tests fail on a stub checker that finds nothing (before the code).
2. The tree test fails when I add a second `createClock()` call to a non-test file.
3. The tree test fails when I add a second call to `lib/now.ts`.
4. The two guard tests fail when the glob reads a folder that does not exist.
5. The "allows" tests fail on a checker that forbids every text `createClock`, comments included.
6. The cases that a review adds fail on the checker that came before them.

I remove the added lines after each run.

Break list: not needed (`docs/testing.md` §5: not a late, security or order test). The PR still has
`scripts/breaks/pr-<n>.json`, with every new test in `exempt`; each reason names its red run, so that
`check:breaks static` passes (#136). No break runs.

## Files

- `scripts/one-clock.test.ts` (new): the checker and its tests.
- `frontend/src/lib/now.ts`: one comment line names the test as the check of "one clock" (a comment
  with a check behind it, `frontend-conventions.md` §1). No code change.
- `docs/frontend-conventions.md` §1, row "The time now comes from `useNow()`": one sentence says
  that a test fails on a second `createClock` use, and what it does not see (a timer that `createClock` does not make, a name built at run time).
- `docs/design/components/time-format.md` §1: **not changed** (the owner keeps it).
- `docs/plans/README.md`: the row of this plan. `docs/status.md`: the line of this PR.
- `docs/delivery-quality.md` (records step): DQ-537 `fixed`, the rows of this PR (DQ-821 to DQ-840
  only), the counts.
- Guide (`seed/skills/using-the-app/SKILL.md`): not changed. The owner sees no change.

## Not claimed

- A second timer that `createClock` does not make and that `setInterval` does not start (revision 3
  below): a copy of the clock under another name, a `setTimeout` loop. The check holds one use of
  the name `createClock` and no `setInterval` outside `lib/now.ts`, not "no other timer".
- That the readers of `appClock` share one timer: the test "three subscribers share one timer"
  holds that, as before.
- A use of the function through a name that the code builds at run time (`n[key]`,
  `"create" + "Clock"`) or a dynamic `import()` with a computed key.
- A second copy of `now.ts` in memory (an import with a query string, or a reload of the module in
  development): it makes a second clock with no use of the name `createClock`.
- A use outside `frontend/src/`, and a use in a test file (allowed).
- Feedback at lint time or in the editor: the check runs in `pnpm test`.

## Revision 3 (2026-11-19): `setInterval` outside `lib/now.ts`

Brief: the owner's answer of 2026-11-19 (morning page, Q2, choice "B"): accept the fix of da1ed3c
and also fail the test when frontend code calls `setInterval` outside now.ts. It is built in #138
before its merge (plan revision, test first, one review check), and then the lead agent merges #138.
Approval: lead agent, 2026-11-19, against the owner's answer Q2 B (one change: the lead agent locks the
scope to the owner's words, so any use of `setInterval` inside `lib/now.ts` is allowed); owner review pending

### The cause

The first revision does not see a timer that `createClock` does not make, such as a `setInterval` in
a component (the first "Not claimed" line). Such a timer is a second timer, and the sentence of
`time-format.md` §1 would be false with no sign. Today `setInterval` occurs only in `lib/now.ts` in
the non-test code of `frontend/src/` (line 30 as a type, line 50 as the one call; `grep`, head `5e43585`).

### The check

The same test file, the same walk of the tree. A non-test file of `frontend/src/` fails when it uses
the name `setInterval` anywhere but in `frontend/src/lib/now.ts`. Any use inside `lib/now.ts` is
allowed: the check does not count the calls there and does not look at their place (scope lock of the
owner's words; the single call of `createClock` stays held by the one-clock rule and by the test
"three subscribers share one timer").

The check reads the name, as for `createClock`, and so it is stricter than "calls": an identifier
or a string with that text counts. `window.setInterval`, `globalThis.setInterval`, `self.setInterval`,
`window["setInterval"]`, an alias (`const make = setInterval`), a key in a destructuring,
`Reflect.get(window, "setInterval")`, an import specifier (`import { setInterval } from "node:timers"`)
and `typeof setInterval` in another file all fail. Not names of the rule: `setTimeout`,
`clearInterval`, `requestAnimationFrame`, a comment, and a test file (`*.test.ts`, `*.test.tsx`).

The result of the checker gets a second counter, `intervalCalls`: the calls `setInterval(…)` (the
callee is the identifier) in `lib/now.ts`. A guard in the tree test asserts that it is at least 1: a
renamed or moved timer would leave 0 and the check would pass with nothing to hold.

### Test strategy (before code)

TDD, unit level, one claim in each test name. New snippet cases (a path and a text):

| Case | Expected |
| --- | --- |
| `setInterval(…)` in a feature file | rejected |
| `window.setInterval(…)`, `globalThis.setInterval(…)`, `self.setInterval(…)` | rejected |
| `window["setInterval"](…)` | rejected |
| An alias: `const make = setInterval;` | rejected |
| A string key in a destructuring: `const { "setInterval": make } = window;` | rejected |
| `Reflect.get(window, "setInterval")` | rejected |
| `import { setInterval } from "node:timers";` | rejected |
| `ReturnType<typeof setInterval>` in another file than `lib/now.ts` | rejected |
| `setInterval(…)` in `lib/now.ts`, also a second one and one outside a function | allowed (counted in `intervalCalls`) |
| `setTimeout(…)` and `clearInterval(…)` in a feature file | allowed |
| A comment that names `setInterval` | allowed |
| A call in `foo.test.ts` and in `foo.test.tsx` | allowed |

Tree tests: "makes one clock" also covers `setInterval`, and a new guard "has a setInterval call in
lib/now.ts" asserts `intervalCalls` is at least 1.

Red runs (the PR description records them; I remove the added lines after each run):

1. The new snippet cases that reject fail on the checker of `5e43585` (it does not read the name `setInterval`).
2. The tree test fails when I add `setInterval(…)` to a non-test file (`lib/log.ts`).
3. The new guard fails when the call in `lib/now.ts` is written `window.setInterval` (the plain call is gone), and when the glob reads a folder that does not exist.
4. The new "allows" cases fail on a checker that forbids every text `setInterval` (comments and `lib/now.ts` included), on a checker that forbids `setTimeout` in place of `setInterval`, or on a checker that does not skip test files.
5. A case that a review adds fails on the checker before it.

Break list: not needed (`docs/testing.md` §5). Each new test goes into `exempt` of
`scripts/breaks/pr-138.json`; each reason names its red run.

### Files

`scripts/one-clock.test.ts`, this plan, the sentence of `docs/frontend-conventions.md` §1 that says
the test does not see a `setInterval` in a component, `scripts/breaks/pr-138.json`,
`docs/delivery-quality.md`, `docs/status.md`. Not changed: `lib/now.ts`, `time-format.md` §1,
product code, the Guide ("Guide: not changed": the owner sees no change).

### Not claimed (revision 3)

- A second timer made inside `lib/now.ts`: any use of `setInterval` there is allowed.
- A `setTimeout` loop (a timer that starts itself again), `requestAnimationFrame`, a Web Worker and
  its timer, and a timer inside a library. `setTimeout` is used today for one-shot waits
  (`skeleton.tsx`, `pinned-sort.tsx`, `realtime/start.ts`) and stays allowed.
- A name that the code builds at run time (`window["set" + "Interval"]`).
- A call through an alias that `lib/now.ts` exports (`export const every = setInterval;`, then `every(…)` in another file): any use of the name is allowed in `lib/now.ts`.
- A `.mts` or `.cts` file in `frontend/src/`: the glob reads `.ts` and `.tsx` files only (none exists today).
- A use outside `frontend/src/` (`frontend/index.html`, `public/`), and a use in a test file.
- That the readers of `appClock` share one timer: the test "three subscribers share one timer".
