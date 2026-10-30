import type { Transport } from "../../core/ports/transport.ts";
import { PING_FRAME, eventFrame, retryFrame } from "./frames.ts";

// realtime-events.md §2: a `: ping` comment every 15 s keeps proxies from closing the
// connection, and `retry: 2000` makes the browser reconnect after 2 s. Fixed by the protocol;
// tests pass shorter values.
export const HEARTBEAT_MS = 15_000;
export const RETRY_MS = 2_000;

export interface SseOptions {
  heartbeatMs?: number;
  retryMs?: number;
  // Called when the event source fails. The client gets no detail: the stream just ends, and
  // the browser reconnects.
  onError: (error: unknown) => void;
}

// Turns the transport's events into an SSE body. `afterSeq` is the parsed Last-Event-ID, or
// null on a first connection.
//
// Backpressure: the body takes the next event from the transport only when the client has read
// the frame before it (`pull`, at most one frame queued). A long replay to a slow client holds
// one page of events (the hub reads the events table a page at a time), not the whole replay.
export function sseBody(
  transport: Transport,
  afterSeq: number | null,
  signal: AbortSignal,
  options: SseOptions,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  // Stops the transport when the request ends (client gone) or the body is cancelled.
  const abort = new AbortController();
  const events = transport.subscribe(afterSeq, abort.signal)[Symbol.asyncIterator]();
  let body: ReadableStreamDefaultController<Uint8Array> | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  // The cursor a control event reports: the client's own when it resumes, else the newest seq
  // (a fresh start, or after a reset).
  let maxSeq = 0;
  let cursor = afterSeq ?? 0;

  function finish(closeBody: boolean): void {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    signal.removeEventListener("abort", onAbort);
    abort.abort();
    void events.return?.(undefined).catch(options.onError);
    if (closeBody) body?.close();
  }
  function onAbort(): void {
    finish(true);
  }
  signal.addEventListener("abort", onAbort);

  return new ReadableStream<Uint8Array>(
    {
      start(controller) {
        body = controller;
        controller.enqueue(encoder.encode(retryFrame(options.retryMs ?? RETRY_MS)));
        // A ping only into an empty queue: a client that is not reading needs none.
        heartbeat = setInterval(() => {
          if (!closed && (controller.desiredSize ?? 0) > 0) {
            controller.enqueue(encoder.encode(PING_FRAME));
          }
        }, options.heartbeatMs ?? HEARTBEAT_MS);
        if (signal.aborted) finish(true);
      },
      async pull(controller) {
        try {
          const next = await events.next();
          if (closed) return;
          if (next.done === true) {
            finish(true);
            return;
          }
          const event = next.value;
          if (event.type === "ready") {
            maxSeq = event.data.max_seq;
            if (afterSeq === null) cursor = maxSeq;
          }
          if (event.type === "reset") cursor = maxSeq;
          controller.enqueue(encoder.encode(eventFrame(event, cursor)));
          if ("seq" in event) cursor = event.seq;
        } catch (error) {
          if (closed) return;
          options.onError(error);
          finish(true);
        }
      },
      cancel() {
        finish(false);
      },
    },
    // At most one frame queued (the default count strategy, made explicit).
    new CountQueuingStrategy({ highWaterMark: 1 }),
  );
}
