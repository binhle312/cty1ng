import { QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import { refreshQueries } from "../../lib/api/query-reads.ts";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  BOT_SETTINGS,
  type Bot,
  makeBot,
  makePin,
  SKILL_ID,
  versionId,
} from "../../../test/fixtures.ts";
import {
  getSettingsQueryKey,
  listBotsQueryKey,
} from "../../lib/api/generated/@tanstack/react-query.gen.ts";
import type { GetSettingsResponse } from "../../lib/api/generated/types.gen.ts";
import {
  type PinChange,
  sendPinChange,
  sendPinChanges,
  sendPinRemove,
  startOrderChange,
  useAlwaysLoadsOnTheirWay,
  usePinChangesOnTheirWay,
  writeSaveAnswer,
} from "./bot-list-store.ts";

// The bot list store: the state of `bot-list-state.ts` on a query client. These tests hold the
// wiring: loads go in, the store's own writes are not loads, what the page shows goes into the
// cache, and the requests outlive every component (bot-page.md §7.1).

const BA = makeBot(1, "BA").id;
const v2 = makePin({ version: 2, skill_version_id: versionId(2) });
const v3 = makePin();
const off = makePin({ always_load: false });
const on = makePin({ always_load: true });
const expectedV2 = { skill_version_id: versionId(2), always_load: false };
const expectedOff = { skill_version_id: off.skill_version_id, always_load: false };

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

// A pin change whose answer the test gives: `settle` after it, so the store has it.
function heldPinChange(queryClient: QueryClient, pin: PinChange) {
  const request = deferred<Bot>();
  const refresh = deferred<undefined>();
  void sendPinChanges({
    queryClient,
    pins: [pin],
    request: () => request.promise,
    botsOf: (bot) => [bot],
    refresh: () => refresh.promise,
  }).catch(() => undefined);
  return {
    answered: async (bot: Bot) => {
      request.resolve(bot);
      await settle();
    },
    refused: async () => {
      request.reject(new Error("no"));
      await settle();
    },
    refreshEnds: async () => {
      refresh.resolve(undefined);
      await settle();
    },
  };
}

function withList(pins: Bot["pins"]): QueryClient {
  const queryClient = new QueryClient();
  queryClient.setQueryData(listBotsQueryKey(), [makeBot(1, "BA", pins)]);
  return queryClient;
}
const pinsOf = (queryClient: QueryClient) =>
  queryClient.getQueryData<Bot[]>(listBotsQueryKey())?.[0]?.pins;
async function load(queryClient: QueryClient, pins: Bot["pins"]) {
  await queryClient.query({
    queryKey: listBotsQueryKey(),
    queryFn: () => [makeBot(1, "BA", pins)],
    staleTime: 0,
  });
}

