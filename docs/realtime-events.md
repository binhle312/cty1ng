# Realtime events

This document owns the event log, the SSE stream, and every event type (D9).

## 1. Mental model

The database is the truth; the **event log** is the ordered list of everything that changed;
the browser's state is a **projection** of the events it has received. If the browser misses
events (sleep, network drop, reload), it asks for everything after the last sequence number it
saw and catches up. This is the same idea as a Kafka consumer committing an offset.

```
action (POST)  ──▶  service transaction: change rows + INSERT events(seq=812)  ──▶ commit
                                                                                 │
                     event hub (in process) ◀── notify(812) ─────────────────────┘
                          │
       SSE subscribers ◀──┘  each reads events with seq > its cursor from the DB and sends them
```

Subscribers always read from the `events` table, never from an in-memory copy, so the stream
and the replay path are the same code.

## 1a. Transport boundary (D9)

SSE is one adapter, not part of the event model, so WebSocket or another transport can be added
later without touching services, the log or the reducer.

- **Envelope.** Every event is `{seq, type, data}` as plain JSON. Nothing in it depends on SSE
  (the SSE `id:` and `event:` lines are just how the SSE adapter writes `seq` and `type`). The
  envelope and every event type are Zod schemas in `shared/src/events/`, imported by both sides.
- **Backend.** Services only append events. `core/events/hub.ts` exposes
  `subscribe(afterSeq): AsyncIterable<Event>` (the transport port, D35); `adapters/sse/` turns
  that iterator into SSE frames (ids, heartbeat, `reset`). A WebSocket adapter would be a second
  adapter (`adapters/websocket/`) over the same iterator, with the same Host/Origin checks
  (`security.md` §2.1).
- **Frontend.** `lib/realtime/transport.ts` defines
  `connect({ afterSeq, onEvent, onStatus }) => close`. `lib/realtime/sse.ts` implements it with
  `EventSource`; the reducer and the rest of the app only see `onEvent(envelope)`.
- **Contract tests** (`backend/test/contracts/transport.contract.ts`) run against the
  interface, not against SSE, so a new adapter must pass the same replay, gap and ordering
  tests.

## 2. The stream

`GET /api/stream` — one stream for the whole app (the rail needs unread dots for every
conversation).

- Response `Content-Type: text/event-stream`, no buffering, `Cache-Control: no-cache`.
- Each persisted event:

  ```
  id: 812
  event: message.created
  data: {"conversation_id":"01J…","message":{…}}

  ```

- Reconnect: the browser's `EventSource` sends `Last-Event-ID: 812` automatically. The server
  sends all events with `seq > 812`, then live ones. First connection without the header: the
  server sends nothing old; the client loads current state with normal GETs, then uses the
  stream's first `ready` event (which carries the current max seq) as its cursor.
- **Gap rule:** if the client's cursor is older than the retention window (events are kept 30
  days), the server sends `event: reset` and the client reloads state with GETs.
- Heartbeat: a comment line `: ping` every 15 s keeps proxies from closing the connection.
- `retry: 2000` tells the browser to reconnect after 2 s.

### Ephemeral events

`message.delta` (streaming tokens) is **not persisted** and carries no `id`.
They are sent only to live subscribers. If the stream drops mid-reply, the client refetches the
message after reconnect: it has `status = streaming` and the text saved so far (saved about
once per second), and later deltas continue from there. Each delta carries the full length
offset so the client can ignore duplicates:

```json
{"message_id":"01J…","offset":1532,"text":"next chunk"}
```

The client appends `text` only if `offset` equals its current length.

## 3. Client handling

`frontend/src/lib/realtime/`:

- One `EventSource` for the app, opened at startup.
- A reducer applies each event to the TanStack Query cache (`queryClient.setQueryData`) so
  pages update without refetching.
- The last applied `seq` is kept in memory; `EventSource` handles `Last-Event-ID` itself.
- Events are idempotent to apply: applying `message.created` for a message already in the
  cache replaces it rather than duplicating it. (Optimistic messages are matched by a
  `client_id` the browser sends with the POST.)
- **Live indicators never outlive the stream.** When the connection drops, the client clears
  every "typing" and "working" indicator. They come back only from events received after
  reconnecting (replayed or new), so nothing spins for ever on a dead connection.

