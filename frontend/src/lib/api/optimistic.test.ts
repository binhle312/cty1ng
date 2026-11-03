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
