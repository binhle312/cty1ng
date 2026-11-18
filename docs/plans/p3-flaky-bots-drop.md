# P3 fix: the flaky e2e test of the pinned card drop line

Brief: the chief's task of 2026-11-18. The test `bots.spec.ts:101` "the keyboard moves a pinned card and the drop line shows" failed once in CI run 44228267962 (PR #124, head `3dfb86b`, attempt 1), then passed on the retry. No ledger row names it (searched `docs/delivery-quality.md` on `main` and all origin branches).
Checkpoint: none. There is no new screen, no new text and no code design. The fix is a behaviour fix inside the existing keyboard move (`pin.md` §2).
Approval: plan OK by the chief agent, 2026-11-18 (owner rule: fix the flaky test at its cause). Revision 2 adds the chief's three conditions: a guard test of the private parts, a fallback to dnd-kit's own behaviour, and the upstream search (section 3).
Revision 3, 2026-11-18: the review round 1 changes of §3 and §4 item 5, approved by the chief agent; owner review pending.

## 1. Evidence

Base: `origin/main` = `1dd7a01` for the runs, then `6a43404` after a fast-forward (no frontend change between them). Logs are in `tmp/worktrees/flaky-bots-drop/`.

| What | Result |
| --- | --- |
| CI trace, attempt 1 | After Space, the drag started: the overlay shows, and the live region says "First juf44 moves to place 1 of 2.". ArrowRight came 3 ms after the Space press ended (trace 143.772 s, then 143.775 s). After ArrowRight, the DOM did not change for 5 s. The bots stayed pinned: the trace DOM at the failure shows "pinned, 1 of 2" and "2 of 2". The `error-context.md` snapshot shows no pins, but it was taken after `afterEach` unpinned them, so it misleads. |
| dnd-kit code | `@dnd-kit/core` 6.3.1, `KeyboardSensor.attach()` (`core.esm.js:1158`): `setTimeout(() => this.listeners.add('keydown', this.handleKeyDown))`. The sensor hears arrow keys only one task after the pick-up key. The overlay, the gap and the live region all come from the Space task, before that timer. So no sign on the page shows that the sensor listens. |
| The real test, 30 runs, no load | 30 passed |
| The real test, 60 runs, 16 busy processes | 60 passed |
| Probe P4: real keys (Space down, Space up, ArrowRight down) sent together, so they reach the browser while the Space task runs, 30 runs | **19 failed**, 11 passed. The drop line did not show: the arrow key was lost. |
| Probe G: a synthetic arrow sent to the focused element 0 to 50 ms after Space (40 runs) | 40 moved. An arrow that comes after dnd-kit's timer always works. |
| Prototype unit test (jsdom, scratch): Space with React flushed after the key, then ArrowRight at once | On `6a43404`: the arrow is lost (over stays on the first item). With a prototype of the fix in section 3: passes. Control, ArrowRight after one zero timer: passes on both. |
| Probe P2: time from the Space keydown to the end of its task and dnd-kit's timer (10 runs) | 14.5 to 25.7 ms (the render of the pick-up). |

## 2. Cause: (b), the app

The first wrong decision: the keyboard sensor that `drag-setup.ts` chooses for every drag (Bots page, bot page side list, header roster) starts to listen for keys one task after the pick-up key. A key that the browser already holds when the Space task ends can be lost: Chrome can run a held key before that timer (P4: 19 of 30; in probe P3 the timer ran first, 10 of 10).

A person can be in that state. The window is the time of the Space task: 15 to 26 ms on this 16-thread laptop with no load, and longer on a slower machine or a long list. Rule (one sentence): each key that comes after the pick-up key goes to the drag, in order, however soon it comes.

The test only presses keys faster than a person usually does. It reads nothing too early, and it has no fixed wait. A test fix would have to wait for a sign that does not exist (section 1, "dnd-kit code"). A zero-delay timer in the page would work, but then the test would hide a real lost key.

Search scope: every `useSensor` in `frontend/src` (one place: `drag-setup.ts`). The mouse and touch sensors add their listeners at once (`core.esm.js:1425-1449`; their only `setTimeout` is the touch delay by design). The e2e keyboard drags: only `bots.spec.ts:116`. The unit test that presses Space (`bot-page.test.tsx:1759`) waits 50 ms after each key, so it does not see the bug.

## 3. Fix

In `frontend/src/features/bots/drag-setup.ts`, `useDragSensors` uses a keyboard sensor that is dnd-kit's `KeyboardSensor` with one change. It adds its keydown listener at once and skips only the event that started the drag. (That same event still bubbles to `document`, so without the skip, Space would drop the item at once. This is why dnd-kit waits a task.)

