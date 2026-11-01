import { describe, expect, it } from "vitest";
import { arrangeFrozen, headerDrop, OTHERS_ZONE, PINNED_ZONE } from "./header-order.ts";

describe("deferred reordering of the others (UI-2.9)", () => {
  it("shows the current order when nothing is frozen", () => {
    expect(arrangeFrozen(null, ["c", "a", "b"])).toEqual(["c", "a", "b"]);
  });

  it("keeps the frozen order while activity moves bots", () => {
    expect(arrangeFrozen(["a", "b", "c"], ["c", "a", "b"])).toEqual(["a", "b", "c"]);
  });

  it("adds a new bot at the end and drops a bot that left", () => {
    expect(arrangeFrozen(["a", "b", "c"], ["d", "c", "a"])).toEqual(["a", "c", "d"]);
  });
});

describe("a drop in the header (top-header.md §3)", () => {
  const pinned = ["p1", "p2"];
  const others = ["o1", "o2"];
  const drop = (active: string, over: string | null) =>
    headerDrop({ active, over, pinned, others });

  it("pins an other where it is dropped among the pinned", () => {
    expect(drop("o1", "p2")).toEqual({ kind: "pin_at", index: 1 });
  });

  it("pins an other at the end when it is dropped on the pinned zone", () => {
    expect(drop("o1", PINNED_ZONE)).toEqual({ kind: "pin_end" });
  });

  it("moves a pinned bot among the pinned", () => {
    expect(drop("p2", "p1")).toEqual({ kind: "pin_at", index: 0 });
  });

  it("unpins a pinned bot dropped among the others", () => {
    expect(drop("p1", "o2")).toEqual({ kind: "unpin" });
    expect(drop("p1", OTHERS_ZONE)).toEqual({ kind: "unpin" });
  });

  it("does nothing for an other dropped among the others, or outside", () => {
    expect(drop("o1", "o2")).toEqual({ kind: "none" });
    expect(drop("o1", null)).toEqual({ kind: "none" });
  });
});
