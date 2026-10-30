import type { StreamEvent } from "@cty1ng/shared/events";
import { describe, expect, it } from "vitest";
import type { Transport } from "../../core/ports/transport.ts";
import { sleep } from "../../../test/helpers.ts";
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
