# Audit PR 6: six tabs and the stream that does not come back

Brief: [audit of 2026-11-05](../audits/2026-11-05-repo-audit.md), row 14 and the P3 "the stream does not come back in `make dev`"
Checkpoint: code design (owner, 2026-11-05: "Show the owner a one-page design first")
Approval: approved 2026-11-10, revision 1 (owner: "Approve your designs", then "Also approve 2s wait")

Owner decisions of 2026-11-10: the design below is approved as written, with option 1. The wait
of rule 3 is 2 s. It takes the recommended home of open question 1: one constant in `shared/`,
used by the server and the client. The owner approved the 2 s and did not name the home, so
the builder took the recommended answer.

## Problem

1. **Six tabs (row 14, P2).** Each app tab holds one stream for its whole life. The browser
   allows six connections for each host. With six tabs open, every request in every tab waits
   with no error.
2. **The stream does not come back in `make dev` (P3).** After a backend stop, open pages get
   no live events until a reload.

## Probe results (2026-11-10)

A script ran the real backend, the real Vite dev server and Chromium.

| Check | Result |
| --- | --- |
| Tabs 1 to 5, `GET /api/settings` | 200 |
| Tab 6, `GET /api/settings` | No answer in 4 s |
| Tab 7 | The page did not load in 6 s |
| Backend stop, stream direct to the backend (as in the production build) | The browser sees the error, tries again each 2 s, and the stream is open 2 s after the restart |
| Backend stop, stream through the Vite proxy (`make dev`) | `readyState` stays 1 (open) during the stop and after the restart. No error, no new request |
| The same, with a proxy hook that closes the browser side | The browser sees the error, tries again after 2 s, gets 502, and stops for good |

**The audit text is not correct about the cause.** It says the stream fails after a stop longer
than the 2 s retry. The run shows two causes:

- The Vite proxy does not close the browser side when the backend side closes. The browser
  keeps a dead stream that looks open.
- When the proxy answers 502, `EventSource` stops for good (an HTTP error is final for it). The
  client has no code that opens a new stream.

## Design

The owner chose option A on 2026-11-09: only a visible tab holds the stream. Option B, one
stream that all tabs share, was refused for now.

### Rules

1. A visible tab holds one stream. A hidden tab holds none: it closes its stream at once.
2. When a tab becomes visible, it opens a new stream.
3. When the browser stops the stream for good and the tab is visible, the tab waits 2 s and
   opens a new stream. It does this again after each failure, with no limit.
4. After the first `ready` of each new stream, the tab reads all data again (the same action
   as for `reset`). The stream that the tab opens at page start is the exception: the page
   reads its data at that time. The order is important: the read starts after `ready`, so no
   change falls between the read and the live events.
5. A reconnect that the browser does itself (same `EventSource`, `Last-Event-ID`) stays as it
   is: the server replays the missed events, and the tab does not read all data again.
6. In `make dev`, the Vite proxy closes the browser side of a response when the backend side
   closes. A backend stop then follows rule 3.

### State owner and modules

| File | Change |
| --- | --- |
| `frontend/src/lib/realtime/stream-life.ts` (new) | The state owner. A pure function: state and event in, new state and actions out. No DOM, no timer, no `EventSource` |
| `frontend/src/lib/realtime/start.ts` | The boundary. It gives `visibilitychange`, the transport status, the timer and `ready` to the pure function, and does the actions: open, close, start or cancel the timer, read all |
| `frontend/src/lib/realtime/sse.ts` | No rule change. It reports `closed` when the browser stops the stream, as today |
| `frontend/vite.config.ts` | Rule 6, about 8 lines in the proxy options. Dev server only |
| `shared/` and `backend/src/adapters/sse/sse-stream.ts` | Only if the owner picks the first answer of the open question: one constant for the 2 s |

No API change, no migration, no new dependency, no screen change.

### State table

State: the tab (visible, hidden) and the stream (none, live, waiting for the timer). Each
stream has a number. An event that carries an old number is ignored.

| State | Tab hidden | Tab visible | Stopped for good | Timer | First `ready` of this stream |
| --- | --- | --- | --- | --- | --- |
| Hidden, no stream | Stays | Open a stream that reads all | Not possible: no stream. A late one has an old number, ignored | Not possible: cancelled | Ignored: old number |
| Visible, live | Close the stream. To "Hidden, no stream" | Stays | Start the timer. To "Visible, waiting" | Not possible: no timer | Read all, but not for the stream of page start |
| Visible, waiting | Cancel the timer. To "Hidden, no stream" | Stays | Ignored: old number | Open a stream that reads all. To "Visible, live" | Ignored: old number |

