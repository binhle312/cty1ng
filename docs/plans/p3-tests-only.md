# P3 PR 18: tests only (items 70, 71, 72)

Brief: items 70, 71 and 72 of the P3 list before M3 (owner-approved list of 2026-11-12, PR 18 "Tests only"); DQ-115 in [delivery-quality.md](../delivery-quality.md)
Checkpoint: none (tests only; the list's approval column says "none")
Approval: lead agent, 2026-11-15, under the owner's order of 2026-11-14 (P3 questions to consultants); accepted by the owner, 2026-11-15

Tests only: no product code changes.

## Item 70: the fixed waits in end-to-end tests

Seven `page.waitForTimeout` calls wait for a fixed time. Most of them come before a check that
something did not happen. On a slow machine the time can be too short, and then the test passes
without a real check.

| Place | What the test checks | New wait |
| --- | --- | --- |
| `bots.spec.ts:307` | After the late answer to upload A, B's crop card stays open and A is not chosen (`crop-card.tsx`, `closed.current`) | `pageIsQuiet` |
| `bots.spec.ts:496` | A drop below the header sends no pin save | `pageIsQuiet` |
| `bots.spec.ts:534` | A long press (300 ms, `drag-setup.ts`) starts a drag | Wait for a live region (`role="status"`) that contains the bot's name. dnd-kit writes it at each drag step, from `onDragStart` on (revision 2) |
| `skills.spec.ts:872` | After the 4th failed list read, the editor and its text stay | `pageIsQuiet`, after the existing count `failures >= 4` |
| `skills.spec.ts:1029`, `:1031` | No more settings requests come: the page does not loop | Kept. The time window is the check itself. A loop that waits on retry timers has no open request, so no signal can replace the window |
| `stream-life.spec.ts:166` | After the read that follows `ready`, the Clone draft stays | `pageIsQuiet`. After the list read, the clone source reads each skill's versions one by one, so "list read + 500 ms" was weak |

The new helper is `frontend/test/e2e/quiet.ts`:

- `watchRequests(page)` wraps the page's `fetch` before the app loads. It counts the requests
  that started and the requests that are still open. A request stays open until its body is
  read (from a clone) or until it fails.
- `pageIsQuiet(page)` waits until no request is open and none starts during some turns of the
  page's event loop, two times in a row. This is the end-to-end form of the wait in `heldAnswer`
  (DQ-110). It measures no wall-clock time.

The stream uses an EventSource, so the helper does not count it. During a retry delay no request
is open, so a test with retries first waits for their count.

## Item 71: `heldAnswer` and the query client (DQ-115)

`watchQueryClient` puts the client in module state. Nothing clears or checks that state. The fix:

- `frontend/test/setup.ts` forgets the client after each test.
- `answer` throws a clear error when the test set no client.

The callers are 136 `heldAnswer()` calls in 8 test files. The signature stays the same. New tests in
`frontend/test/fake-api.test.ts` show the behaviour. `vitest.config.ts` gets one include line for
`frontend/test/**/*.test.{ts,tsx}`, which is outside the listed scope and is flagged.

## Item 72: time limits in two unit tests

Measured on `97221d3` (16 cores):

- Full `pnpm test`: the 1 MB test took 508 ms against its 1,000 ms limit. The sequence tests took
  up to 11,919 ms against 30 s.
- Probe alone: the 1 MB test took 35 ms.
- Probe with 24 busy loops: the fastest of 3 runs took 45 to 148 ms, and one run 61 to 211 ms.
- A growth ratio (time for 4N / time for N) was 2.7 to 12.0 under load. A linear scan gives 4 and
  the old quadratic bug 16, so this measure was rejected.

- `sensitive-data.rules.test.ts:50-55`: the 1 s limit stays as the guard. The test measures the
  fastest of up to 3 runs. A burst of load slows one run, but a quadratic scan is slow on every
  run. Margin: 1,000 ms against 148 ms (6.7x).
- `bot-edit-sequences.test.ts`: a count replaces the time measure. Each `everyOrder` test asserts
  its exact number of paths, and `randomOrders` has a fixed count of runs and steps. So the count
  guards the size of the work, not the time. The describe timeout only stops a hang: 60 s, 5x the
  worst full-run time (11.9 s).

Not claimed: the second timed test in `sensitive-data.rules.test.ts` (`:422`, 48 lines, 2.3 s in
total in the full run) has the same cause. It is not on the P3 row, so it is not changed here.

## Proofs

- Item 70 tests are late or order tests. `scripts/breaks/pr-<n>.json` has one break in product code for each
  changed test.
- Item 71: a red run of the new helper tests on the old `fake-api.ts`. The break runner refuses
  breaks in `test/`.
- Item 72: red runs with a temporary break in product code (a slow scan) and in the model depth.

## Risks

- Other tests share the server and can make the page read again and again, so the page may not
  get quiet. The wait then times out: a loud failure, not a false pass. E2e runs two times.
- dnd-kit hides the live region visually, so the test checks its text and does not check that it
  is visible.
- The exact path counts need an update when a model changes on purpose.
- #107 rewrites the break runner. If #107 merges first, the records turn runs the report again.

## Revision 2 (2026-11-15, after e2e run 1 and review round 1)

- The long-press wait: dnd-kit replaces `Picked up <name>.` at once with the text for the place
  under the finger, so e2e run 1 on `502d539` failed (`6bab70c` is the fix). Every drag announcement names the bot, so the
  test waits for a live region with the bot's name. Review round 1 checked that no element with
  `role="status"` and the name can show before the drag starts.
- `pageIsQuiet` does its two quiet checks in one call (review round 1, R1-3).
