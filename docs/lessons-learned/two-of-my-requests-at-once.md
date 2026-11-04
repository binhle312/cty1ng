# Check two of the screen's own requests that wait at once, and every list state

Date: 2026-11-03 · Source: M2c, PR #59 · Status: applied

**Observed.** The review of `571375a` found three P2 problems and one P3, after the five order
questions (`check-every-order-before-the-push.md`) were in. Two came from two requests of the
same screen that waited at the same time: the answer of an Always load change sent before a
Remove ended that Remove, so the row came back while the Remove waited; and when two pin
changes both failed, the newer one went back only to the older one's value, so a refused unpin
stayed on the page. The other two were list states: a failed bot list showed the upgrade card
empty with no error, and + Add showed a loading line in place of shapes. The owner asked why
each round still finds new problems.

**Cause.**
- The five questions take one request at a time, against the server or the page. None asks what
  a second request of the same screen does to the first: an older one of another kind on the
  same thing, or a second one of the same kind, with each outcome in each order.
- `571375a` fixed the reported order (Remove fails, the refresh fails) and tested only it. A
  table of the pairs would have shown the second failure of the same mechanism.
- Each hold, count and value on its way lives in its own module map. The rules are right alone;
  the bugs are where two meet. The pure state module that `state-table-before-stateful-code.md`
  asks for is still not built.
- The list states rule (`requirements/README.md`) had no check step: `data ?? []` and a loading
  line passed every test, because no test held the load open or made it fail.

**Change.**
- A sixth order question: another request of the same screen waits too. Does each answer end
  only what its own request started, and do two refusals leave the server's value on the page?
  (`../workflow.md` §2 step 4).
- Before the push, every query read on the changed screens is checked for its loading, error
  and empty states, with a test that holds the load and one that fails it (`../workflow.md` §2
  step 4).
- The bot page state module (one pure reducer for the server value and the requests that wait)
  is the next step on this branch, with sequence tests against a simple model of the server.

**Fixes of this round.** A Remove ends only for a request sent while it waited
(`markPinSend`); a refused change goes back past the changes that still wait
(`lib/api/optimistic.ts`); the after-save cards and the pin cards show shapes and Try again.
Each has a test that failed first.

**Rule now in.** `../workflow.md` §2 step 4.

**Applied (2026-11-04).** The four module maps (the load count, the Always load values, the
Removes, the held changes of `lib/api/optimistic.ts`) became one pure reducer,
`frontend/src/features/bots/bot-list-state.ts`, with the bot list store beside it. The page
computes what it shows from the server value and the requests that wait; a refused request
leaves, and a saved one ends the older ones of the same thing. `bot-list-sequences.test.ts` runs
every order of two requests of a pin, and random orders against a model of the server with
loads, failures, lost answers and another tab. It found one bug that the old code had too: an
add sent during a Remove stayed hidden when the Remove answered first and a load had landed.
Broken on purpose in five ways, the reducer fails the sequence test or a unit test each time; a
fresh reviewer agent's check of the first version found the invariants too weak (a late answer
after a newer load), and they now check that a pin shows a value the server had since the last
load. Only the bot list store writes the bot list and the settings (lint rule).