A page that starts hidden starts in "Hidden, no stream". Its first stream reads all.

Invariants: at most one stream; no stream and no timer while hidden; at most one timer; a
stream and a timer never exist together.

### Failure paths

- The new stream fails again: rule 3 repeats. The cost is one request each 2 s on loopback.
- A read after `ready` fails: each page shows its own error state, as after `reset` today.
- A pending save in a tab that becomes hidden: the save is a normal request, so it completes.

### Options compared

| Option | Gain | Cost |
| --- | --- | --- |
| **1. Pure `stream-life.ts`, wired in `start.ts`** (recommended) | Each table cell and each order has a unit test with no browser. A second transport gets the rules for free | One new file |
| 2. Put the rules in `sse.ts` | No new file | Page rules mix with the SSE adapter. A WebSocket adapter must repeat them (`realtime-events.md` §1a). Tests need a fake `EventSource` for each order |
| 3. As if the rule always existed: the transport interface gets `pause()` and `resume()` | A clear contract | A change of the transport boundary (D9) for one adapter. More code than option 1, same behaviour |

For rule 6, the other option is a watchdog in the client: the server sends its ping as a real
event, and the client opens a new stream when no ping comes. It also finds a dead stream
outside `make dev`. The cost is a server change, a new event type and a spec change. The
probe shows no dead stream without the proxy, so the plan does not take it.

### Costs of option A that stay

- A hidden tab shows no live change. For M3: its title cannot show an unread count.
- Each return to a tab reads all data again: once from TanStack Query on focus (as today),
  and once after `ready`. On loopback this is small.
- Six windows that are all visible at the same time still block. The owner accepted this.

## Test strategy

| Behaviour | Level | Cases |
| --- | --- | --- |
| Each cell of the state table | Unit, `stream-life.test.ts` | One test for each cell, with the "not possible" cells as ignored events |
| Order and timing | Unit, `stream-life.test.ts` | Hidden and visible many times in a row: one stream at most. Stopped for good, then hidden before the timer, then visible: one stream, one read. A late status and a late `ready` of an old stream: ignored. Two `ready` in one stream (the browser's own reconnect): one read. The stream of page start: no read. A page that starts hidden: its first stream reads |
| Invariants over random orders | Unit, seeded | Random events against a small reference model; the four invariants hold after each event. The seed is in the failure message |
| The read comes after `ready`, not before | Unit, `start.test.ts`, fake transport and fake timers | An event that arrives between "open" and `ready` causes no read; `ready` causes exactly one. The stop function removes the listener and the timer |
| Seven tabs work (row 14) | End to end | Seven app tabs in one browser; the seventh loads, and a save in it gets its answer. Red on `main`: the probe shows it |
| A change made while the tab was hidden shows after the return | End to end | Hide the tab, change a bot through the API, show the tab, see the change with no reload |
| Stopped for good, then back | End to end | The test answers `/api/stream` with 502 one time. The app opens a new stream after the wait and shows a change. Red on `main` |
| The proxy closes a dead stream (rule 6) | `scripts/dev-proxy.test.ts` | The backend closes during a stream; the client side of the proxy ends in under 2 s. Red on `main` |

Risk probe, done on 2026-11-10: headless Chromium does not hide a tab. With a second tab in
front, `visibilityState` of the first tab stays `visible`, and `Page.setWebLifecycleState` does
not change it. So the end to end tests set `visibilityState` and send `visibilitychange`
themselves. The seven tabs test hides each tab in this way before it opens the next one.

Break lists (owner, 2026-11-09) apply to the order and timing rows only. For the other rows
the PR records the red run.

## Documents to change in the same PR

- `docs/realtime-events.md` §2 and §3: rules 1 to 6.
- `docs/audits/2026-11-05-repo-audit.md`: the option A decision, the corrected cause, and the
  rows of PR 5 and PR 6 in "Fix progress".
- `docs/status.md`, `docs/delivery-quality.md`, `frontend/src/lib/realtime/README.md`.

## Needs human review

- This design.
- `frontend/vite.config.ts`: the proxy that carries the Host of the backend gets a hook. The
  Host and Origin checks do not change, and `scripts/dev-proxy.test.ts` still proves them.

## Open questions

1. Where does the 2 s wait of rule 3 live?
   - **One constant in `shared/`, used by the server's `retry: 2000` and by the client**
     (recommended). `realtime-events.md` §2 already fixes the 2 s as part of the protocol, so
     it is a rule and not a setting. One home, no new configuration.
   - An environment variable. The owner can change it, but the frontend has no environment
     values today, so this adds a build-time value or a field in an API answer.
