# core/events

The event log and the hub that feeds the stream (realtime-events.md §1, §5).

| File | What it is for |
| --- | --- |
| `append-event.ts` | `appendEvent(tx, …)`: validates the payload and appends inside the caller's unit of work |
| `hub.ts` | In-process hub: wakes subscribers after commit; replay and live read the same log |
| `test-events.service.ts` | Appends `test.ping` for the stream's tests (`APP_ENV=test` only) |

Start here: `hub.ts`. Do not: append an event outside a unit of work that also changes state.