describe("the bot list store", () => {
  it("keeps a removed row away over a server load, and takes the next load after the answer", async () => {
    const queryClient = withList([off]);
    const remove = deferred<unknown>();
    sendPinRemove({
      queryClient,
      request: () => remove.promise,
      botId: BA,
      skillId: SKILL_ID,
      onFailed: () => undefined,
      refresh: () => Promise.resolve(),
    });
    expect(pinsOf(queryClient)).toEqual([]);
    await load(queryClient, [off]);
    expect(pinsOf(queryClient)).toEqual([]);
    remove.resolve(undefined);
    await settle();
    expect(pinsOf(queryClient)).toEqual([]);
    // Another tab added it again: the next load shows it.
    await load(queryClient, [v3]);
    expect(pinsOf(queryClient)).toEqual([v3]);
  });

  it("does not count its own writes as loads", async () => {
    const queryClient = withList([v2]);
    const change = heldPinChange(queryClient, {
      botId: BA,
      skillId: SKILL_ID,
      expected: expectedV2,
    });
    // A Remove of another request writes the list; that is not a load.
    sendPinRemove({
      queryClient,
      request: () => Promise.reject(new Error("500")),
      botId: BA,
      skillId: SKILL_ID,
      onFailed: () => undefined,
      refresh: () => Promise.resolve(),
    });
    await settle();
    await change.answered(makeBot(1, "BA", [v3]));
    expect(pinsOf(queryClient)).toEqual([v3]);
  });

  it("writes no pin after a list load that came after the request went out", async () => {
    const queryClient = withList([v2]);
    const change = heldPinChange(queryClient, {
      botId: BA,
      skillId: SKILL_ID,
      expected: expectedV2,
    });
    await load(queryClient, [v2]);
    await change.answered(makeBot(1, "BA", [v3]));
    expect(pinsOf(queryClient)).toEqual([v2]);
  });

  it("takes the list again when the query was dropped and loads again", async () => {
    const queryClient = withList([off]);
    const change = heldPinChange(queryClient, { botId: BA, skillId: SKILL_ID, expected: null });
    queryClient.removeQueries({ queryKey: listBotsQueryKey() });
    await change.refused();
    // A dropped query is not written: it would look fresh.
    expect(queryClient.getQueryData(listBotsQueryKey())).toBeUndefined();
    await load(queryClient, [on]);
    expect(pinsOf(queryClient)).toEqual([on]);
  });

  it("shows a sort on the settings and the list until its answer, over loads of both", async () => {
    const queryClient = new QueryClient();
    const older = makeBot(1, "BA", [], { created_at: "2026-10-20T10:00:00.000Z" });
    const newer = makeBot(2, "UX", [], { created_at: "2026-10-21T10:00:00.000Z" });
    const created = { ...BOT_SETTINGS, bot_order: "created" as const };
    queryClient.setQueryData(listBotsQueryKey(), [newer, older]);
    queryClient.setQueryData(getSettingsQueryKey(), created);
    const sort = startOrderChange(queryClient, {
      kind: "sort",
      order: { bot_order: "created", bot_order_direction: "asc" },
    });
    await queryClient.query({
      queryKey: getSettingsQueryKey(),
      queryFn: () => created,
      staleTime: 0,
    });
    await queryClient.query({
      queryKey: listBotsQueryKey(),
      queryFn: () => [newer, older],
      staleTime: 0,
    });
    const settings = () => queryClient.getQueryData<GetSettingsResponse>(getSettingsQueryKey());
    const names = () => queryClient.getQueryData<Bot[]>(listBotsQueryKey())?.map((b) => b.name);
    expect(settings()?.bot_order_direction).toBe("asc");
    expect(names()).toEqual(["BA", "UX"]);
    sort.refused();
    expect(settings()?.bot_order_direction).toBe("desc");
    expect(names()).toEqual(["UX", "BA"]);
  });

  // Review: a write of what the page shows must not hide a failed load or make old data fresh.
  it("keeps the error of a failed load and the data's age when it writes", async () => {
    const queryClient = withList([off]);
    const remove = deferred<unknown>();
    sendPinRemove({
      queryClient,
      request: () => remove.promise,
      botId: BA,
      skillId: SKILL_ID,
      onFailed: () => undefined,
      refresh: () => Promise.resolve(),
    });
    await queryClient
      .query({
        queryKey: listBotsQueryKey(),
        queryFn: () => Promise.reject(new Error("500")),
        retry: false,
        staleTime: 0,
      })
      .catch(() => undefined);
    const query = queryClient.getQueryCache().find({ queryKey: listBotsQueryKey() });
    const before = query?.state.dataUpdatedAt;
    remove.reject(new Error("500"));
    await settle();
    expect(pinsOf(queryClient)).toEqual([off]);
    expect(query?.state.status).toBe("error");
    expect(query?.state.dataUpdatedAt).toBe(before);
  });

  it("writes a save answer's fields and keeps a removed row away", () => {
    const queryClient = withList([off]);
    sendPinRemove({
      queryClient,
      request: () => new Promise(() => undefined),
      botId: BA,
      skillId: SKILL_ID,
      onFailed: () => undefined,
      refresh: () => Promise.resolve(),
    });
    writeSaveAnswer(queryClient, { ...makeBot(1, "BA", [off]), name: "Analyst", row_version: 2 });
    const bot = queryClient.getQueryData<Bot[]>(listBotsQueryKey())?.[0];
    expect(bot?.name).toBe("Analyst");
    expect(bot?.pins).toEqual([]);
  });
});