- A subclass, `AtOnceKeyboardSensor`, replaces `attach` and gets dnd-kit's private parts (`handleStart`, `handleKeyDown`, `handleCancel`, `listeners.add`, `windowListeners.add`, `props.event`) through `Reflect.get` with a type check. The lint rule forbids `as` casts. A code comment says why the subclass exists: the lost key, dnd-kit 6.3.1, `core.esm.js:1154-1159`.
- If a part is missing or is not a function at run time (a dnd-kit update renamed it), the sensor falls back to dnd-kit's own `attach`: the keyboard drag works as before, with the lost key. It does not throw.
- A guard test builds the sensor on the installed `@dnd-kit/core` and fails with the name of each missing part. So a Dependabot bump that renames a part fails `pnpm test`, not silently. A second test compares the installed `attach` with the 6.3.1 body, so an update that changes `attach` also fails `pnpm test`. This check is in the test only: the production build minifies dnd-kit, so the text cannot be compared at run time.
- The new listener is in `this.listeners`, so dnd-kit's `detach` removes it as before. There is no timer, so no listener can come after the drag ended.
- The new text, the screen and the keys are not changed. Esc, the Space drop, Alt+arrows, the mouse and touch work as before.

Upstream (searched 2026-11-18 with `gh search issues --repo clauderic/dnd-kit`: "KeyboardSensor setTimeout", "keyboard sensor keydown lost", "KeyboardSensor first keydown", "keyboard sensor arrow ignored", "KeyboardSensor", "keyboard sensor"): no issue names this lost key. 6.3.1 is the newest `@dnd-kit/core` on npm (`npm view @dnd-kit/core versions`). The rewrite `@dnd-kit/dom` on upstream `main` has a different API; I did not check its timing, and moving to it is not a fix for this PR.

Rejected: (1) a `pnpm patch` of `@dnd-kit/core`. It is the same change, but in three built files, one of them minified. It is a dependency change for the owner, and each Dependabot bump of dnd-kit fails until the patch is updated. (2) A test-only fix, see section 2.

## 4. Test strategy (test first)

1. **Unit, red first**: `frontend/src/features/bots/drag-setup.test.tsx`. Render a `DndContext` with `useDragSensors()` and two sortable items, with fixed rectangles (jsdom has no layout). Press Space on the first item with the browser's order, so React finishes its work after the key, as `pressKey` does. Then press ArrowRight at once, before any timer. Expect the drag to be over the second item. On `main` it must fail (the arrow is lost). Then add the fix: green.
2. Unit: the Space that picks up does not drop. After the pick-up, the drag is still active, and a later Space drops it on the item it is over (`onDragEnd` once, with the right `over`).
3. Unit: Esc right after the pick-up cancels (`onDragCancel` once).
4. Unit: after the drag ends, the sensor leaves no keydown listener on `document` (the adds and removes of `keydown` on `document` balance).
5. Unit, guard: each private part that the sensor uses is on the installed dnd-kit sensor, with the right type, and the installed `attach` is the 6.3.1 body. A sensor with a missing part falls back, through the real prototype `attach`, to dnd-kit's own `attach`: dnd-kit's `onStart` runs, and its `keydown` listener comes after one timer.
6. The e2e test `bots.spec.ts:101` does not change.
7. **Repeat runs after the fix** (e2e slot): the real test with `--repeat-each=100` under the same CPU load (16 busy processes), and probe P4 with `--repeat-each=100`. Both must pass all runs. Before the fix, P4 failed 19 of 30.
8. Break list `scripts/breaks/pr-<n>.json` (an order test): each unit claim gets a break in `drag-setup.ts` (back to dnd-kit's own `KeyboardSensor`; no skip of the start event; no listener removal on detach where the claim needs it). Run with `TMPDIR=/home/binh/projects/personal/cty1ng-breaks-tmp/flaky-bots-drop`.
9. Gates: lint, typecheck, check:index, check:events, the touched tests; then, in the heavy slot, `pnpm test`, build + check:bundle, check:breaks.

## 5. Docs

- `frontend/src/features/bots/README.md`: the new test file, and the changed purpose of `drag-setup.ts`.
- `pin.md` and the Guide do not change: the keys and the result are as written. A key that was lost now works. Guide: not changed, because no Guide sentence becomes false and there is no new page, command, action or choice.
- Records turn: ledger rows (DQ-671 up), register, round rows, `docs/status.md`.

## 6. Not claimed

- The real test never failed on this laptop (0 of 90). The red run before the fix is probe P4 (19 of 30) and the unit test, not the real test.
- Why a key that comes during a later long task (probe P3: a 200 ms task after Space, keys 60 ms after Space) passed 10 of 10. Chrome ran dnd-kit's timer first there. I did not find which Chrome rule decides this order.
- Browsers other than Chromium: not run.
- The CI run itself does not show why its ArrowRight came before the timer. The trace shows only that the key had no effect while the drag was active.

