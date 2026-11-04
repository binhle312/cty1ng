import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";
import { readNewest, refreshQueries } from "./query-reads.ts";

// These run the real TanStack Query: the behaviour they hold is the library's, and a mock would
// only repeat what the helpers assume. A load that a newer load cuts short gives up its promise to
// the newer load, once. If that load is cut too, the first caller gets a `CancelledError`, or an
// `invalidateQueries` that ended, with the old data still in the list.
const KEY = ["things"];
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

interface Load {
  answer: (data: string[]) => void;
  fail: (error: Error) => void;
}

function list() {
  const loads: Load[] = [];
  const queryFn = ({ signal }: { signal: AbortSignal }) =>
    new Promise<string[]>((resolve, reject) => {
      loads.push({ answer: resolve, fail: reject });
      signal.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"));
      });
    });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(KEY, ["old"]);
  const observer = new QueryObserver(queryClient, { queryKey: KEY, queryFn, staleTime: Infinity });
  const stop = observer.subscribe(() => undefined);
  stops.push(stop);
  const cut = async (times: number) => {
    for (let time = 0; time < times; time += 1) {
      void queryClient.invalidateQueries({ queryKey: KEY });
      await settle();
    }
  };
  return { queryClient, queryFn, loads, cut, stop };
}

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
});

describe.each([0, 1, 2, 3])("a load cut short %i times", (cuts) => {
  it("gives a read the newest list", async () => {
    const { queryClient, queryFn, loads, cut } = list();
    const read = readNewest(() => queryClient.query({ queryKey: KEY, queryFn, staleTime: 0 }));
    await settle();
    await cut(cuts);
    expect(loads).toHaveLength(cuts + 1);
    loads.at(-1)?.answer(["new"]);
    await expect(read).resolves.toEqual(["new"]);
  });

  it("ends a refresh only after the newest list is in", async () => {
    const { queryClient, loads, cut } = list();
    let ended = false;
    void refreshQueries(queryClient, { queryKey: KEY }).then(() => {
      ended = true;
    });
    await settle();
    await cut(cuts);
    expect(loads).toHaveLength(cuts + 1);
    expect(ended).toBe(false);
    loads.at(-1)?.answer(["new"]);
    await settle();
    expect(queryClient.getQueryData(KEY)).toEqual(["new"]);
    expect(ended).toBe(true);
  });
});

describe("readNewest", () => {
  it("still fails when the newest load fails", async () => {
    const { queryClient, queryFn, loads, cut } = list();
    const read = readNewest(() => queryClient.query({ queryKey: KEY, queryFn, staleTime: 0 }));
    await settle();
    await cut(2);
    loads.at(-1)?.fail(new Error("no list"));
    await expect(read).rejects.toThrow("no list");
  });

  it("loads again when the query left the cache while it read", async () => {
    const { queryClient, queryFn, loads } = list();
    const read = readNewest(() => queryClient.query({ queryKey: KEY, queryFn, staleTime: 0 }));
    await settle();
    queryClient.removeQueries({ queryKey: KEY });
    await settle();
    expect(loads).toHaveLength(2);
    loads.at(-1)?.answer(["new"]);
    await expect(read).resolves.toEqual(["new"]);
  });
});

describe("refreshQueries", () => {
  it("ends when the newest load fails: the list stays as it was", async () => {
    const { queryClient, loads, cut } = list();
    let ended = false;
    void refreshQueries(queryClient, { queryKey: KEY }).then(() => {
      ended = true;
    });
    await settle();
    await cut(2);
    expect(ended).toBe(false);
    loads.at(-1)?.fail(new Error("no list"));
    await settle();
    expect(ended).toBe(true);
    expect(queryClient.getQueryData(KEY)).toEqual(["old"]);
  });

  it("leaves no listener on the cache after it ends", async () => {
    const { queryClient, loads, cut } = list();
    void refreshQueries(queryClient, { queryKey: KEY });
    await settle();
    await cut(2);
    expect(queryClient.getQueryCache().hasListeners()).toBe(true);
    loads.at(-1)?.answer(["new"]);
    await settle();
    expect(queryClient.getQueryCache().hasListeners()).toBe(false);
  });

  it("ends at once when nothing loads", async () => {
    const queryClient = new QueryClient();
    await expect(refreshQueries(queryClient, { queryKey: KEY })).resolves.toBeUndefined();
  });

  it("leaves a load of another list out", async () => {
    const { queryClient, queryFn, loads } = list();
    const other = ["others"];
    queryClient.setQueryData(other, ["old"]);
    const observer = new QueryObserver(queryClient, {
      queryKey: other,
      queryFn,
      staleTime: Infinity,
    });
    stops.push(observer.subscribe(() => undefined));
    void queryClient.invalidateQueries({ queryKey: other });
    await settle();
    let ended = false;
    void refreshQueries(queryClient, { queryKey: KEY }).then(() => {
      ended = true;
    });
    await settle();
    loads.at(-1)?.answer(["new"]);
    await settle();
    expect(ended).toBe(true);
  });
});
