# sse

The SSE adapter of the transport port (`docs/realtime-events.md` §1a, §2).

| File | What it is for |
| --- | --- |
| `sse-stream.ts` | Turns the transport's events into an SSE body: `retry`, `: ping` heartbeats, stop on disconnect |
| `frames.ts` | The frame format: `id`, `event`, `data`; the cursor id on `ready` and `reset` |

Start here: `sse-stream.ts`.
