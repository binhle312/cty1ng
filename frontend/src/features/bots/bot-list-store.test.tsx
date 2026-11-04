import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
  sendPinChange,
  sendPinRemove,
  startOrderChange,
  startPinChange,
  useAlwaysLoadsOnTheirWay,
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
    const change = startPinChange(queryClient, {
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
    change.answered(makeBot(1, "BA", [v3]));
    expect(pinsOf(queryClient)).toEqual([v3]);
  });

  it("writes no pin after a list load that came after the request went out", async () => {
    const queryClient = withList([v2]);
    const change = startPinChange(queryClient, {
      botId: BA,
      skillId: SKILL_ID,
      expected: expectedV2,
    });
    await load(queryClient, [v2]);
    change.answered(makeBot(1, "BA", [v3]));
    expect(pinsOf(queryClient)).toEqual([v2]);
  });

  it("takes the list again when the query was dropped and loads again", async () => {
    const queryClient = withList([off]);
    const change = startPinChange(queryClient, { botId: BA, skillId: SKILL_ID, expected: null });
    queryClient.removeQueries({ queryKey: listBotsQueryKey() });
    change.refused();
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
    startPinChange(queryClient, { botId: BA, skillId: SKILL_ID, expected: null }).answered(
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
    const add = startPinChange(queryClient, { botId: BA, skillId: SKILL_ID, expected: null });
    // A load with the added pin lands; the Remove hides it.
    await load(queryClient, [off]);
    expect(pinsOf(queryClient)).toEqual([]);
    add.answered(makeBot(1, "BA", [off]));
    expect(pinsOf(queryClient)).toEqual([off]);
    remove.resolve(undefined);
    await settle();
    expect(pinsOf(queryClient)).toEqual([off]);
  });
});
