import { describe, expect, it } from "vitest";
import { toggled, withItem } from "./sets.ts";

describe("set changes for React state", () => {
  it("flips an item, and never changes the set it got", () => {
    const set: ReadonlySet<string> = new Set(["a"]);
    expect([...toggled(set, "b")]).toEqual(["a", "b"]);
    expect([...toggled(set, "a")]).toEqual([]);
    expect([...set]).toEqual(["a"]);
  });

  it("puts an item in or takes it out as asked, also when it is already so", () => {
    const set: ReadonlySet<string> = new Set(["a"]);
    expect([...withItem({ set, item: "b", on: true })]).toEqual(["a", "b"]);
    expect([...withItem({ set, item: "a", on: true })]).toEqual(["a"]);
    expect([...withItem({ set, item: "a", on: false })]).toEqual([]);
    expect([...withItem({ set, item: "b", on: false })]).toEqual(["a"]);
    expect([...set]).toEqual(["a"]);
  });
});