## 4. Event types

All payloads include `conversation_id` when the event belongs to one. Message and bot objects
use the same schemas as the REST API (`api.md`), so the client has one type per entity.

| Type | Persisted | Payload | Emitted when |
| --- | --- | --- | --- |
| `ready` | no | `{max_seq}` | stream opened |
| `reset` | no | `{}` | client cursor too old |
| `conversation.created` | yes | `{conversation}` | "+" pressed |
| `conversation.updated` | yes | `{conversation}` | title (by the owner, or the one auto title, D46), icon, settings, active branch, budget counter changed |
| `conversation.deleted` | yes | `{conversation_id}` | deleted |
| `message.created` | yes | `{message}` | any message inserted (human, bot at run start, system) |
| `message.delta` | no | `{message_id, offset, text}` | streaming tokens |
| `message.completed` | yes | `{message}` | final text, provenance, token counts |
| `message.failed` | yes | `{message, error}` | run failed after retries |
| `message.stopped` | yes | `{message}` | Stop pressed |
| `message.feedback` | yes | `{message_id, feedback}` (`feedback` null when removed) | the owner rated a bot message, or changed or removed the rating (D51) |
| `run.queued` | yes | `{run}` | run inserted |
| `run.started` | yes | `{run}` | worker claimed it |
| `run.step` | yes | `{run_id, conversation_id, actor_id, step}` | each bot tool call finishes (D26), e.g. `read_file user-stories/login.md` |
| `run.finished` | yes | `{run}` | done, failed or stopped |
| `member.pending` | yes | `{conversation_id, bot_id, message_id}` | bot added, history card posted |
| `member.joined` | yes | `{conversation_id, bot_id, history_from_seq}` | owner chose history |
| `member.left` | yes | `{conversation_id, bot_id}` | bot removed |
| `handoff.created` | yes | `{handoff}` | bot proposed a handoff |
| `handoff.decided` | yes | `{handoff}` | approve / changes / reject / stale |
| `skill_draft.created` | yes | `{skill_draft}` | a bot proposed a skill (D41) |
| `skill_draft.decided` | yes | `{skill_draft}` | approved / rejected / stale; an approval also emits `skill.created` or `skill.updated`, and `bot.updated` when pinned |
| `bot.created` / `bot.updated` / `bot.deleted` | yes | `{bot}` | bot CRUD, avatar, pins |
| `bots.reordered` | yes | `{pinned_bot_ids}` | pinned list saved: pin, unpin or reorder (`PUT /bots/pins`); the header and the Bots page follow at once |
| `skill.created` / `skill.updated` / `skill.deprecated` | yes | `{skill}` | skill CRUD, new version |
| `settings.updated` | yes | `{settings}` | global settings changed |
| `spend.threshold_crossed` | yes | `{threshold_pct, today_spend_usd, cap_usd, provider}` | today's spend crossed 75%, 90% or 100% of the total cap (`provider` null) or of one provider's cap (D40, D42); once per threshold per cap per day |
| `project.created` / `project.updated` / `project.deleted` | yes | `{project}` | project CRUD, conversation moved (D37) |
| `memory.saved` / `memory.updated` / `memory.deleted` | yes | `{memory_item, conversation_id?}` | a bot or the owner changed memory (D38); drives the "Remembered: …" line |

Adding an event type: add it here first, then to the backend `EventType` enum and the frontend
reducer. A test asserts the three lists match.

## 5. Ordering and transactions

- An event is inserted in the **same transaction** as the change it describes. If the
  transaction rolls back, the event never existed.
- `seq` is SQLite `INTEGER PRIMARY KEY AUTOINCREMENT`, so it is strictly increasing even after
  deletes. With a single writer (SQLite) commit order equals `seq` order.
- In a Postgres future, commit order can differ from sequence order under concurrency; the
  stream would then read only events older than the oldest in-flight transaction. Not needed
  now; noted so nobody is surprised later.

## 6. Switching to WebSocket later

Only two places change: a new backend transport adapter next to `adapters/sse/` and a new
`frontend/src/lib/realtime/` implementation of `transport.ts`. Event types, payloads, cursor and replay stay the same.
