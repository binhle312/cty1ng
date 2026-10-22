import type { StreamEvent } from "@cty1ng/shared";
import { describe, expect, it } from "vitest";
import type { EventFeed } from "../../core/ports/transport";
import { createSseStream } from "./sse-stream";

/** A feed of `count` events that records how many the stream has taken from it. */
function countingFeed(count: number): EventFeed & { taken: () => number } {
  let taken = 0;
  return {
    taken: () => taken,
    async *subscribe({ signal }) {
      for (let seq = 1; seq <= count && !signal.aborted; seq += 1) {
        taken += 1;
        const event: StreamEvent = { type: "test.ping", seq, data: { note: `n${seq}` } };
        yield event;
      }
    },
  };
}

const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("SSE stream backpressure", () => {
  it("takes events from the feed only as fast as the client reads", async () => {
    const feed = countingFeed(10_000);
    const controller = new AbortController();
    const stream = createSseStream({ feed, cursor: { kind: "fresh" }, signal: controller.signal });
    await settle(50);
    // Nobody reads: only a bounded number of events may be buffered.
    expect(feed.taken()).toBeLessThanOrEqual(4);

    const reader = stream.getReader();
    for (let i = 0; i < 20; i += 1) await reader.read();
    await settle(20);
    expect(feed.taken()).toBeGreaterThanOrEqual(19);
    expect(feed.taken()).toBeLessThanOrEqual(25);
    await reader.cancel();
  });

  it("does not queue heartbeats for a client that is not reading", async () => {
    // A feed that never has an event: each `next()` waits until the stream stops.
    const idle: EventFeed = {
      subscribe: ({ signal }) => ({
        [Symbol.asyncIterator]: () => ({
          next: () =>
            new Promise<IteratorResult<StreamEvent>>((resolve) => {
              signal.addEventListener("abort", () => resolve({ done: true, value: undefined }), {
                once: true,
              });
            }),
        }),
      }),
    };
    const controller = new AbortController();
    const stream = createSseStream({
      feed: idle,
      cursor: { kind: "fresh" },
      signal: controller.signal,
      heartbeatMs: 2,
    });
    await settle(100);
    // Stop the stream (and its heartbeat), then read only what was already queued.
    controller.abort();
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let text = "";
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      text += decoder.decode(chunk.value);
    }
    // ~50 intervals passed while nobody read; only what fits the queue may be waiting.
    expect(text.split(": ping").length - 1).toBeLessThanOrEqual(2);
    await reader.cancel();
  });
});
