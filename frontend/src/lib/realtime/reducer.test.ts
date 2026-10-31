import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { createEventReducer, TEST_PINGS_KEY } from "./reducer.ts";

const ping = (seq: number, note = `n${String(seq)}`) =>
  ({ type: "test.ping", seq, data: { note } }) as const;

function setup() {
  const queryClient = new QueryClient();
  const reducer = createEventReducer(queryClient);
  const notes = () => queryClient.getQueryData<string[]>(TEST_PINGS_KEY) ?? [];
  return { queryClient, reducer, notes };
}

// realtime-events.md §3: applying an event twice has the same result as once.
describe("event reducer", () => {
  it("applies an event once when it arrives twice", () => {
    const { reducer, notes } = setup();
    expect(reducer.apply(ping(5))).toBe(true);
    expect(reducer.apply(ping(5))).toBe(false);
    expect(notes()).toEqual(["n5"]);
    expect(reducer.lastSeq).toBe(5);
  });

  it("skips an older event and keeps the order of newer ones", () => {
    const { reducer, notes } = setup();
    reducer.apply(ping(3));
    reducer.apply(ping(4));
    reducer.apply(ping(2));
    reducer.apply(ping(6));
    expect(notes()).toEqual(["n3", "n4", "n6"]);
  });

  it("starts at the newest event on a first ready, and keeps its cursor on a later one", () => {
    const { reducer, notes } = setup();
    reducer.apply({ type: "ready", data: { max_seq: 10 } });
    expect(reducer.apply(ping(10))).toBe(false);
    reducer.apply(ping(11));
    // A reconnect: the server replays from the cursor, so a later ready must not skip it.
    reducer.apply({ type: "ready", data: { max_seq: 20 } });
    expect(reducer.apply(ping(12))).toBe(true);
    expect(notes()).toEqual(["n11", "n12"]);
  });

  it("on reset, moves the cursor to where the server continues and refetches everything", async () => {
    const { queryClient, reducer } = setup();
    let fetches = 0;
    await queryClient.query({
      queryKey: ["anything"],
      queryFn: () => {
        fetches += 1;
        return fetches;
      },
    });
    reducer.apply(ping(50));
    // A new database: the server sends ready with its newest seq, then reset.
    reducer.apply({ type: "ready", data: { max_seq: 0 } });
    reducer.apply({ type: "reset", data: {} });
    expect(reducer.lastSeq).toBe(0);
    // The new database starts its seq again from 1.
    expect(reducer.apply(ping(1))).toBe(true);
    expect(queryClient.getQueryState(["anything"])?.isInvalidated).toBe(true);
  });

  it("on a reset during a replay, moves the cursor past the pruned events and refetches", () => {
    const { queryClient, reducer, notes } = setup();
    queryClient.setQueryData(["anything"], 1);
    // A client that saw event 1 resumes; the server replays from 2.
    reducer.apply(ping(1));
    reducer.apply({ type: "ready", data: { max_seq: 103 } });
    reducer.apply(ping(2));
    reducer.apply(ping(100));
    // The server pruned 101 before it sent it: ready with the newest seq, then reset.
    reducer.apply({ type: "ready", data: { max_seq: 103 } });
    reducer.apply({ type: "reset", data: {} });
    expect(reducer.lastSeq).toBe(103);
    expect(queryClient.getQueryState(["anything"])?.isInvalidated).toBe(true);
    expect(reducer.apply(ping(103))).toBe(false);
    expect(reducer.apply(ping(104))).toBe(true);
    expect(notes()).toEqual(["n1", "n2", "n100", "n104"]);
  });

  it("after a reset, applies the events a later reconnect replays", () => {
    const { reducer, notes } = setup();
    reducer.apply({ type: "ready", data: { max_seq: 10 } });
    // A reconnect with a cursor the server no longer has: ready, then reset. The stream
    // continues after 20.
    reducer.apply({ type: "ready", data: { max_seq: 20 } });
    reducer.apply({ type: "reset", data: {} });
    // The stream drops before any event arrives. The next reconnect resumes after 20, and the
    // server replays 21 and 22 after its ready.
    reducer.apply({ type: "ready", data: { max_seq: 22 } });
    expect(reducer.apply(ping(21))).toBe(true);
    expect(reducer.apply(ping(22))).toBe(true);
    expect(notes()).toEqual(["n21", "n22"]);
  });
});
