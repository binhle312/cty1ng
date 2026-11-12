import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";
import { readNewest, refreshQueries } from "./query-reads.ts";

// These run the real TanStack Query: the behaviour they hold is the library's, and a mock would
// only repeat what the helpers assume. Since 5.105.2, a load that a newer load cuts short gives
// its promise to the newer load at each cut, so the tests of 0 to 3 cuts also pass with the plain
// library calls. The tests below hold two cases where a helper does work: a cut that gives the old
// list back and then a new load (`refreshQueries`), and a query that leaves the cache during a
// read (`readNewest`).
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

  // `invalidateQueries()` follows a cut by a newer load, but not this cut: `cancelQueries()` gives
  // the old list back to the code that waits, and a new load starts after it. The second step of
  // the helper waits for that load.
  const cutWithTheOldList = (queryClient: QueryClient) => {
    void queryClient.cancelQueries({ queryKey: KEY });
    void queryClient.invalidateQueries({ queryKey: KEY });
  };

  it("ends only after the new list when a cut gives the old list back", async () => {
    const { queryClient, loads } = list();
    let ended = false;
    void refreshQueries(queryClient, { queryKey: KEY }).then(() => {
      ended = true;
    });
    await settle();
    cutWithTheOldList(queryClient);
    await settle();
    expect(loads).toHaveLength(2);
    expect(ended, "before the new list").toBe(false);
    loads.at(-1)?.answer(["new"]);
    await settle();
    expect(queryClient.getQueryData(KEY)).toEqual(["new"]);
    expect(ended).toBe(true);
  });

  it("leaves no listener on the cache after it ends", async () => {
    const { queryClient, loads } = list();
    void refreshQueries(queryClient, { queryKey: KEY });
    await settle();
    cutWithTheOldList(queryClient);
    await settle();
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
