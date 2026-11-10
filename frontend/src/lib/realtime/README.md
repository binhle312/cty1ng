# realtime

The app's one event stream (`docs/realtime-events.md` §1a, §3).

| File | What it is for |
| --- | --- |
| `transport.ts` | The transport interface: `connect({ afterSeq, onEvent, onStatus })` |
| `sse.ts` | The SSE transport with `EventSource`; parses each frame with the `shared/` schemas |
| `reducer.ts` | Applies events to the TanStack Query cache, each event once |
| `read-all.ts` | Reads all data again, with reads that start now: for a `reset` and for the first `ready` of a new stream |
| `stream-life.ts` | The rules for when the tab holds a stream: pure, a state and an event give the next state and the actions (`docs/realtime-events.md` §3, "Stream life") |
| `start.ts` | The boundary of `stream-life.ts`: gives it the tab visibility, the stream status and the timer, does its actions, and feeds the reducer |

Start here: `reducer.ts`. Do not: use `EventSource` outside `sse.ts`, or put a rule for the
stream's life in `start.ts`.
