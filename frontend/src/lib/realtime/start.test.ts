import type { StreamEvent } from "@cty1ng/shared/events";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_PINGS_KEY } from "./reducer.ts";
import { type Page, startRealtime } from "./start.ts";
import type { ConnectOptions } from "./transport.ts";

const RETRY_MS = 500;
const ready = (maxSeq: number): StreamEvent => ({ type: "ready", data: { max_seq: maxSeq } });
const ping = (seq: number): StreamEvent => ({
  type: "test.ping",
  seq,
  data: { note: `n${String(seq)}` },
});

// A page whose visibility the test sets, and a transport that keeps every stream it opened.
function setup(startVisible = true) {
  const queryClient = new QueryClient();
  const readAll = vi.spyOn(queryClient, "invalidateQueries");
  const target = new EventTarget();
  let visibilityState: DocumentVisibilityState = startVisible ? "visible" : "hidden";
  const page: Page = {
    get visibilityState() {
      return visibilityState;
    },
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
  };
  const show = (visible: boolean) => {
    visibilityState = visible ? "visible" : "hidden";
    target.dispatchEvent(new Event("visibilitychange"));
  };
  const streams: (ConnectOptions & { closed: boolean })[] = [];
  startRealtime(queryClient, {
    page,
    retryMs: RETRY_MS,
    connect: (options) => {
      const stream = { ...options, closed: false };
      streams.push(stream);
      return () => {
        stream.closed = true;
        // As sse.ts does: the close reports its own status.
        options.onStatus("closed");
      };
    },
  });
  const stream = (n: number) => {
    const found = streams[n - 1];
    if (found === undefined) throw new Error(`no stream ${String(n)}`);
    return found;
  };
  const open = () => streams.filter((s) => !s.closed).length;
  const notes = () => queryClient.getQueryData<string[]>(TEST_PINGS_KEY) ?? [];
  return { queryClient, readAll, show, streams, stream, open, notes };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

// realtime-events.md §3, "Stream life". One claim for each test: `scripts/breaks/pr-91.json`
// has a break for each.
describe("startRealtime", () => {
  it("a visible page opens one stream", () => {
    const { streams } = setup();
    expect(streams, "at page start").toHaveLength(1);
  });

  it("the events of the stream reach the reducer", () => {
    const { stream, notes } = setup();
    stream(1).onEvent(ready(4));
    stream(1).onEvent(ping(5));
    expect(notes(), "applied").toEqual(["n5"]);
  });

  it("the ready of the stream of page start reads nothing again", () => {
    const { stream, readAll } = setup();
    stream(1).onEvent(ready(4));
    expect(readAll, "page start").not.toHaveBeenCalled();
  });

  it("a hidden tab closes its stream", () => {
    const { show, stream } = setup();
    show(false);
    expect(stream(1).closed, "hidden").toBe(true);
  });

  it("a tab that becomes visible opens a new stream", () => {
    const { show, streams, open } = setup();
    show(false);
    show(true);
    expect([streams.length, open()], "streams made, streams open").toEqual([2, 1]);
  });

  it("the read does not start before the ready of a new stream", () => {
    const { show, stream, readAll } = setup();
    show(false);
    show(true);
    stream(2).onStatus("open");
    expect(readAll, "open, no ready yet").not.toHaveBeenCalled();
  });

  it("the first ready of a new stream reads all", () => {
    const { show, stream, readAll } = setup();
    show(false);
    show(true);
    stream(2).onEvent(ready(9));
    expect(readAll, "first ready").toHaveBeenCalledExactlyOnceWith();
  });

  // A page that the tab has just opened reads its data for the first time. That read started
  // before `ready`, so its answer can miss a change that no event will bring.
  it("the read after ready starts again a first read that is still on its way", () => {
    const { show, stream, queryClient } = setup();
    show(false);
    show(true);
    let reads = 0;
    const observer = new QueryObserver(queryClient, {
      queryKey: ["first read"],
      queryFn: () => {
        reads += 1;
        return new Promise<string>(() => undefined);
      },
    });
    observer.subscribe(() => undefined);
    stream(2).onEvent(ready(9));
    expect(reads, "reads of a query with no answer yet").toBe(2);
  });

  // The browser's own reconnect: `ready` again in the same stream, then the server's replay.
  it("a second ready in the same stream reads nothing again", () => {
    const { show, stream, readAll } = setup();
    show(false);
    show(true);
    stream(2).onEvent(ready(9));
    stream(2).onStatus("connecting");
    stream(2).onStatus("open");
    stream(2).onEvent(ready(9));
    expect(readAll, "second ready").toHaveBeenCalledTimes(1);
  });

  // A new database gives lower seqs; the cursor of the stream before would skip them.
  it("a new stream takes its cursor from its own ready", () => {
    const { show, stream, notes } = setup();
    stream(1).onEvent(ready(100));
    stream(1).onEvent(ping(101));
    show(false);
    show(true);
    stream(2).onEvent(ready(3));
    stream(2).onEvent(ping(4));
    expect(notes(), "own cursor").toEqual(["n101", "n4"]);
  });

  it("a late event of a closed stream does not reach the reducer", () => {
    const { show, stream, notes } = setup();
    show(false);
    stream(1).onEvent(ready(1));
    stream(1).onEvent(ping(2));
    expect(notes(), "late event").toEqual([]);
  });

  it("stopped for good: no new stream opens before the wait ends", () => {
    const { stream, streams } = setup();
    stream(1).onStatus("closed");
    vi.advanceTimersByTime(RETRY_MS - 1);
    expect(streams, "before the wait ends").toHaveLength(1);
  });

  it("stopped for good: a new stream opens after the wait", () => {
    const { stream, streams, open } = setup();
    stream(1).onStatus("closed");
    vi.advanceTimersByTime(RETRY_MS);
    expect([streams.length, open()], "after the wait").toEqual([2, 1]);
  });

  it("the stream after a stop reads all at its ready", () => {
    const { stream, readAll } = setup();
    stream(1).onStatus("closed");
    vi.advanceTimersByTime(RETRY_MS);
    stream(2).onEvent(ready(7));
    expect(readAll, "after a stop").toHaveBeenCalledTimes(1);
  });

  it("a stream that fails each time gets a new try after each wait", () => {
    const { streams } = setup();
    for (let n = 1; n <= 4; n += 1) {
      streams.at(-1)?.onStatus("closed");
      vi.advanceTimersByTime(RETRY_MS);
    }
    expect(streams, "four failures").toHaveLength(5);
  });

  it("a status that is not closed starts no timer", () => {
    const { stream } = setup();
    stream(1).onStatus("connecting");
    expect(vi.getTimerCount(), "connecting").toBe(0);
  });

  it("hidden during the wait cancels the timer", () => {
    const { show, stream } = setup();
    stream(1).onStatus("closed");
    show(false);
    expect(vi.getTimerCount(), "hidden during the wait").toBe(0);
  });

  it("a page that starts hidden opens no stream", () => {
    const { streams } = setup(false);
    expect(streams, "starts hidden").toHaveLength(0);
  });

  it("the first stream of a page that starts hidden reads all", () => {
    const { show, stream, readAll } = setup(false);
    show(true);
    stream(1).onEvent(ready(2));
    expect(readAll, "started hidden").toHaveBeenCalledTimes(1);
  });

  // The close of a stream reports "closed" too. That is not a stop by the browser.
  it("the close of a hidden tab's stream starts no timer", () => {
    const { show } = setup();
    show(false);
    expect(vi.getTimerCount(), "own close, hidden").toBe(0);
  });

  it("the close of a stopped stream starts no second timer", () => {
    const { stream } = setup();
    stream(1).onStatus("closed");
    expect(vi.getTimerCount(), "own close, waiting").toBe(1);
  });
});
