import type { StreamEvent } from "@cty1ng/shared/events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { collect, manualClock, testBackend } from "../../../test/helpers.ts";

// The hub on a temporary database (realtime-events.md §2). The gap rule and replay are in the
// transport contract; these tests are about the hub's wait after pruning.

const DAY = 86_400_000;
// More reads than a waiting subscriber ever needs. A subscriber that reads more without a new
// event is looping; the read throws, so the test fails instead of blocking the test worker
// (a loop on microtasks also blocks Vitest's own timeout).
const MAX_READS = 50;

let clock: ReturnType<typeof manualClock>;
let backend: ReturnType<typeof testBackend>;
let abort: AbortController;
beforeEach(() => {
  clock = manualClock();
  backend = testBackend({}, { clock });
  abort = new AbortController();
});
afterEach(() => {
  abort.abort();
  backend.close();
});

const append = (note: string) =>
  backend.uow.run((tx) =>
    backend.appendEvent(tx, { event: { type: "test.ping", data: { note } }, conversationId: null }),
  );

describe("event hub after pruning", () => {
  it("waits for the next event after a complete prune, without blocking timers", async () => {
    // The hub is notified up to seq 3, then the job deletes every event.
    for (const note of ["a", "b", "c"]) await append(note);
    clock.advance(31 * DAY);
    expect(await backend.eventPruning.pruneDue()).toBe(3);

    const after = backend.readers.events.after.bind(backend.readers.events);
    let reads = 0;
    vi.spyOn(backend.readers.events, "after").mockImplementation((seq, limit) => {
      reads += 1;
      if (reads > MAX_READS) throw new Error(`busy loop: ${reads} reads without a new event`);
      return after(seq, limit);
    });

    // A reconnect on the same hub, with a cursor below the pruned events, so it gets `reset`.
    const stream = collect(backend.hub.subscribe(1, abort.signal));
    expect((await stream.waitFor(2)).map((event) => event.type)).toEqual(["ready", "reset"]);

    // A zero-delay timer runs, so the subscriber is waiting, not looping.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(reads).toBeLessThanOrEqual(2);

    // A new event arrives, with the next seq.
    await append("d");
    const events = await stream.waitFor(3);
    expect(events[2]).toMatchObject({ type: "test.ping", seq: 4, data: { note: "d" } });
  });

  it("sends `ready` and `reset` when events after the cursor are pruned between two pages", async () => {
    // 1–101 are old, 102 and 103 are new. The hub reads 100 events a page.
    for (let i = 1; i <= 101; i++) await append(`old ${i}`);
    clock.advance(DAY);
    for (const note of ["new 102", "new 103"]) await append(note);
    clock.advance(30 * DAY);

    const stream = backend.hub.subscribe(0, abort.signal)[Symbol.asyncIterator]();
    const next = async (): Promise<StreamEvent | undefined> => {
      const result = await stream.next();
      return result.done === true ? undefined : result.value;
    };
    expect(await next()).toEqual({ type: "ready", data: { max_seq: 103 } });
    // The first page: events 1–100.
    for (let seq = 1; seq <= 100; seq++) expect(await next()).toMatchObject({ seq });

    // The job runs before the second page: 101 goes, which this subscriber has not sent.
    expect(await backend.eventPruning.pruneDue()).toBe(101);

    // Not 102: the client would miss 101 and keep stale state. It reloads, and the stream
    // continues after the newest event.
    expect(await next()).toEqual({ type: "ready", data: { max_seq: 103 } });
    expect(await next()).toEqual({ type: "reset", data: {} });
    await append("new 104");
    expect(await next()).toMatchObject({ type: "test.ping", seq: 104 });
  });

  it("sends `ready` and `reset` when every event after the cursor is pruned during a replay", async () => {
    for (let i = 1; i <= 101; i++) await append(`old ${i}`);
    clock.advance(31 * DAY);

    const stream = backend.hub.subscribe(0, abort.signal)[Symbol.asyncIterator]();
    const next = async (): Promise<StreamEvent | undefined> => {
      const result = await stream.next();
      return result.done === true ? undefined : result.value;
    };
    expect(await next()).toEqual({ type: "ready", data: { max_seq: 101 } });
    for (let seq = 1; seq <= 100; seq++) expect(await next()).toMatchObject({ seq });

    // Every stored event goes, 101 too, so the next page is empty.
    expect(await backend.eventPruning.pruneDue()).toBe(101);

    expect(await next()).toEqual({ type: "ready", data: { max_seq: 101 } });
    expect(await next()).toEqual({ type: "reset", data: {} });
    await append("new 102");
    expect(await next()).toMatchObject({ type: "test.ping", seq: 102 });
  });

  it("handles a gap once when the clock went back and the newest seq was pruned", async () => {
    // Event 1 is new. The clock goes back 40 days for event 2, then forward again, so the prune
    // deletes 2 and keeps 1: the newest kept seq is 1, but the last given seq stays 2.
    await append("new 1");
    clock.advance(-40 * DAY);
    await append("old 2");
    clock.advance(40 * DAY);
    expect(await backend.eventPruning.pruneDue()).toBe(1);

    const after = backend.readers.events.after.bind(backend.readers.events);
    let reads = 0;
    vi.spyOn(backend.readers.events, "after").mockImplementation((seq, limit) => {
      reads += 1;
      if (reads > MAX_READS) throw new Error(`reset loop: ${reads} reads without a new event`);
      return after(seq, limit);
    });

    // A client that saw event 1 resumes; 2 was pruned before it was sent.
    const stream = collect(backend.hub.subscribe(1, abort.signal));
    const types = () => stream.items.map((event) => event.type);
    expect((await stream.waitFor(3)).map((event) => event.type)).toEqual([
      "ready",
      "ready",
      "reset",
    ]);

    // One reset, then a wait: a zero-delay timer runs and no other event came.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(types()).toEqual(["ready", "ready", "reset"]);
    expect(reads).toBeLessThanOrEqual(4);

    // A reconnect with the id the reset gave (the high mark, 2) gets no second reset.
    const again = collect(backend.hub.subscribe(2, abort.signal));
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    expect(again.items).toEqual([{ type: "ready", data: { max_seq: 2 } }]);

    // A new event arrives, and no second reset.
    await append("new 3");
    expect((await stream.waitFor(4)).at(3)).toMatchObject({ type: "test.ping", seq: 3 });
    expect(types().filter((type) => type === "reset")).toHaveLength(1);
  });

  it("sends `reset` when the first event after an empty start is pruned before it is sent", async () => {
    // Every event pruned: the stream starts on an empty table, and the last given seq is 1.
    await append("old 1");
    clock.advance(31 * DAY);
    expect(await backend.eventPruning.pruneDue()).toBe(1);

    const after = backend.readers.events.after.bind(backend.readers.events);
    let reads = 0;
    vi.spyOn(backend.readers.events, "after").mockImplementation((seq, limit) => {
      reads += 1;
      if (reads > MAX_READS) throw new Error(`reset loop: ${reads} reads without a new event`);
      return after(seq, limit);
    });
    const stream = collect(backend.hub.subscribe(null, abort.signal));
    const types = () =>
      stream.items.map((event) => ("seq" in event ? `${event.type}:${event.seq}` : event.type));
    expect((await stream.waitFor(1)).map((event) => event.type)).toEqual(["ready"]);

    // Another process stores event 2 with an old time (no notify here), and the job prunes it
    // before this stream sends it. Then event 3 comes.
    clock.advance(-40 * DAY);
    await backend.uow.run((tx) =>
      tx.events.append({
        type: "test.ping",
        conversationId: null,
        payload: { note: "old 2" },
        createdAt: clock.now(),
      }),
    );
    clock.advance(40 * DAY);
    expect(await backend.eventPruning.pruneDue()).toBe(1);
    await append("new 3");

    await stream.waitFor(4, 500).catch(() => undefined);
    expect(types()).toEqual(["ready", "ready", "reset", "test.ping:3"]);
  });

  it("wakes a waiting subscriber when a prune removes an event it has not sent", async () => {
    for (const note of ["a", "b", "c"]) await append(note);
    const stream = collect(backend.hub.subscribe(3, abort.signal));
    expect((await stream.waitFor(1)).map((event) => event.type)).toEqual(["ready"]);

    // Another process (a CLI command) stores event 4; this hub gets no notify for it.
    await backend.uow.run((tx) =>
      tx.events.append({
        type: "test.ping",
        conversationId: null,
        payload: { note: "from another process" },
        createdAt: clock.now(),
      }),
    );
    clock.advance(31 * DAY);
    expect(await backend.eventPruning.pruneDue()).toBe(4);

    const events = await stream.waitFor(3, 500);
    expect(events.slice(1).map((event) => event.type)).toEqual(["ready", "reset"]);
  });
});
