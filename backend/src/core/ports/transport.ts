import type { StreamEvent } from "@cty1ng/shared/events";

// The realtime transport port (D9, realtime-events.md §1a). The core gives an ordered stream of
// events; an adapter (SSE now, WebSocket later) turns it into frames.
export interface Transport {
  // Yields `ready` first. With a cursor (`afterSeq`), it then yields the events after it, or
  // `reset` when the cursor is outside the kept events. Then it yields live events until
  // `signal` aborts. Without a cursor it sends nothing old (realtime-events.md §2).
  subscribe(afterSeq: number | null, signal: AbortSignal): AsyncIterable<StreamEvent>;
}
