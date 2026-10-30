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

// Turns the transport's ordered events into an SSE body. `afterSeq` is the parsed
// Last-Event-ID, or null on a first connection.
export function sseBody(
  transport: Transport,
  afterSeq: number | null,
  signal: AbortSignal,
  options: SseOptions,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  // Stops the transport when the request ends (client gone) or the body is cancelled.
  const abort = new AbortController();
  const stop = (): void => {
    abort.abort();
  };
  signal.addEventListener("abort", stop);
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (text: string): void => {
        if (!closed) controller.enqueue(encoder.encode(text));
      };
      send(retryFrame(options.retryMs ?? RETRY_MS));
      heartbeat = setInterval(() => {
        send(PING_FRAME);
      }, options.heartbeatMs ?? HEARTBEAT_MS);

      void (async () => {
        // The cursor a control event reports: the client's own when it resumes, else the newest
        // seq (a fresh start, or after a reset).
        let maxSeq = 0;
        let cursor = afterSeq ?? 0;
        try {
          for await (const event of transport.subscribe(afterSeq, abort.signal)) {
            if (event.type === "ready") {
              maxSeq = event.data.max_seq;
              if (afterSeq === null) cursor = maxSeq;
            }
            if (event.type === "reset") cursor = maxSeq;
            send(eventFrame(event, cursor));
            if ("seq" in event) cursor = event.seq;
          }
        } catch (error) {
          options.onError(error);
        } finally {
          clearInterval(heartbeat);
          signal.removeEventListener("abort", stop);
          abort.abort();
          if (!closed) {
            closed = true;
            controller.close();
          }
        }
      })();
    },
    cancel() {
      closed = true;
      clearInterval(heartbeat);
      stop();
    },
  });
}
