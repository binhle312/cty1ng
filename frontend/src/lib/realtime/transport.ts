import type { StreamEvent } from "@cty1ng/shared/events";

// The transport boundary of realtime-events.md §1a. The reducer and the rest of the app see
// only `onEvent(event)`; SSE is one implementation (sse.ts), so another transport can replace
// it without changes elsewhere.
export type TransportStatus = "connecting" | "open" | "closed";

export interface ConnectOptions {
  // The last seq the app applied, or null for a first connection. EventSource resumes by
  // itself with Last-Event-ID after a drop, so the SSE adapter needs it only for a new
  // connection; in M0 the app always starts with null.
  afterSeq: number | null;
  onEvent: (event: StreamEvent) => void;
  onStatus: (status: TransportStatus) => void;
}

export type Connect = (options: ConnectOptions) => () => void;
