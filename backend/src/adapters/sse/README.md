# adapters/sse

The SSE transport (realtime-events.md §1a, §2): turns the core's event feed into frames.

| File | What it is for |
| --- | --- |
| `sse-stream.ts` | Frames (`id`, `event`, `data`), `retry`, heartbeat; parses `Last-Event-ID` |

Start here: `sse-stream.ts`. Do not: read events from anywhere but the feed.