describe("an Always load change", () => {
  it("ends only after the refresh that follows its answer", async () => {
    const queryClient = withList([v2]);
    const steps: string[] = [];
    let endRefresh: () => void = () => undefined;
    const done = sendPinChange({
      queryClient,
      request: () => Promise.resolve(makeBot(1, "BA", [v3])),
      botId: BA,
      skillId: SKILL_ID,
      alwaysLoad: true,
      expected: expectedV2,
      onFailed: () => {
        steps.push("failed");
      },
      refresh: () =>
        new Promise<void>((resolve) => {
          steps.push("refresh");
          endRefresh = resolve;
        }),
    }).then(() => {
      steps.push("done");
    });
    await settle();
    expect(steps).toEqual(["refresh"]);
    expect(pinsOf(queryClient)).toEqual([v3]);
    endRefresh();
    await done;
    expect(steps).toEqual(["refresh", "done"]);
  });

  it("reports a failure at once, and still refreshes", async () => {
    const queryClient = new QueryClient();
    const steps: string[] = [];
    await sendPinChange({
      queryClient,
      request: () => Promise.reject(new Error("no")),
      botId: BA,
      skillId: SKILL_ID,
      alwaysLoad: true,
      expected: null,
      onFailed: () => {
        steps.push("failed");
      },
      refresh: () => {
        steps.push("refresh");
        return Promise.resolve();
      },
    });
    expect(steps).toEqual(["failed", "refresh"]);
  });

  it("keeps the value on its way, with no component, until the refresh ends", async () => {
    const queryClient = withList([v2]);
    const seen: (boolean | null)[] = [];
    let endRefresh: () => void = () => undefined;
    const done = sendPinChange({
      queryClient,
      request: () => Promise.resolve(makeBot(1, "BA", [v3])),
      botId: BA,
      skillId: SKILL_ID,
      alwaysLoad: true,
      expected: expectedV2,
      onFailed: () => undefined,
      refresh: () =>
        new Promise<void>((resolve) => {
          endRefresh = resolve;
        }),
    });
    const { result } = renderHook(() => useAlwaysLoadsOnTheirWay(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });
    seen.push(result.current({ botId: BA, skillId: SKILL_ID }));
    await act(settle);
    endRefresh();
    await act(() => done);
    seen.push(result.current({ botId: BA, skillId: SKILL_ID }));
    expect(seen).toEqual([true, null]);
  });
});

// Finding of the PR #59 review: an answer alone can leave the page on the old pin, so the row
// stays off until the list has come (bot-page.md §4.2, Q3).
describe("a row's actions after its change", () => {
  const key = { botId: BA, skillId: SKILL_ID };
  function rowBusy(queryClient: QueryClient) {
    const { result } = renderHook(() => usePinChangesOnTheirWay(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });
    return () => result.current(key);
  }

  it("stay off from the request until the refresh after its answer ends", async () => {
    const queryClient = withList([v2]);
    const busy = rowBusy(queryClient);
    const change = heldPinChange(queryClient, { ...key, expected: expectedV2 });
    await act(settle);
    expect(busy()).toBe(true);
    await act(() => change.answered(makeBot(1, "BA", [v3])));
    expect(busy()).toBe(true);
    await act(() => change.refreshEnds());
    expect(busy()).toBe(false);
  });

  it("stay off after a refusal until the refresh after it ends", async () => {
    const queryClient = withList([v2]);
    const busy = rowBusy(queryClient);
    const change = heldPinChange(queryClient, { ...key, expected: expectedV2 });
    await act(() => change.refused());
    expect(busy()).toBe(true);
    await act(() => change.refreshEnds());
    expect(busy()).toBe(false);
  });

  it("turn on after a refresh that fails", async () => {
    const queryClient = withList([v2]);
    const busy = rowBusy(queryClient);
    await act(async () => {
      await sendPinChanges({
        queryClient,
        pins: [{ ...key, expected: expectedV2 }],
        request: () => Promise.resolve(makeBot(1, "BA", [v3])),
        botsOf: (bot) => [bot],
        refresh: () => Promise.reject(new Error("no")),
      });
      await settle();
    });
    expect(busy()).toBe(false);
  });

  it("gives the caller the answer at the answer, not after the refresh", async () => {
    const queryClient = withList([v2]);
    const answer = makeBot(1, "BA", [v3]);
    const refresh = deferred<undefined>();
    const result = await sendPinChanges({
      queryClient,
      pins: [{ ...key, expected: expectedV2 }],
      request: () => Promise.resolve(answer),
      botsOf: (bot) => [bot],
      refresh: () => refresh.promise,
    });
    expect(result).toBe(answer);
    refresh.resolve(undefined);
    await settle();
  });

  it("change the pin of each bot in one request, and end each one", async () => {
    const other = makeBot(2, "UX").id;
    const queryClient = new QueryClient();
    queryClient.setQueryData(listBotsQueryKey(), [makeBot(1, "BA", [v2]), makeBot(2, "UX", [v2])]);
    const refresh = deferred<undefined>();
    const { result } = renderHook(() => usePinChangesOnTheirWay(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });
    await act(async () => {
      await sendPinChanges({
        queryClient,
        pins: [
          { ...key, expected: expectedV2 },
          { botId: other, skillId: SKILL_ID, expected: expectedV2 },
        ],
        request: () => Promise.resolve([makeBot(1, "BA", [v3])]),
        botsOf: (bots) => bots,
        refresh: () => refresh.promise,
      });
    });
    const bots = queryClient.getQueryData<Bot[]>(listBotsQueryKey());
    expect(bots?.[0]?.pins).toEqual([v3]);
    expect(bots?.[1]?.pins).toEqual([v2]);
    expect(result.current(key)).toBe(true);
    expect(result.current({ botId: other, skillId: SKILL_ID })).toBe(true);
    await act(async () => {
      refresh.resolve(undefined);
      await settle();
    });
    expect(result.current(key)).toBe(false);
    expect(result.current({ botId: other, skillId: SKILL_ID })).toBe(false);
  });

  // `invalidateQueries` cuts a load on its way short, and a second cut ends the older refresh
  // (lib/api/query-reads.ts). The row depends on `refreshQueries`, so this holds it.
  it.each([1, 2])(
    "stay off when %i newer refreshes cut the refresh short, until the newest list comes",
    async (cuts) => {
      const queryClient = withList([v2]);
      const lists: ReturnType<typeof deferred<Bot[]>>[] = [];
      const list = new QueryObserver(queryClient, {
        queryKey: listBotsQueryKey(),
        queryFn: () => {
          const answer = deferred<Bot[]>();
          lists.push(answer);
          return answer.promise;
        },
        staleTime: Infinity,
      });
      const stop = list.subscribe(() => undefined);
      const refresh = () => refreshQueries(queryClient, { queryKey: listBotsQueryKey() });
      const busy = rowBusy(queryClient);
      await act(async () => {
        await sendPinChanges({
          queryClient,
          pins: [{ ...key, expected: expectedV2 }],
          request: () => Promise.resolve(makeBot(1, "BA", [v3])),
          botsOf: (bot) => [bot],
          refresh,
        });
        await settle();
      });
      expect(lists).toHaveLength(1);
      for (let cut = 0; cut < cuts; cut += 1) {
        await act(async () => {
          // Another change's refresh, while this one's list is on its way.
          void refresh();
          await settle();
        });
      }
      expect(lists).toHaveLength(cuts + 1);
      expect(busy()).toBe(true);
      await act(async () => {
        lists.at(-1)?.resolve([makeBot(1, "BA", [v3])]);
        await settle();
      });
      expect(busy()).toBe(false);
      stop();
    },
  );
});

