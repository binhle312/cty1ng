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

    // A reconnect on the same hub, with the cursor of the last event it saw.
    const stream = collect(backend.hub.subscribe(3, abort.signal));
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
    const next = async () => (await stream.next()).value;
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
});
