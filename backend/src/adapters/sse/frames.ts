import type { StreamEvent } from "@cty1ng/shared/events";

// SSE frames for the stream (realtime-events.md §2). A persisted event is
// `id: <seq>` + `event: <type>` + `data: <json>`. `ready` and `reset` also carry an `id:` line:
// the cursor the stream continues from, so the browser's Last-Event-ID is right after a fresh
// connection or a reset, before any persisted event arrives.
export function eventFrame(event: StreamEvent, cursor: number): string {
  const id = "seq" in event ? event.seq : cursor;
  // JSON.stringify escapes newlines, so data is always one line.
  return `id: ${id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

export function retryFrame(retryMs: number): string {
  return `retry: ${retryMs}\n\n`;
}

export const PING_FRAME = ": ping\n\n";
