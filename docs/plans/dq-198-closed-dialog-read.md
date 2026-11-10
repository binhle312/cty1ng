# DQ-198: a closed dialog and the read of all data

Brief: DQ-198 in [delivery-quality.md](../delivery-quality.md), found by the owner's reviewer on [#91](https://github.com/binhle312/cty1ng/pull/91)
Checkpoint: owner decision (`AGENTS.md` §9: the cause of DQ-197)
Approval: owner, 2026-11-10: "You can ignore reviewer's recommendation if you think you have a better solution for it"

This PR is built on the branch of #91, because `read-all.ts` is new there. It merges after #91.

## Defect

1. The owner opens Add skills on a bot. The first read of the skill list starts.
2. The owner closes the dialog before the answer. The query is turned off, and the read continues.
3. A `reset` arrives, or the tab returns and a new stream becomes live. The tab reads all data again.
4. The owner opens Add skills again before the old answer arrives.
5. The old answer arrives. The dialog shows it, with a good status. A skill that was made before
   step 3 and after the read of step 1 is missing, and no event brings it.

The same on `main`, for `reset`. Probe on the real library, on `7deee2e`: one read, and the data
is the old answer, for `readAll` and for `invalidateQueries()` alone. The owner's reviewer has the
same result. The full order in a browser was not run by the reviewer or by the builder.

## Cause

- The rule (`realtime-events.md` §3, rule 4): after a `reset` or the `ready` of a new stream,
  each answer that a page shows comes from a read that started after that point.
- `readAll` (DQ-197) cuts the first reads of **active** queries only, and
  `invalidateQueries()` starts new reads for active queries only. A query whose observers are
  all turned off (`enabled: false`) is not active.
- TanStack Query reuses a first read that is on its way when the query is turned on again
  (`fetch` in `query.js`), and the good answer clears the stale mark.

Same cause as DQ-197: `readAll` does not cover each read. So this fix has its own PR and plan.

## Design

`readAll` stays the one owner of "read all data again". It gets one more step.

| A first read that is on its way | What `readAll` does | Then |
| --- | --- | --- |
| The query is active (a page shows it) | Cuts it, silent (DQ-197) | `invalidateQueries()` starts a new read; the code that waits gets its answer |
| The query has observers, and all are turned off (a closed dialog) | **New: cuts it, with a revert** | No read starts now. The query is back at "no read", so it reads when it is turned on again. If it stays off, nothing is read |
| The query has no observer (code that asks the query client directly) | Nothing, as before | The caller gets the answer of its own read. The two callers in the app use `readNewest`, and they use the answer one time |

Why a revert and not a silent cut for the second row: a silent cut gives the waiting code the
promise of the next read, and no next read starts for a query that is turned off. A revert puts
the query back in the state from before the read, with no error on the page.

Options compared:

| Option | Gain | Cost |
| --- | --- | --- |
| **Cut with a revert, only for queries with observers** (chosen) | About 10 lines in one function. No caller gets an error | The third row stays as it is |
| Cut each first read, also with no observer | One rule for all | Code that asks the query client directly gets a `CancelledError` at that moment. Each such caller must then use `readNewest`; a new caller can forget it |
| Mark the old answer stale when it arrives (a watcher on the cache) | Nothing is cut | A new mechanism with its own life, and the old answer still shows for a moment |

## Test strategy

Each test is written before the code and fails on the code of #91 (`172cc8a`).

| Behaviour | Level | Case |
| --- | --- | --- |
| A turned-off query with a first read on its way reads again when it is turned on, and the old answer does not reach the cache | Unit, real library, `read-all.test.ts` | **A late answer**: the old answer arrives after the new read started |
| The same query, when it stays off: the old answer does not reach the cache, and no read is on its way | Unit, real library | The dialog stays closed |
| A read with no observer is not cut: its caller gets its answer | Unit, real library | The third row of the table; a rule to keep |
| Add skills shows the new list when it opens again after a full read | Component, `bot-page.test.tsx`, the real dialog | The order of "Defect", with a held answer |

Each is an order test, so each has a break in `scripts/breaks/pr-<n>.json`.

Not covered: a browser test of the full order. The component test uses the real dialog, the real
query client and `readAll`; a browser adds the real stream, which #91 already tests.
