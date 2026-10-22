import type { StreamEvent } from "@cty1ng/shared";
import type { EventFeed, StreamCursor } from "../../core/ports/transport";

export const HEARTBEAT_MS = 15_000;
export const RETRY_MS = 2_000;

/**
 * The SSE transport adapter (realtime-events.md §1a, §2): turns the core's event feed into
 * Server-Sent Events frames. Persisted events carry `id: <seq>`, so the browser's EventSource
 * sends it back as `Last-Event-ID` on reconnect; `ready` and `reset` carry no id.
 */
export function createSseStream(input: {
  feed: EventFeed;
  cursor: StreamCursor;
  /** Aborts when the client goes away. */
  signal: AbortSignal;
  heartbeatMs?: number;
  onError?: (error: unknown) => void;
}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const stop = new AbortController();
  const signal = AbortSignal.any([stop.signal, input.signal]);
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (text: string): void => {
        if (!signal.aborted) controller.enqueue(encoder.encode(text));
      };
      send(`retry: ${RETRY_MS}\n\n`);
      heartbeat = setInterval(() => send(": ping\n\n"), input.heartbeatMs ?? HEARTBEAT_MS);

      void (async () => {
        try {
          for await (const event of input.feed.subscribe({ cursor: input.cursor, signal })) {
            send(toFrame(event));
          }
        } catch (error) {
          input.onError?.(error);
        } finally {
          clearInterval(heartbeat);
          if (!stop.signal.aborted) {
            stop.abort();
            controller.close();
          }
        }
      })();
    },
    cancel() {
      clearInterval(heartbeat);
      stop.abort();
    },
  });
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
