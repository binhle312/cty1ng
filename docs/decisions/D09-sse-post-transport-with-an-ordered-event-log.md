# D9. SSE + POST transport with an ordered event log

Status: accepted (2026-10-20)
Decision: The browser sends actions with HTTP requests and receives updates over one
Server-Sent Events stream. Every persisted event has a global sequence number; reconnect
replays from `Last-Event-ID`.
Why: Traffic is almost all server → browser. SSE is plain HTTP, reconnects by itself, and
replays missed events. Discord and Slack also send messages with REST calls and use their
socket only to receive.
Rejected: WebSocket now (more code: heartbeats, reconnect, framing; no benefit for one human).
Revisit when many humans need presence and typing indicators.
Implemented in: `../realtime-events.md`.
