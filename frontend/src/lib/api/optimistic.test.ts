import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { showUntilAnswered } from "./optimistic.ts";

// A change on its way shows over every server load until its answer; a newer change of the same
// kind replaces it, so an older one that answers last never brings its value back (pin.md §2).
const KEY = ["list"];

async function serverLoad(queryClient: QueryClient, data: string[]) {
  await queryClient.query({ queryKey: KEY, queryFn: () => data, staleTime: 0 });
}

describe("a change on its way", () => {
  it("shows over a server load until it is ended", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(KEY, ["a"]);
    const held = showUntilAnswered<string[]>({
      queryClient,
      queryKey: KEY,
      kind: "pins",
      change: (list) => [...list, "mine"],
      undo: (list) => list.filter((item) => item !== "mine"),
    });
    expect(queryClient.getQueryData(KEY)).toEqual(["a", "mine"]);
    await serverLoad(queryClient, ["b"]);
    expect(queryClient.getQueryData(KEY)).toEqual(["b", "mine"]);
    held.answered();
    await serverLoad(queryClient, ["c"]);
    expect(queryClient.getQueryData(KEY)).toEqual(["c"]);
  });

  it("is replaced by a newer change of the same kind, and an end of the older one does nothing", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(KEY, ["a"]);
    const older = showUntilAnswered<string[]>({
      queryClient,
      queryKey: KEY,
      kind: "pins",
      change: () => ["older"],
      undo: () => ["before older"],
    });
    const newer = showUntilAnswered<string[]>({
      queryClient,
      queryKey: KEY,
      kind: "pins",
      change: () => ["newer"],
      undo: () => ["before newer"],
    });
    newer.answered();
    await serverLoad(queryClient, ["server"]);
    // The older one was replaced: its refusal takes nothing back.
    older.refused();
    expect(queryClient.getQueryData(KEY)).toEqual(["server"]);
  });

  it("keeps a change of another kind, applied in the order they started", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(KEY, ["a"]);
    showUntilAnswered<string[]>({
      queryClient,
      queryKey: KEY,
      kind: "pins",
      change: (list) => [...list, "pin"],
      undo: (list) => list,
    });
    showUntilAnswered<string[]>({
      queryClient,
      queryKey: KEY,
      kind: "sort",
      change: (list) => [...list].reverse(),
      undo: (list) => list,
    });
    await serverLoad(queryClient, ["b"]);
    expect(queryClient.getQueryData(KEY)).toEqual(["pin", "b"]);
  });

  it("puts the change again after a load of a query it reads", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(KEY, ["a", "b"]);
    queryClient.setQueryData(["order"], "asc");
    showUntilAnswered<string[]>({
      queryClient,
      queryKey: KEY,
      kind: "pins",
      change: (list) =>
        [...list].sort((x, y) =>
          queryClient.getQueryData(["order"]) === "asc" ? x.localeCompare(y) : y.localeCompare(x),
        ),
      undo: (list) => list,
      alsoAfter: [["order"]],
    });
    expect(queryClient.getQueryData(KEY)).toEqual(["a", "b"]);
    await queryClient.query({ queryKey: ["order"], queryFn: () => "desc", staleTime: 0 });
    expect(queryClient.getQueryData(KEY)).toEqual(["b", "a"]);
  });

  // Review of the 571375a fixes: a pin change that reads the sort started before a sort change;
  // a settings load put the pin change back first, so it read the server's sort.
  it("puts a change back on a loaded query before a change that only reads it", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(KEY, ["a", "b"]);
    queryClient.setQueryData(["order"], "asc");
    showUntilAnswered<string[]>({
      queryClient,
      queryKey: KEY,
      kind: "pins",
      change: (list) =>
        [...list].sort((x, y) =>
          queryClient.getQueryData(["order"]) === "asc" ? x.localeCompare(y) : y.localeCompare(x),
        ),
      undo: (list) => list,
      alsoAfter: [["order"]],
    });
    showUntilAnswered<string>({
      queryClient,
      queryKey: ["order"],
      kind: "sort",
      change: () => "desc",
      undo: () => "asc",
    });
    await queryClient.query({ queryKey: ["order"], queryFn: () => "asc", staleTime: 0 });
    expect(queryClient.getQueryData(["order"])).toBe("desc");
    expect(queryClient.getQueryData(KEY)).toEqual(["b", "a"]);
  });

  it("takes a refused change back at once, with no server load after it", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(KEY, ["a", "b"]);
    const held = showUntilAnswered<string[]>({
      queryClient,
      queryKey: KEY,
      kind: "remove b",
      change: (list) => list.filter((item) => item !== "b"),
      undo: (list) => (list.includes("b") ? list : [...list, "b"]),
    });
    expect(queryClient.getQueryData(KEY)).toEqual(["a"]);
    held.refused();
    expect(queryClient.getQueryData(KEY)).toEqual(["a", "b"]);
  });
});

