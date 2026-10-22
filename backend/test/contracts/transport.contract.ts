import type { StreamEvent } from "@cty1ng/shared";
import { expect } from "vitest";
import type { StreamCursor } from "../../src/core/ports/transport";
import { defineContract } from "./runner";

/** One subscriber's view of the stream, decoded from whatever the transport sends. */
export interface TransportConnection {
  next(): Promise<StreamEvent>;
  close(): Promise<void>;
}

export interface TransportSubject {
  /** Appends a `test.ping` event through the normal write path and returns its seq. */
  append(note: string): Promise<number>;
  connect(cursor: StreamCursor): Promise<TransportConnection>;
  /** Deletes events up to and including `seq`, as retention pruning will. */
  pruneThrough(seq: number): Promise<void>;
}

async function take(connection: TransportConnection, count: number): Promise<StreamEvent[]> {
  const events: StreamEvent[] = [];
  for (let i = 0; i < count; i += 1) events.push(await connection.next());
  return events;
}

function seqs(events: StreamEvent[]): number[] {
  return events.map((event) => ("seq" in event ? event.seq : -1));
}

/** realtime-events.md §1a, §2: replay, gap and ordering, independent of the wire format. */
export const transportContract = defineContract<TransportSubject>("transport", {
  "fresh connection gets ready with the max seq and nothing old": async (t) => {
    await t.append("a");
    const max = await t.append("b");
    const connection = await t.connect({ kind: "fresh" });
    expect(await connection.next()).toEqual({ type: "ready", data: { max_seq: max } });
    const live = await t.append("live");
    expect(await connection.next()).toEqual({
      type: "test.ping",
      seq: live,
      data: { note: "live" },
    });
    await connection.close();
  },

  "fresh connection on an empty log gets ready with max seq 0": async (t) => {
    const connection = await t.connect({ kind: "fresh" });
    expect(await connection.next()).toEqual({ type: "ready", data: { max_seq: 0 } });
    await connection.close();
  },

  "replays every event after the cursor in order, then live ones": async (t) => {
    const first = await t.append("1");
    const second = await t.append("2");
    const third = await t.append("3");
    const connection = await t.connect({ kind: "after", seq: first });
    const [ready, ...replayed] = await take(connection, 3);
    expect(ready).toEqual({ type: "ready", data: { max_seq: third } });
    expect(seqs(replayed)).toEqual([second, third]);
    const live = await t.append("4");
    expect(seqs([await connection.next()])).toEqual([live]);
    await connection.close();
  },

  "a cursor at the newest event replays nothing": async (t) => {
    const last = await t.append("1");
    const connection = await t.connect({ kind: "after", seq: last });
    expect(await connection.next()).toEqual({ type: "ready", data: { max_seq: last } });
    const live = await t.append("2");
    expect(seqs([await connection.next()])).toEqual([live]);
    await connection.close();
  },

  "a cursor older than the kept log gets reset, then ready, then live events": async (t) => {
    await t.append("1");
    const second = await t.append("2");
    const third = await t.append("3");
    await t.pruneThrough(second);
    const connection = await t.connect({ kind: "after", seq: second - 1 });
    expect(await connection.next()).toEqual({ type: "reset", data: {} });
    expect(await connection.next()).toEqual({ type: "ready", data: { max_seq: third } });
    const live = await t.append("4");
    expect(seqs([await connection.next()])).toEqual([live]);
    await connection.close();
  },

  "a cursor just before the oldest kept event still replays without a gap": async (t) => {
    await t.append("1");
    const second = await t.append("2");
    const third = await t.append("3");
    await t.pruneThrough(second);
    const connection = await t.connect({ kind: "after", seq: second });
    const [ready, replayed] = await take(connection, 2);
    expect(ready?.type).toBe("ready");
    expect(seqs(replayed === undefined ? [] : [replayed])).toEqual([third]);
    await connection.close();
  },

  "a cursor ahead of the log gets reset": async (t) => {
    const last = await t.append("1");
    const connection = await t.connect({ kind: "after", seq: last + 10 });
    expect(await connection.next()).toEqual({ type: "reset", data: {} });
    expect(await connection.next()).toEqual({ type: "ready", data: { max_seq: last } });
    await connection.close();
  },

  "an unusable cursor gets reset": async (t) => {
    await t.append("1");
    const connection = await t.connect({ kind: "unusable" });
    expect((await connection.next()).type).toBe("reset");
    await connection.close();
  },

  "parallel appends arrive once each, in strictly increasing seq order": async (t) => {
    const connection = await t.connect({ kind: "fresh" });
    expect((await connection.next()).type).toBe("ready");
    const appended = await Promise.all(Array.from({ length: 30 }, (_, i) => t.append(`p${i}`)));
    const received = seqs(await take(connection, appended.length));
    expect(received).toEqual([...appended].sort((a, b) => a - b));
    for (let i = 1; i < received.length; i += 1) {
      expect(received[i]).toBeGreaterThan(received[i - 1] ?? Infinity);
    }
    await connection.close();
  },

  "no duplicates or gaps where replay meets live delivery": async (t) => {
    const before = await Promise.all(Array.from({ length: 5 }, (_, i) => t.append(`old${i}`)));
    const connection = await t.connect({ kind: "after", seq: 0 });
    // Append while the subscriber is still replaying.
    const appending = Promise.all(Array.from({ length: 5 }, (_, i) => t.append(`new${i}`)));
    const events = await take(connection, 1 + 10);
    const after = await appending;
    expect(events[0]?.type).toBe("ready");
    expect(seqs(events.slice(1))).toEqual([...before, ...after].sort((a, b) => a - b));
    await connection.close();
  },
});
