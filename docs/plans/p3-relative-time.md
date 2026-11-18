# P3 list PR 17: relative times that update

Brief: P3 list of 2026-11-12, part 5, PR 17, item 67 (`docs/status.md` Follow-ups, review of #94)
Checkpoint: plan (code design: shared state in a new module `lib/now.ts`)
Approval: the owner, 2026-11-15 ("P-17: approve", revision 3). The answers of Q1 and Q2 are the plan's recommended options: this is the chief agent's reading of "approve", and the owner has not answered them on their own.

Code read at `origin/main` = `97221d3`; each call site checked again at `b8218e5` (2026-11-15). A probe of the clock design ran in a scratch folder outside the repository (revision 3).

## 1. What I found: still there

Each relative time reads the clock only in a render (`new Date()`). Nothing renders the
component again when time passes, so "Just now" stays until something else changes.

| Call site (file:line) | What it shows | Used by |
| --- | --- | --- |
| `components/ui/time-text.tsx:20` `formatTime(iso, new Date())` | `TimeText` | `bot-grid-card.tsx:156` (last active), `skill-history.tsx:198` (version time), `skill-page.tsx:657` (Deprecated {time}), `skill-pin-dialogs.tsx:233` (`MoveVersionDialog`) |
| `features/bots/bot-page-top.tsx:87` `statusText(bot, new Date())` | "Idle · last active 5 min ago" | `BotPageTop` |
| `features/bots/bot-side-list.tsx:30` `const now = new Date()` | the status line of each row (`:36`, `:88`, `:98`) | `BotSideList` |
| `features/skills/skill-pin-dialogs.tsx:373` `formatTime(version.created_at, new Date())` | a version time inside a pick button (`TimeText` cannot go in a button) | `ChangeVersionDialog` |

`statusText` (`bot-lines.ts:73`) and `formatTime` (`lib/time-format.ts:11`) are pure and take
`now`; they stay. A search for `new Date()`, `Date.now()` and `formatTime(` finds no other site.

Noticed, not in this item: `time-format.md` §1 says local time uses the `timezone` setting;
the frontend reads no `timezone`. The PR adds a Follow-ups row unless one exists.

## 2. Code design

Rule: while the tab is visible, a relative time is at most one tick old. The smallest unit of
`time-format.md` §1 is one minute.

**Option A: a `useNow(tickMs)` hook in each component.** Each user has its own `setInterval`
and its own `visibilitychange` listener.
- Gain: no shared module.
- Cost: one timer and one listener for each time on screen. A History tab with 40 versions
  needs about 40 timers (counted from the code, not measured). The texts change at different
  moments. Each copy needs its own cleanup, and the theme leak test counts listeners.

**Option B (recommended): one shared clock** in a new `frontend/src/lib/now.ts`.
- `createClock({ tickMs, page })` returns `{ subscribe, now }` for `useSyncExternalStore`.
  `page` is the document. It can be swapped, as in `lib/realtime/start.ts` (`page = document`),
  so tests can send `visibilitychange`.
- One `setInterval` runs only while at least one component listens and the tab is visible.
  The last unsubscribe clears the timer and removes the listener.
- `now()` returns the same `Date` object between ticks, because React needs a stable snapshot.
  If no tick ran for more than one tick time (no listener, or a hidden tab), `now()` takes a
  fresh time first, so a page that opens later never shows an old time.
- Hidden tab: the timer stops. Visible again: the clock ticks at once and starts again.
- `useNow()` = `useSyncExternalStore(appClock.subscribe, appClock.now)`. `appClock` is the one
  instance of the app.
- Gain: one timer and one listener for the app; all texts change together; the rules have one
  home and one test file. Cost: one shared module, which is the reason for this design
  checkpoint.

State owner: `lib/now.ts`. Data flow: a tick or a visibility event changes `now`, and React
renders only the components that call `useNow()`. Failure paths: there is no network. A laptop
that sleeps gives a late tick or a `visibilitychange`, and the next tick corrects the text.

**Option C (rejected): a context provider in the shell.** Each test that renders a part alone
then needs the provider, and it gives nothing more than B.

Call sites after the change:
- `time-text.tsx`: `formatTime(iso, useNow())`.
- `BotPageTop`: `const now = useNow()` at the top; `statusText(bot, now)`.
- `bot-side-list.tsx:30`: `const now = useNow()`.
- `ChangeVersionDialog`: `const now = useNow()` at the top; the list uses it.

## 3. Cadence (Q1)

A tick each 30 seconds: half the one-minute unit, so a text is at most 30 s late. Its home is
Q1. With the recommended option, it is a code constant `NOW_TICK_MS`, as `TOOLTIP_DELAY_MS`
(`tooltip.tsx:5`) and `SKELETON_DELAY_MS` (`skeleton.tsx:7`) are, and its value is written one
time in `time-format.md` §1: "A relative time updates at least each 30 seconds while the page is
visible." The tick also turns "23 h ago" into the absolute time after one day.

## 4. Test strategy (before code)

TDD: each test fails before the code, and the PR records the red run. No break list: these are
not order, race or security tests (`testing.md` §5).

Fake timers: `vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"],
shouldAdvanceTime: true })`; `vi.setSystemTime` fixes the start. `top-header.test.tsx:109-112`
uses the same `shouldAdvanceTime` set-up, so TanStack Query and `waitFor` still run. It fakes
`setTimeout` and `setInterval` only; this PR adds `"Date"`, so `formatTime` sees the time move.

| Behaviour | Level | Cases |
| --- | --- | --- |
| One timer for many listeners | unit, `lib/now.test.ts` | 3 subscribers: `vi.getTimerCount()` is 1 |
| Cleanup | unit | the last unsubscribe: timer count 0, no listener on the fake page |
| A tick each `NOW_TICK_MS` | unit | each listener is called once per tick; `now()` moves |
| A stable snapshot | unit | two `now()` calls between ticks give the same object |
| Hidden tab | unit | hidden: advance 5 min, no call; visible: one call at once, then ticks again |
| Subscribe while hidden | unit | no timer until visible |
| A first read after a long idle time | unit | no listener for 10 min, then `now()` gives the new time |
| `TimeText`: "Just now" becomes "1 min ago" | component | advance 60 s inside `act` |
| `BotPageTop`, `BotSideList`, `ChangeVersionDialog` | component, one each | the line changes after 60 s |
| Unmount during a tick | component | no React warning; the timer stops with the last listener |

Risk: an e2e screenshot that shows "x min ago" can change during a long run. The build checks
the e2e fixtures (old fixed times show absolute dates and do not change).

Files: `lib/now.ts` and its test, `lib/README.md`, the four call sites and their tests,
`time-format.md` §1, `docs/status.md` (close the Follow-ups row), the ledger if the PR finds
more.

## 5. Open questions

**Q1. Where does the 30 s tick live?** `AGENTS.md` §10 says that a time the owner may want to
change has one home: the `settings` table, or an environment variable or config file. Only
invariants and security checks stay fixed in code. My view: the tick is not an owner value.
You choose what the text says (`time-format.md` §1). The tick only keeps that text correct, as
a render does. A shorter or longer tick gives you nothing to choose, only more or fewer late
seconds. Example: "Just now" turns into "1 min ago" between 60 and 90 s after a save.

| Option | Gain | Cost |
| --- | --- | --- |
| A (recommended). A code constant, value written in `time-format.md` §1 | Same as the tooltip and skeleton delays; no new config | `AGENTS.md` §10 lists no exception for UI timing values, so this needs your word (or a line in §10, which also needs your approval) |
| B. A Vite environment variable (`VITE_NOW_TICK_MS`), default 30 s, written next to the rule | Follows §10 as written; changed with no code edit | A new variable to parse and test for a value that you will likely never change |
| C. A row in the `settings` table | Changed in the app | A migration and a settings field for the same value |

**Q2. Add a lint guard against `new Date()` with no argument in `frontend/src/features/` and
`components/` (message "Use useNow()")?** Gain: no new time that does not update. Cost: about 10
lines of ESLint config. A valid use (a date for a file name) then needs an inline disable with
a reason. The guard does not catch `Date.now()`. It goes beyond item 67. I recommend yes.

## Revision 3 (2026-11-15, after the approval; from the probe of the leader)

Two rules of `now()` that the design needed, found by a probe in a scratch folder:

- `now()` takes a fresh `Date` only when the saved one is more than one tick old. A fresh `Date`
  on each call (for example, while no timer runs) makes React log "The result of getSnapshot
  should be cached" and render twice. Tests U4 and C6.
- The age is the absolute difference between `Date.now()` and the saved time. A system time that
  moves back (a test, a clock change) would otherwise keep an old `Date`. Test U13.

The Q1 and Q2 answers (section 5) are the recommended options. The real size of Q2 (measured on
the built PR, `git diff --stat`): the rule set and two blocks of `eslint.config.js` (the blocks
repeat their rule sets, and `scripts/lint-rules.test.ts` checks each file) take 19 added lines, and
the tests in `scripts/lint-rules.test.ts` take 51 lines, not "about 10 lines" in total. An earlier
text of this revision said "about 25 lines of config and 20 of test"; that came from reading the
file, not from the build.

## Why the tick is a rule and not a setting (`AGENTS.md` §10)

`AGENTS.md` §10 sends a value that the owner may want to change to a setting, an environment
variable or a config file. `NOW_TICK_MS` is not that value. The owner chooses what the text says
(`time-format.md` §1: "Just now", "5 min ago"). The tick only keeps that text correct, as a render
does: a text is at most one tick late. A shorter or longer tick gives the owner nothing to choose.
It is a rule of the format, written one time in `time-format.md` §1 ("at least each 30 seconds"),
like `TOOLTIP_DELAY_MS` and `SKELETON_DELAY_MS`. The comment of the constant says this too.

## Test strategy (revision 3, replaces section 4 where they differ)


TDD: each test red first (red run recorded), then code, one commit per part.
Fake timers: `vi.useFakeTimers({ toFake: ["setInterval","clearInterval","Date"], shouldAdvanceTime: true })`
+ `vi.setSystemTime`; `afterEach` -> `vi.useRealTimers()`. The probe (scratch folder `probe/`) shows this
works with vitest 5.1.0: `vi.getTimerCount()` counts only the fake interval (0 at start, 1 with 3
subscribers, 0 after the last unsubscribe).

### Parts (one commit each)
1. Plan commit (`docs/plans/p3-relative-time.md`, plans README row), draft PR.
2. `lib/now.ts` + `lib/now.test.ts` + `lib/README.md` row; `time-format.md` §1 gets the 30 s sentence.
3. Call sites: `TimeText`, `BotPageTop`, `BotSideList`, `ChangeVersionDialog` use `useNow()`; one component test each.
4. Lint guard (Q2): `new Date()` with no argument in `frontend/src/{components,features}` non-test files; tests in `scripts/lint-rules.test.ts`.
5. Docs, Guide check, folder indexes.

### Unit tests, `lib/now.test.ts` (fake page with `visibilityState` + a listener Set; a fresh `createClock` per test)
| # | One claim per test | Order or state case |
| --- | --- | --- |
| U1 | 3 subscribers share one timer (`getTimerCount()` = 1) | |
| U2 | the last unsubscribe clears the timer and removes the page listener; a non-last unsubscribe keeps both | unsubscribe order |
| U3 | each listener is called once per tick | |
| U4 | `now()` gives the same object between ticks | |
| U5 | hidden tab: no timer, no call after 5 min | |
| U6 | hidden then visible: one call at once, a new timer, then ticks again | |
| U7 | subscribe while hidden: no timer until visible | subscribe before visible |
| U8 | a repeated `visible` event (timer on): still one timer | event order |
| U9 | hidden, visible, hidden fast: 0 timers at the end | event order |
| U10 | unsubscribe while hidden removes the page listener; a later `visible` event does nothing | late event |
| U11 | a listener that unsubscribes during a tick does not skip the others | re-entrancy |
| U12 | first read after 10 min with no listener gives the new time | stale |
| U13 | system time jumps back or forward by more than a tick: next `now()` is fresh (rule uses the absolute difference) | stale |
| U14 | `NOW_TICK_MS` is 30 000 (the value `time-format.md` §1 writes) | |

### Component tests (app clock; each test starts with `vi.setSystemTime`)
| # | Test |
| --- | --- |
| C1 | `TimeText`: "Just now" -> "1 min ago" after 60 s in `act` |
| C2 | `BotPageTop`: status line "last active 1 min ago" after 60 s |
| C3 | `BotSideList`: a row status changes after 60 s |
| C4 | `ChangeVersionDialog` (open): the time in a pick button changes after 60 s |
| C5 | unmount during a tick: no React warning (spy on `console.error`); timer count 0 after the last unmount |
| C6 | first render: no "getSnapshot should be cached" warning (probe-found, see below) |
| C7 | hidden tab: a mounted `TimeText` keeps its text after 5 min; a `visible` event updates it at once |

`TimeText` and `BotSideList` have no test file now: each gets one. `bot-page.test.tsx` and
`skill-dialogs.test.tsx` get the other two cases. No new fixture. E2e fixtures use old fixed times
(absolute dates); I grep the specs before the e2e run.

### Lint (Q2), `scripts/lint-rules.test.ts`
`new Date()` in a feature file fails with "Use useNow()"; `new Date(iso)`, `new Date(0)` and
`Date.now()` pass; the rule set is on every non-test components and features file (the "each file
gets its rule sets" pattern); `lib/` and tests do not get it.

### Break list (owner rule of 2026-11-09: order and race tests need one)
Section 4 said none. Some of these are order and race tests by `testing.md` §5 (visibility and subscribe
order, a stale snapshot). `scripts/breaks/pr-<n>.json` holds only U2, U6, U8, U9, U10, U12,
U13, C6 (one claim, one break each: drop the stop on `hidden`, drop the refresh on `visible`, drop
`removeEventListener`, drop the stale check, ...). Other tests get a recorded red run. Cost: one
`check:breaks` run (heavy slot).

## Build notes (2026-11-15, after review round 1): where the build differs from this plan

The plan is a record, not a spec. The build differs in these places:

- Test C5 ("unmount during a tick: no React warning") was removed: no break of `now.ts` can make it
  fail, because React gives no warning for an update to an unmounted store reader. "Leaves no timer
  when it is gone" stays, with a break.
- The component tests are in `bot-relative-times.test.tsx` (the status line of the bot page top and of
  the side list) and `skill-pin-dialogs.test.tsx` (Change version), not in `bot-page.test.tsx` and
  `skill-dialogs.test.tsx`. `TimeText` got `time-text.test.tsx`.
- Some tests of the table are split so that each test has one claim (for example U2 is four tests).
- The break list `scripts/breaks/pr-125.json` has a claim for each test that proves an order, state or
  stale-time case, not only the eight named above (25 claims at the end of round 1). The other tests
  are `exempt` with their reason.
- U11 ("a listener that unsubscribes during a tick does not break the others") first passed on a
  plain loop over the set, so it proved nothing. Round 1 replaced it with three tests: another
  subscriber removes one in a tick, one leaves and joins again in a tick, and the last subscriber
  leaves in a `visible` event. Each has a break.
- The comment of `createClock` says what the clock does for a text that is already on screen when a
  laptop wakes: it is made again at the next tick or at the `visibilitychange` event, not at once.
- The home of the tick value is `time-format.md` §1. `frontend-conventions.md` and `lib/README.md`
  point to it. This plan and the U14 test of `now.test.ts` also write the value; they are not the spec.
