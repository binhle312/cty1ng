import type { StreamEvent } from "@cty1ng/shared/events";
import { describe, expect, it } from "vitest";
import type { Transport } from "../../core/ports/transport.ts";
import { parseFrames, sleep } from "../../../test/helpers.ts";
import { sseBody } from "./sse-stream.ts";

// Review of PR #48: the body must take events from the transport only as fast as the client
// reads them, so a long replay to a slow client does not fill memory.
function countingTransport(total: number) {
  const counter = { yielded: 0, returned: false };
  const transport: Transport = {
    async *subscribe() {
      try {
        yield { type: "ready", data: { max_seq: total } } satisfies StreamEvent;
        for (let seq = 1; seq <= total; seq++) {
          counter.yielded += 1;
          yield { type: "test.ping", seq, data: { note: "x" } };
          await Promise.resolve();
        }
      } finally {
        counter.returned = true;
      }
    },
  };
  return { transport, counter };
}

describe("sseBody backpressure", () => {
  it("does not read ahead of a client that does not read", async () => {
    const { transport, counter } = countingTransport(10_000);
    const body = sseBody(transport, 0, new AbortController().signal, { onError: () => undefined });
    await sleep(100);
    expect(counter.yielded).toBeLessThan(5);

    const reader = body.getReader();
    for (let i = 0; i < 20; i++) await reader.read();
    await sleep(50);
    expect(counter.yielded).toBeLessThan(30);
    await reader.cancel();
  });

  it("stops the transport when the client cancels", async () => {
    const { transport, counter } = countingTransport(10_000);
    const body = sseBody(transport, 0, new AbortController().signal, { onError: () => undefined });
    const reader = body.getReader();
    await reader.read();
    await reader.cancel();
    await sleep(20);
    expect(counter.returned).toBe(true);
  });

  it("stops the transport when the request signal aborts", async () => {
    const { transport, counter } = countingTransport(10_000);
    const abort = new AbortController();
    const reader = sseBody(transport, 0, abort.signal, { onError: () => undefined }).getReader();
    await reader.read();
    abort.abort();
    let done = false;
    for (let i = 0; i < 50 && !done; i++) done = (await reader.read()).done;
    expect(done).toBe(true);
    await sleep(20);
    expect(counter.returned).toBe(true);
  });
});

describe("sseBody control events", () => {
  it("gives a `reset` during a replay the id of the `ready` before it", async () => {
    const ping = (seq: number) =>
      ({ type: "test.ping", seq, data: { note: String(seq) } }) as const;
    // The hub's gap rule during a replay (realtime-events.md §2): events 3–5 were pruned.
    const transport: Transport = {
      async *subscribe() {
        await Promise.resolve();
        yield { type: "ready", data: { max_seq: 5 } };
        yield ping(1);
        yield ping(2);
        yield { type: "ready", data: { max_seq: 6 } };
        yield { type: "reset", data: {} };
        yield ping(7);
      },
    };
    const body = sseBody(transport, 0, new AbortController().signal, { onError: () => undefined });
    const frames = parseFrames(await new Response(body).text()).filter((f) => f.event);
    expect(frames.map((f) => `${f.id ?? "-"} ${f.event ?? ""}`)).toEqual([
      "0 ready",
      "1 test.ping",
      "2 test.ping",
      "2 ready",
      "6 reset",
      "7 test.ping",
    ]);
  });
});
