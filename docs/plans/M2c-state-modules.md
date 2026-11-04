# M2c plans: Bot list and bot page edit state modules

> **Record, not spec.** Copied from [the description of #59](https://github.com/binhle312/cty1ng/pull/59) on 2026-11-04. The owning documents win where they differ ([index](README.md)).
>
> **Approval:** #59 calls both plans owner-approved on 2026-11-04. #59 merged on 2026-11-04.
>
> **Summary only:** no PR holds the full plans. This file has what #59 records about them, as built.

## Bot list state module (2026-11-04, owner-approved plan)

The cause of most review findings was four separate pieces of module state behind the bot list: the load count, the Always load values on their way, the Removes, and the held changes of `lib/api/optimistic.ts`. Each was right alone; the bugs were where two met. They are now one pure reducer.

| File | What it does |
| --- | --- |
| `features/bots/bot-list-state.ts` (pure) | The server value and the requests that wait, in send order. The page shows the server value with the requests put on it. A refused request leaves at once; a saved one goes into the server value and ends the older ones of the same pin, pinned order or sort. A pin answer goes in only while the page showed the expected pin and no load landed since it went out; an add sent during a Remove goes in also after a load |
| `features/bots/bot-list-store.ts` | One store per query client: sends each load into the reducer and writes what the page shows into the cache with `Query.setState` (the query keeps its status, error and age). The send helpers for Always load, Remove, pin changes, the pinned order, the sort and the Profile save answer |
| `features/bots/bot-order.ts` | The pure pin order helpers, now with object arguments (their `max-params` suppression is gone) |
| Deleted | `lib/api/optimistic.ts`, `features/bots/pin-answer.ts`, and their tests (their cases moved to the reducer and store tests) |

Tests:
- `bot-list-state.test.ts`: one test per rule (33).
- `bot-list-sequences.test.ts`: every order of two requests of a pin (with and without loads) and of two pinned or sort changes, and random orders from a seed against a model of the server: the server takes, refuses, fails or loses the answer, in any order; loads start and land at any time; another tab changes the server. Invariants at each step: a waiting Remove hides its row; the Always load switch shows the newest value on its way; with this page alone and no load, a pin with nothing on its way shows the server's pin; with loads, it shows a value the server had since the last load's snapshot; at the end, after a last load, the page shows the server and no request is left. A failure prints the seed and the steps. The generator is about 10 lines (mulberry32), so **no new dependency**.
- `bot-list-store.test.tsx`: the cache wiring, and the old `pin-answer.test` cases.
- Broken on purpose in five ways, the reducer failed the sequence test or a unit test each time.

Found and fixed by the sequence test (the old code had it too): Remove, then add the skill again; the server takes both and a load lands; the Remove answers before the add. The added row stayed hidden until the next load. Test: `bot-list-state.test` "shows the added pin when the Remove answers before the add and a load landed" (seen to fail first).

A fresh reviewer agent (code, not my conclusions) found no P1 or P2 in what the page shows. Its points, all fixed:

| Finding | Fix |
| --- | --- |
| P2 (tests): the "load in between" rule had no reducer-level test that could fail; two unit tests used an answer equal to the shown pin, and the sequence model only checked Remove | The tests now use a different pin (seen to fail with the rule off); the model checks that a pin shows a value the server had since the last load, also with another tab (4,000 random runs catch the rule switched off) |
| P3: the Always load value was not checked mid-run; lost answers and another tab in the order model were missing | Added to the model |
| P3: any other `setQueryData` on the bot list is dropped by the next store write | A lint rule (`no-restricted-syntax`) fails such a write outside the store; `frontend-conventions.md` §1 says it |
| P3: a store write turned a failed load into success | The store writes with `Query.setState`; `bot-list-store.test` "keeps the error of a failed load and the data's age when it writes" (seen to fail first) |
| P3: `bot-order.ts` took over three `max-params` suppressions | Object arguments; the entry is gone |

Behaviour differences from the old code, both toward the spec: a refused pinned change or sort goes back to the last value the server sent (this fixes the "Kept as is" sort item of the `571375a` round), and a saved Remove or add ends an older Always load change that has no answer yet. A pin, a pinned list and a sort have no version: when the server takes an older request after a newer one (requests that overtake each other), only the refresh after the answer shows it (`pin.md` §2, `bot-page.md` §7.1).

---

## Bot page edit state module (2026-11-04, owner-approved plan)

The Profile and Model edit rules (the table in `bot-page.md` §4.2) moved out of `BotView` into one pure reducer. `BotView` lost 9 `useState`s, 4 refs, the adoption during render and the `mounted` ref. It now sends events and renders what the module computes.

| File | What it does |
| --- | --- |
| `features/bots/bot-edit-state.ts` (pure) | The form, the saved values, the base `row_version` of each tab, the Save on its way (with an id), stale marks, server errors and toasts. `editView` computes the changed and unsaved fields, the conflict, the field errors, the save bar state and what Save does |
| `features/bots/bot-edit-store.ts` | The state of one bot page outside React (`useSyncExternalStore`). A late answer changes the state as it is now, a failure toast shows at once, and leaving the page lets both tabs go |
| `frontend/test/sequences.ts` | The every-order and random-order drivers, moved out of `bot-list-sequences.test.ts`; both sequence tests use them |

Tests:
- `bot-edit-state.test.ts`: one `describe` for each row of §4.2 and one test for each cell (56 tests).
- `bot-edit-sequences.test.ts`: every order of a Save, its answer (saved, stale, `name_taken`, failed), another place (it changes the name, the limit or the description), loads that land in any order or fail, Discard, and typing; also random orders from a seed. Invariants after each step: a dropped edit never comes back, the values a tab started from are the server's at its base, a conflict shows only when another place changed the bot after the tab's base, Save is off in a conflict, at most one Save waits, text that differs from the sent text is unsaved, and each failure shows its toast, conflict or field error. After the run, a conflict shows exactly when another place changed the bot.
- `bot-edit-store.test.ts`: toasts, listeners, and a change of the tool rules.
- `bot-page.test.tsx` and the e2e tests pass with no change. One page test is new: "shows the toast of a Save that fails after the bot left the list" (no test held that cell before).
- Broken on purpose in 16 ways, the reducer failed a unit test each time, and the sequence test 12 times. The other 4 are inputs that the model never makes (an answer of another Save, a second `saveSent`).

Two fresh reviewer agents read the code, not my conclusions. Their points, all fixed, each with a test seen to fail first:

| Finding | Fix |
| --- | --- |
| A failure toast was lost when the failure and the unmount came in one render batch (shown with a React repro) | The store shows toasts inside `dispatch`; the unmount sends a let-go in a layout cleanup, so a late failure is a "lost" toast |
| Answers had no Save id; a double Ctrl+S before a render could send two requests | Each Save has an id and an answer of another Save changes nothing; `save()` reads the newest state |
| A let-go after the Save answered, before its event came, moved the tab back to the older `row_version`, and a false conflict showed later (found by the sequence test) | `saveAnswered` carries the bot of the answer, and the module takes it as the server bot |
| A change of the tool catalog did not let a tab take newer values | The event `rulesChanged` |
| A 409 left the other tab's Save on, so it got a 409 too; also after a let-go | Every tab at the base of a refused Save is in conflict while it has changes (`bot-page.md` §4.2) |
| Some cells had no test, and some sequence checks could not fail | The tests above; the sequence model checks toasts, conflicts and field errors |

Behaviour differences from the old code: the 409 rule above; the server bot only moves forward, so an older list that lands after a newer one no longer hides a conflict, and Discard loads the newest values; a toast uses the bot's newest name.
