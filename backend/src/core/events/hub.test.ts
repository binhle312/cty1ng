import { describe, expect, it } from "vitest";
import type { EventLogReader, StoredEvent } from "../ports/repositories";
import { createEventHub } from "./hub";

const at = new Date("2026-10-22T00:00:00.000Z");
const ping = (seq: number): StoredEvent => ({
  seq,
  type: "test.ping",
  conversationId: null,
  payload: { note: `n${seq}` },
  createdAt: at,
});

/** An in-memory log whose next read can run a callback first, to stage races. */
function fakeLog(initial: StoredEvent[]) {
  const rows = [...initial];
  let beforeRead: (() => void) | undefined;
  const log: EventLogReader = {
    async listAfter({ afterSeq, limit }) {
      const snapshot = rows.filter((row) => row.seq > afterSeq).slice(0, limit);
      const hook = beforeRead;
      beforeRead = undefined;
      // The commit lands after this read took its snapshot but before the read returns.
      hook?.();
      return snapshot;
    },
    async bounds() {
      return { minSeq: rows[0]?.seq ?? null, maxSeq: rows.at(-1)?.seq ?? null };
    },
  };
  return {
    log,
    rows,
    duringNextRead(callback: () => void) {
      beforeRead = callback;
    },
  };
}

describe("event hub", () => {
  it("does not lose a commit that lands while it is reading", async () => {
    const fake = fakeLog([ping(1)]);
    const hub = createEventHub({ log: fake.log });
    const controller = new AbortController();
    const stream = hub.subscribe({ cursor: { kind: "after", seq: 1 }, signal: controller.signal });
    const iterator = stream[Symbol.asyncIterator]();
    expect((await iterator.next()).value).toEqual({ type: "ready", data: { max_seq: 1 } });

    fake.duringNextRead(() => {
      fake.rows.push(ping(2));
      hub.notify();
    });
    const next = await Promise.race([
      iterator.next(),
      new Promise<"lost">((resolve) => setTimeout(() => resolve("lost"), 500)),
    ]);
    expect(next).not.toBe("lost");
    expect(next).toMatchObject({ value: { type: "test.ping", seq: 2 } });
    controller.abort();
  });

  it("reads in pages without waiting between full pages", async () => {
    const fake = fakeLog([1, 2, 3, 4, 5].map(ping));
    const hub = createEventHub({ log: fake.log, pageSize: 2 });
    const controller = new AbortController();
    const seen: number[] = [];
    for await (const event of hub.subscribe({
      cursor: { kind: "after", seq: 0 },
      signal: controller.signal,
    })) {
      if ("seq" in event) seen.push(event.seq);
      if (seen.length === 5) controller.abort();
    }
    expect(seen).toEqual([1, 2, 3, 4, 5]);
  });

  it("ends when the signal aborts while waiting", async () => {
    const hub = createEventHub({ log: fakeLog([]).log });
    const controller = new AbortController();
    const done = (async () => {
      const events = [];
      for await (const event of hub.subscribe({
        cursor: { kind: "fresh" },
        signal: controller.signal,
      })) {
        events.push(event.type);
      }
      return events;
    })();
    setTimeout(() => controller.abort(), 20);
    expect(await done).toEqual(["ready"]);
  });
});
