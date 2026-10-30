# D9. SSE + POST transport with an ordered event log

Status: accepted (2026-10-20)
Decision: The browser sends actions with HTTP requests and receives updates over one
Server-Sent Events stream. Every persisted event has a global sequence number; reconnect
replays from `Last-Event-ID`.
Why: Traffic is almost all server → browser. SSE is plain HTTP, reconnects by itself, and
replays missed events. Slack also sends messages with REST calls and uses its
socket only to receive.
Rejected: WebSocket now (more code: heartbeats, reconnect, framing; no benefit for one human).
Revisit when many humans need presence and typing indicators.
Condition (owner, 2026-10-21): the transport must be replaceable. Events are produced and
consumed through a transport-neutral interface, so WebSocket (or another transport) can replace
or sit beside SSE without touching services, the event log or the frontend reducer
(`../realtime-events.md` §1a).
Implemented in: `../realtime-events.md`.
