# realtime

The app's one event stream (`docs/realtime-events.md` §1a, §3).

| File | What it is for |
| --- | --- |
| `transport.ts` | The transport interface: `connect({ afterSeq, onEvent, onStatus })` |
| `sse.ts` | The SSE transport with `EventSource`; parses each frame with the `shared/` schemas |
| `reducer.ts` | Applies events to the TanStack Query cache, each event once |
| `start.ts` | Opens the stream at start and feeds the reducer |

Start here: `reducer.ts`. Do not: use `EventSource` outside `sse.ts`.
