import type { StreamEvent } from "@cty1ng/shared/events";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Transport } from "../../src/core/ports/transport.ts";
import { collect, sleep } from "../helpers.ts";

// The transport contract (realtime-events.md §1a, §2). Every transport adapter runs it: replay,
// the gap rule, ordering, and "only committed events".
export interface TransportFixture {
  transport: Transport;
  // Appends a `test.ping` in its own transaction; returns the seq.
  append(note: string): Promise<number>;
  // Appends a `test.ping` in a transaction that ends only when `hold` resolves, then commits or
  // rolls back.
  appendHeld(note: string, hold: Promise<void>, outcome: "commit" | "rollback"): Promise<void>;
  // Deletes the kept events with seq below `seq`, as the event pruning does.
  pruneBefore(seq: number): void;
  close(): void | Promise<void>;
}

const notes = (events: StreamEvent[]) =>
  events.map((event) =>
    event.type === "test.ping" ? `${event.seq}:${event.data.note}` : event.type,
  );

export function transportContract(
  name: string,
  setup: () => TransportFixture | Promise<TransportFixture>,
) {
  describe(`transport contract: ${name}`, () => {
    let fixture: TransportFixture;
    let abort: AbortController;
    const subscribe = (afterSeq: number | null) =>
      collect(fixture.transport.subscribe(afterSeq, abort.signal));

    beforeEach(async () => {
      fixture = await setup();
      abort = new AbortController();
    });
    afterEach(async () => {
      abort.abort();
      await fixture.close();
    });

    it("starts a first subscription with `ready` and sends nothing older", async () => {
      await fixture.append("old-1");
      await fixture.append("old-2");
      const stream = subscribe(null);
      expect(await stream.waitFor(1)).toEqual([{ type: "ready", data: { max_seq: 2 } }]);
      await fixture.append("new");
      expect(notes(await stream.waitFor(2))).toEqual(["ready", "3:new"]);
    });

    it("replays the events after the cursor, then sends live ones", async () => {
      for (const note of ["a", "b", "c"]) await fixture.append(note);
      const stream = subscribe(1);
      expect(notes(await stream.waitFor(3))).toEqual(["ready", "2:b", "3:c"]);
      await fixture.append("d");
      expect(notes(await stream.waitFor(4))).toEqual(["ready", "2:b", "3:c", "4:d"]);
    });

    it("replays nothing when the cursor is the newest seq", async () => {
      await fixture.append("a");
      const stream = subscribe(1);
      await stream.waitFor(1);
      await sleep(50);
      expect(notes(stream.items)).toEqual(["ready"]);
    });

    it("works on an empty log with cursor 0", async () => {
      const stream = subscribe(0);
      await fixture.append("first");
      expect(notes(await stream.waitFor(2))).toEqual(["ready", "1:first"]);
    });

    it("sends `reset` for a cursor newer than the newest event (the database was reset)", async () => {
      await fixture.append("a");
      const stream = subscribe(99);
      expect(notes(await stream.waitFor(2))).toEqual(["ready", "reset"]);
      await fixture.append("b");
      expect(notes(await stream.waitFor(3))).toEqual(["ready", "reset", "2:b"]);
    });

    it("sends `reset` for a cursor older than the oldest kept event (the gap rule)", async () => {
      for (const note of ["a", "b", "c", "d"]) await fixture.append(note);
      fixture.pruneBefore(3);
      const tooOld = subscribe(1);
      expect(notes(await tooOld.waitFor(2))).toEqual(["ready", "reset"]);
      await sleep(30);
      expect(notes(tooOld.items)).toEqual(["ready", "reset"]);
      // Cursor 2: the next event it needs (3) is still kept, so no reset.
      const justKept = subscribe(2);
      expect(notes(await justKept.waitFor(3))).toEqual(["ready", "3:c", "4:d"]);
    });

    it("keeps seq order with no gaps under parallel appends", async () => {
      const stream = subscribe(null);
      await stream.waitFor(1);
      await Promise.all(Array.from({ length: 30 }, (_, i) => fixture.append(`p${i}`)));
      const seqs = (await stream.waitFor(31)).flatMap((event) =>
        "seq" in event ? [event.seq] : [],
      );
      expect(seqs).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    });

    it("sends an event only after its transaction commits, and never after a rollback", async () => {
      const stream = subscribe(null);
      await stream.waitFor(1);

      let release = (): void => undefined;
      const held = fixture.appendHeld(
        "held",
        new Promise((resolve) => (release = resolve)),
        "commit",
      );
      await sleep(50);
      expect(notes(stream.items)).toEqual(["ready"]);
      release();
      await held;
      expect(notes(await stream.waitFor(2))).toEqual(["ready", "1:held"]);

      await fixture.appendHeld("rolled-back", Promise.resolve(), "rollback");
      await fixture.append("after");
      const items = notes(await stream.waitFor(3));
      expect(items.at(-1)).toMatch(/:after$/);
      expect(items.join()).not.toContain("rolled-back");
    });

    it("ends when the signal aborts", async () => {
      const stream = subscribe(null);
      await stream.waitFor(1);
      abort.abort();
      await sleep(50);
      expect(stream.done).toBe(true);
    });
  });
}