// Changes of one kind that wait at the same time: each holds the whole value, made from the page
// with the older ones in it, so its undo is only the value of the change before it. A refusal
// must end with the page on the last value the server has (review of 571375a).
describe("changes of one kind that wait at the same time", () => {
  // A pinned list: `next` is the whole value, `expected` the one the page showed before.
  function pinChange(
    queryClient: QueryClient,
    { expected, next }: { expected: string[]; next: string[] },
  ) {
    return showUntilAnswered<string[]>({
      queryClient,
      queryKey: KEY,
      kind: "pins",
      change: () => next,
      undo: () => expected,
    });
  }

  function twoChanges() {
    const queryClient = new QueryClient();
    queryClient.setQueryData(KEY, ["BA"]);
    const unpinBa = pinChange(queryClient, { expected: ["BA"], next: [] });
    const pinUx = pinChange(queryClient, { expected: [], next: ["UX"] });
    expect(queryClient.getQueryData(KEY)).toEqual(["UX"]);
    return { queryClient, unpinBa, pinUx };
  }

  it("shows the server's value when the older one fails first, then the newer one", () => {
    const { queryClient, unpinBa, pinUx } = twoChanges();
    unpinBa.refused();
    // The newer one still waits and holds the whole value.
    expect(queryClient.getQueryData(KEY)).toEqual(["UX"]);
    pinUx.refused();
    expect(queryClient.getQueryData(KEY)).toEqual(["BA"]);
  });

  it("shows the older value while it waits when the newer one fails first, then the server's", async () => {
    const { queryClient, unpinBa, pinUx } = twoChanges();
    pinUx.refused();
    expect(queryClient.getQueryData(KEY)).toEqual([]);
    // The older one waits still: it shows over a load, as one change alone does.
    await serverLoad(queryClient, ["BA"]);
    expect(queryClient.getQueryData(KEY)).toEqual([]);
    unpinBa.refused();
    expect(queryClient.getQueryData(KEY)).toEqual(["BA"]);
  });

  it("shows the older value when it was saved and the newer one fails", () => {
    const { queryClient, unpinBa, pinUx } = twoChanges();
    unpinBa.answered();
    pinUx.refused();
    expect(queryClient.getQueryData(KEY)).toEqual([]);
  });

  it("takes nothing back when the newer one was saved and the older one fails late", async () => {
    const { queryClient, unpinBa, pinUx } = twoChanges();
    pinUx.answered();
    await serverLoad(queryClient, ["UX"]);
    unpinBa.refused();
    expect(queryClient.getQueryData(KEY)).toEqual(["UX"]);
  });

  it("goes back past a failed middle change to the one that still waits", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(KEY, ["BA"]);
    const first = pinChange(queryClient, { expected: ["BA"], next: [] });
    const middle = pinChange(queryClient, { expected: [], next: ["UX"] });
    const last = pinChange(queryClient, { expected: ["UX"], next: ["UX", "QA"] });
    middle.refused();
    expect(queryClient.getQueryData(KEY)).toEqual(["UX", "QA"]);
    last.refused();
    // The first one waits still, so the page shows its value, also over a load.
    expect(queryClient.getQueryData(KEY)).toEqual([]);
    await serverLoad(queryClient, ["BA"]);
    expect(queryClient.getQueryData(KEY)).toEqual([]);
    first.answered();
    await serverLoad(queryClient, []);
    expect(queryClient.getQueryData(KEY)).toEqual([]);
  });

  it("ends the older ones too when a newer one is saved", async () => {
    const { queryClient, unpinBa, pinUx } = twoChanges();
    pinUx.answered();
    await serverLoad(queryClient, ["server"]);
    expect(queryClient.getQueryData(KEY)).toEqual(["server"]);
    unpinBa.answered();
    expect(queryClient.getQueryData(KEY)).toEqual(["server"]);
  });
});
