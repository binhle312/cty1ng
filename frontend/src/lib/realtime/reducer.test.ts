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

  it("on reset, forgets the cursor and refetches everything", async () => {
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
    reducer.apply({ type: "reset", data: {} });
    expect(reducer.lastSeq).toBeNull();
    // A new database starts its seq again from 1.
    expect(reducer.apply(ping(1))).toBe(true);
    expect(queryClient.getQueryState(["anything"])?.isInvalidated).toBe(true);
  });
});
