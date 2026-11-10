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

// A query that a page watches but has turned off, as the query of a closed dialog (DQ-198).
function dialogQuery(queryClient: QueryClient) {
  const answers: ((value: string) => void)[] = [];
  const options = (enabled: boolean) => ({
    queryKey: ["dialog"],
    enabled,
    queryFn: () =>
      new Promise<string>((resolve) => {
        answers.push(resolve);
      }),
  });
  const observer = new QueryObserver(queryClient, options(true));
  observer.subscribe(() => undefined);
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  return {
    answers,
    settle,
    open: () => {
      observer.setOptions(options(true));
    },
    close: () => {
      observer.setOptions(options(false));
    },
    data: () => queryClient.getQueryData<string>(["dialog"]),
  };
}

describe("readAll and a query that is turned off before its first answer", () => {
  it("reads again when the query is turned on before the old answer", () => {
    const queryClient = new QueryClient();
    const dialog = dialogQuery(queryClient);
    dialog.close();
    readAll(queryClient);
    dialog.open();
    expect(dialog.answers, "reads after the dialog opened again").toHaveLength(2);
  });

  it("drops the old answer when the query was turned on again", async () => {
    const queryClient = new QueryClient();
    const dialog = dialogQuery(queryClient);
    dialog.close();
    readAll(queryClient);
    dialog.open();
    dialog.answers[0]?.("from before");
    await dialog.settle();
    expect(dialog.data(), "the old answer, dialog open again").toBeUndefined();
  });

  it("drops the old answer when the query stays off", async () => {
    const queryClient = new QueryClient();
    const dialog = dialogQuery(queryClient);
    dialog.close();
    readAll(queryClient);
    dialog.answers[0]?.("from before");
    await dialog.settle();
    expect(dialog.data(), "the old answer, dialog closed").toBeUndefined();
  });

  it("leaves no read on its way when the query stays off", async () => {
    const queryClient = new QueryClient();
    const dialog = dialogQuery(queryClient);
    dialog.close();
    readAll(queryClient);
    await dialog.settle();
    expect(queryClient.isFetching(), "reads on their way").toBe(0);
  });
});

// Code that asks the query client directly, with no observer. Its caller waits for this read.
describe("readAll and a read with no observer", () => {
  it("does not cut the read: the caller gets its answer", async () => {
    const queryClient = new QueryClient();
    let answer: (value: string) => void = () => undefined;
    const read = queryClient.query({
      queryKey: ["plain"],
      queryFn: () =>
        new Promise<string>((resolve) => {
          answer = resolve;
        }),
    });
    readAll(queryClient);
    answer("the answer");
    expect(await read, "the caller's answer").toBe("the answer");
  });
});

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
