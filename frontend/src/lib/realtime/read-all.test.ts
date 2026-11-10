import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { readAll } from "./read-all.ts";

// realtime-events.md §3: after a `reset`, and after the first `ready` of a new stream, the tab
// reads all data again. Each read must start after that point: the stream brings no event from
// before it. The real library, with reads that the test answers by hand.
function watched(queryClient: QueryClient, key: string) {
  const answers: ((value: string) => void)[] = [];
  const observer = new QueryObserver(queryClient, {
    queryKey: [key],
    queryFn: () =>
      new Promise<string>((resolve) => {
        answers.push(resolve);
      }),
  });
  const stop = observer.subscribe(() => undefined);
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  return { answers, stop, settle, data: () => queryClient.getQueryData<string>([key]) };
}

describe("readAll", () => {
  it("starts a new read for a query whose first read is still on its way", () => {
    const queryClient = new QueryClient();
    const query = watched(queryClient, "first");
    readAll(queryClient);
    expect(query.answers, "reads of a query with no answer yet").toHaveLength(2);
  });

  it("drops the answer of the first read that it cut", async () => {
    const queryClient = new QueryClient();
    const query = watched(queryClient, "first");
    readAll(queryClient);
    query.answers[0]?.("from before");
    await query.settle();
    expect(query.data(), "the old answer").toBeUndefined();
  });

  it("takes the answer of the read that started after it", async () => {
    const queryClient = new QueryClient();
    const query = watched(queryClient, "first");
    readAll(queryClient);
    query.answers[0]?.("from before");
    query.answers[1]?.("from after");
    await query.settle();
    expect(query.data(), "the new answer").toBe("from after");
  });

  // The library does this part itself; the test keeps it.
  it("starts a new read for a query that has data and a read on its way", async () => {
    const queryClient = new QueryClient();
    const query = watched(queryClient, "second");
    query.answers[0]?.("first answer");
    await query.settle();
    void queryClient.invalidateQueries();
    readAll(queryClient);
    expect(query.answers, "reads of a query with data").toHaveLength(3);
  });
});
