// The wait before a new try of the event stream, fixed by the protocol (realtime-events.md §2):
// the server sends it as `retry:` for the browser's own reconnect, and the client waits the
// same time before it opens a new stream after the browser stopped one for good (§3).
export const STREAM_RETRY_MS = 2_000;
