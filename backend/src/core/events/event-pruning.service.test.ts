import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { manualClock, testBackend } from "../../../test/helpers.ts";

// The event pruning job on a temporary database (domain-model.md §8, invariant: seq never goes
// back). The default retention is 30 days.

const DAY = 86_400_000;
const RETENTION = 30 * DAY;

let clock: ReturnType<typeof manualClock>;
let backend: ReturnType<typeof testBackend>;
beforeEach(() => {
  clock = manualClock();
  backend = testBackend({}, { clock });
});
afterEach(() => {
  backend.close();
});

const append = (note: string) =>
  backend.uow.run((tx) =>
    backend.appendEvent(tx, { event: { type: "test.ping", data: { note } }, conversationId: null }),
  );

const kept = async () =>
  (await backend.readers.events.after(0, 100)).map((event) => [event.seq, event.payload]);

describe("event pruning", () => {
  it("deletes an event 1 ms before the cutoff and keeps one at the cutoff and after it", async () => {
    await append("before");
    clock.advance(1);
    await append("at");
    clock.advance(1);
    await append("after");
    // now − 30 days is the second event's created_at exactly.
    clock.advance(RETENTION - 1);
    expect(await backend.eventPruning.pruneDue()).toBe(1);
    expect(await kept()).toEqual([
      [2, { note: "at" }],
      [3, { note: "after" }],
    ]);
  });

  it("uses EVENT_RETENTION_DAYS", async () => {
    backend.close();
    backend = testBackend({ EVENT_RETENTION_DAYS: "2" }, { clock });
    await append("old");
    clock.advance(2 * DAY + 1);
    await append("new");
    expect(await backend.eventPruning.pruneDue()).toBe(1);
    expect(await kept()).toEqual([[2, { note: "new" }]]);
  });

  it("deletes every event when all are old, and a new event gets a seq above every pruned one", async () => {
    for (const note of ["a", "b", "c"]) await append(note);
    clock.advance(RETENTION + 1);
    expect(await backend.eventPruning.pruneDue()).toBe(3);
    expect(await backend.readers.events.bounds()).toEqual({ oldest: null, newest: null });
    expect(await append("d")).toBe(4);
    expect(await kept()).toEqual([[4, { note: "d" }]]);
  });

  it("writes no event and finds nothing on a second run", async () => {
    await append("a");
    clock.advance(RETENTION + 1);
    await append("b");
    expect(await backend.eventPruning.pruneDue()).toBe(1);
    expect(await backend.eventPruning.pruneDue()).toBe(0);
    const sqlite = new Database(backend.config.databaseFile, { readonly: true });
    expect(sqlite.prepare("SELECT seq, type FROM events").all()).toEqual([
      { seq: 2, type: "test.ping" },
    ]);
    sqlite.close();
  });
});
