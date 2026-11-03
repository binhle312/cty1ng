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
    const end = showUntilAnswered<string[]>({
      queryClient,
      queryKey: KEY,
      kind: "pins",
      change: (list) => [...list, "mine"],
    });
    expect(queryClient.getQueryData(KEY)).toEqual(["a", "mine"]);
    await serverLoad(queryClient, ["b"]);
    expect(queryClient.getQueryData(KEY)).toEqual(["b", "mine"]);
    end();
    await serverLoad(queryClient, ["c"]);
    expect(queryClient.getQueryData(KEY)).toEqual(["c"]);
  });

  it("is replaced by a newer change of the same kind, and an end of the older one does nothing", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(KEY, ["a"]);
    const endOlder = showUntilAnswered<string[]>({
      queryClient,
      queryKey: KEY,
      kind: "pins",
      change: () => ["older"],
    });
    const endNewer = showUntilAnswered<string[]>({
      queryClient,
      queryKey: KEY,
      kind: "pins",
      change: () => ["newer"],
    });
    endNewer();
    await serverLoad(queryClient, ["server"]);
    endOlder();
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
    });
    showUntilAnswered<string[]>({
      queryClient,
      queryKey: KEY,
      kind: "sort",
      change: (list) => [...list].reverse(),
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
      alsoAfter: [["order"]],
    });
    expect(queryClient.getQueryData(KEY)).toEqual(["a", "b"]);
    await queryClient.query({ queryKey: ["order"], queryFn: () => "desc", staleTime: 0 });
    expect(queryClient.getQueryData(KEY)).toEqual(["b", "a"]);
  });
});
