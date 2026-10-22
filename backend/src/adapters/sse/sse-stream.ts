import type { StreamEvent } from "@cty1ng/shared";
import type { EventFeed, StreamCursor } from "../../core/ports/transport";

export const HEARTBEAT_MS = 15_000;
export const RETRY_MS = 2_000;

/** Frames the stream may hold for a client that is not reading (backpressure). */
export const BUFFERED_FRAMES = 2;

/**
 * The SSE transport adapter (realtime-events.md §1a, §2): turns the core's event feed into
 * Server-Sent Events frames. Persisted events carry `id: <seq>`, so the browser's EventSource
 * sends it back as `Last-Event-ID` on reconnect; `ready` and `reset` carry no id.
 *
 * Backpressure: the stream takes the next event from the feed only when its small queue has
 * room (`pull`), and the Node server reads it only as fast as the socket drains. A large replay
 * or a slow client therefore holds at most `BUFFERED_FRAMES` frames here. Heartbeats are skipped
 * while the queue is full.
 */
export function createSseStream(input: {
  feed: EventFeed;
  cursor: StreamCursor;
  /** Aborts when the client goes away or the server shuts down. */
  signal: AbortSignal;
  heartbeatMs?: number;
  onError?: (error: unknown) => void;
}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const stop = new AbortController();
  const signal = AbortSignal.any([stop.signal, input.signal]);
  const events = input.feed.subscribe({ cursor: input.cursor, signal })[Symbol.asyncIterator]();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  const finish = (): void => {
    clearInterval(heartbeat);
    stop.abort();
  };

  return new ReadableStream<Uint8Array>(
    {
      start(controller) {
        const close = (): void => {
          if (closed) return;
          closed = true;
          finish();
          controller.close();
        };
        controller.enqueue(encoder.encode(`retry: ${RETRY_MS}\n\n`));
        heartbeat = setInterval(() => {
          if (!closed && (controller.desiredSize ?? 0) > 0) {
            controller.enqueue(encoder.encode(": ping\n\n"));
          }
        }, input.heartbeatMs ?? HEARTBEAT_MS);
        // Shutdown or a gone client: end the response even if no pull is waiting.
        signal.addEventListener("abort", close, { once: true });
      },
      async pull(controller) {
        try {
          const next = await events.next();
          if (closed) return;
          if (next.done === true) {
            closed = true;
            finish();
            controller.close();
            return;
          }
          controller.enqueue(encoder.encode(toFrame(next.value)));
        } catch (error) {
          input.onError?.(error);
          if (!closed) {
            closed = true;
            finish();
            controller.close();
          }
        }
      },
      cancel() {
        closed = true;
        finish();
      },
    },
    new CountQueuingStrategy({ highWaterMark: BUFFERED_FRAMES }),
  );
}

/** Parses the `Last-Event-ID` header into a cursor. */
export function cursorFromLastEventId(header: string | undefined): StreamCursor {
  if (header === undefined || header === "") return { kind: "fresh" };
  if (!/^\d{1,15}$/.test(header)) return { kind: "unusable" };
  return { kind: "after", seq: Number(header) };
}

function toFrame(event: StreamEvent): string {
  // JSON.stringify escapes newlines, so the payload is always one `data:` line.
  const data = JSON.stringify(event.data);
  if ("seq" in event) return `id: ${event.seq}\nevent: ${event.type}\ndata: ${data}\n\n`;
  return `event: ${event.type}\ndata: ${data}\n\n`;
}
