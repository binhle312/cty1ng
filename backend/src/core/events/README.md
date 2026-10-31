# events

The event layer (`docs/realtime-events.md` §1, §2): every UI-visible change is an event written
in the same transaction as the change (`AGENTS.md` §5 rule 3).

| File | What it is for |
| --- | --- |
| `append-event.ts` | `appendEvent(tx, …)`: checks the event's schema, inserts it, wakes the hub after commit |
| `hub.ts` | The in-process hub, the core side of the transport port: replay, the gap rule, live events |
| `hub.test.ts` | The hub and pruning: it waits for the next notify after a complete prune, and sends `ready` and `reset` when a prune leaves a gap during a replay |
| `event-pruning.service.ts` | Deletes the events older than `EVENT_RETENTION_DAYS` (the timed job; writes no event) |
| `event-pruning.service.test.ts` | The cutoff edge, a complete removal, seq after a prune, no event written |
| `test-ping.service.ts` | Appends `test.ping` for `POST /api/_test/events` (APP_ENV=test only) |

Start here: `hub.ts`. Do not: send events from memory; subscribers always read the `events`
table.