// A request can be sent before a Remove of its pin and answer after it (review of the 571375a
// fixes). Its answer is about the pin before the Remove: it never shows that pin again, but a
// Remove that fails shows the newest pin the server has.
describe("a pin answer and a Remove of its pin", () => {
  function start() {
    const queryClient = withList([off]);
    const toggle = deferred<Bot>();
    const remove = deferred<unknown>();
    void sendPinChange({
      queryClient,
      request: () => toggle.promise,
      botId: BA,
      skillId: SKILL_ID,
      alwaysLoad: true,
      expected: expectedOff,
      onFailed: () => undefined,
      refresh: () => Promise.resolve(),
    });
    sendPinRemove({
      queryClient,
      request: () => remove.promise,
      botId: BA,
      skillId: SKILL_ID,
      onFailed: () => undefined,
      // The refresh after the Remove fails: the page keeps its data.
      refresh: () => Promise.resolve(),
    });
    expect(pinsOf(queryClient)).toEqual([]);
    return { queryClient, toggle, remove };
  }

  it("shows the pin of an older change that the server saved when the Remove fails", async () => {
    const { queryClient, toggle, remove } = start();
    toggle.resolve(makeBot(1, "BA", [on]));
    await settle();
    expect(pinsOf(queryClient)).toEqual([]);
    remove.reject(new Error("500"));
    await settle();
    expect(pinsOf(queryClient)).toEqual([on]);
  });

  it("keeps the pin an add put back when an older change answers after it", async () => {
    const { queryClient, toggle, remove } = start();
    // The server: the toggle (on), the Remove, then the add (off). The add answers first.
    await heldPinChange(queryClient, { botId: BA, skillId: SKILL_ID, expected: null }).answered(
      makeBot(1, "BA", [off]),
    );
    expect(pinsOf(queryClient)).toEqual([off]);
    toggle.resolve(makeBot(1, "BA", [on]));
    await settle();
    remove.resolve(undefined);
    await settle();
    expect(pinsOf(queryClient)).toEqual([off]);
  });

  it("shows the added pin when a list load landed while the add and the Remove waited", async () => {
    const { queryClient, remove } = start();
    const add = heldPinChange(queryClient, { botId: BA, skillId: SKILL_ID, expected: null });
    // A load with the added pin lands; the Remove hides it.
    await load(queryClient, [off]);
    expect(pinsOf(queryClient)).toEqual([]);
    await add.answered(makeBot(1, "BA", [off]));
    expect(pinsOf(queryClient)).toEqual([off]);
    remove.resolve(undefined);
    await settle();
    expect(pinsOf(queryClient)).toEqual([off]);
  });
});
