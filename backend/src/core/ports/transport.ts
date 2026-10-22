import type { StreamEvent } from "@cty1ng/shared";

/**
 * Where a subscriber starts (realtime-events.md §2):
 * - `fresh`: no cursor; send nothing old.
 * - `after`: replay every event with a larger `seq`, then live ones.
 * - `unusable`: a cursor the server cannot read; treated like a cursor that is too old.
 */
export type StreamCursor =
  { kind: "fresh" } | { kind: "after"; seq: number } | { kind: "unusable" };

/**
 * The transport port (D9, D35, realtime-events.md §1a). The core's event hub implements it;
 * a transport adapter (SSE now, WebSocket later) turns the iterator into frames.
 * The iterator ends when `signal` aborts.
 */
export interface EventFeed {
  subscribe(input: { cursor: StreamCursor; signal: AbortSignal }): AsyncIterable<StreamEvent>;
}
