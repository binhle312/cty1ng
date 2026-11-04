import { hashKey, type QueryClient, type QueryKey, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import {
  getSettingsQueryKey,
  listBotsQueryKey,
} from "../../lib/api/generated/@tanstack/react-query.gen.ts";
import type { GetSettingsResponse } from "../../lib/api/generated/types.gen.ts";
import {
  alwaysLoadOnItsWay,
  type BotListEvent,
  type BotListRequest,
  type BotListState,
  botListReducer,
  initialBotListState,
  type PinExpected,
  type PinKey,
  shownBots,
  shownSettings,
} from "./bot-list-state.ts";
import type { BotRow } from "./bot-queries.ts";

// The bot list state (`bot-list-state.ts`) of one query client, for as long as the client lives:
// a request can answer after the owner left the tab or the page that sent it. The store sends
// each server load of the bot list and of the settings into the reducer, and writes what the
// page shows into the query cache, so every page that reads `GET /bots` or the settings shows
// the requests on their way. Its own writes (`setState`) are not loads. No other code writes
// these two queries (lint, `eslint.config.js`): the next event would drop the write.

interface Store {
  state: BotListState;
  nextId: number;
  listeners: Set<() => void>;
}

const stores = new WeakMap<QueryClient, Store>();

function storeOf(queryClient: QueryClient): Store {
  const known = stores.get(queryClient);
  if (known !== undefined) return known;
  const listKey = listBotsQueryKey();
  const settingsKey = getSettingsQueryKey();
  // Before the store, nothing wrote into these queries, so the cache holds the server's values.
  const store: Store = {
    state: initialBotListState({
      bots: queryClient.getQueryData<BotRow[]>(listKey),
      settings: queryClient.getQueryData<GetSettingsResponse>(settingsKey),
    }),
    nextId: 0,
    listeners: new Set(),
  };
  const listHash = hashKey(listKey);
  const settingsHash = hashKey(settingsKey);
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "updated" || event.action.type !== "success") return;
    if (event.action.manual === true) return;
    if (event.query.queryHash === listHash) {
      const bots = queryClient.getQueryData<BotRow[]>(listKey);
      if (bots !== undefined) dispatch({ queryClient, store }, { type: "listLoaded", bots });
    } else if (event.query.queryHash === settingsHash) {
      const settings = queryClient.getQueryData<GetSettingsResponse>(settingsKey);
      if (settings !== undefined) {
        dispatch({ queryClient, store }, { type: "settingsLoaded", settings });
      }
    }
  });
  stores.set(queryClient, store);
  return store;
}

// Puts what the page shows into a query the cache has. `setState` changes only the data: the
// query keeps its status, error and age, so a failed load still shows as failed and old data
// does not look fresh. A query the cache dropped gets nothing, and the next load brings it.
function show(
  { queryClient, queryKey }: { queryClient: QueryClient; queryKey: QueryKey },
  data: unknown,
) {
  const query = queryClient.getQueryCache().find({ queryKey, exact: true });
  if (data === undefined || query?.state.data === undefined || query.state.data === data) return;
  query.setState({ data });
}

function dispatch(
  { queryClient, store }: { queryClient: QueryClient; store: Store },
  event: BotListEvent,
) {
  store.state = botListReducer(store.state, event);
  show({ queryClient, queryKey: listBotsQueryKey() }, shownBots(store.state));
  show({ queryClient, queryKey: getSettingsQueryKey() }, shownSettings(store.state));
  for (const listener of store.listeners) listener();
}

// What the caller does with a request at its answer.
export interface ChangeOnItsWay<A> {
  answered: (answer: A) => void;
  refused: () => void;
}

// Starts a request of the bot list: call it just before the request goes out.
function start(queryClient: QueryClient, request: BotListRequest) {
  const store = storeOf(queryClient);
  store.nextId += 1;
  const id = store.nextId;
  dispatch({ queryClient, store }, { type: "sent", id, request });
  return {
    id,
    send: (event: BotListEvent) => {
      dispatch({ queryClient, store }, event);
    },
  };
}

// A Move (Upgrade, Change version) or + Add of a skill pin: the answer bot, or undefined when
// the bot is not in the answer.
export function startPinChange(
  queryClient: QueryClient,
  { botId, skillId, expected }: PinKey & { expected: PinExpected },
): ChangeOnItsWay<BotRow | undefined> {
  const { id, send } = start(queryClient, {
    kind: "pin",
    botId,
    skillId,
    expected,
    alwaysLoad: null,
  });
  return {
    answered: (answer) => {
      send(answer === undefined ? { type: "answered", id } : { type: "answered", id, answer });
    },
    refused: () => {
      send({ type: "refused", id });
    },
  };
}

// The request's answer goes to the change, and a failure refuses it; the promise keeps both.
export async function answeredBy<T>(change: ChangeOnItsWay<T>, request: Promise<T>): Promise<T> {
  try {
    const answer = await request;
    change.answered(answer);
    return answer;
  } catch (error) {
    change.refused();
    throw error;
  }
}

// A new pinned list (pin.md §2) or a new sort of the others (bots-page.md §5).
export function startOrderChange(
  queryClient: QueryClient,
  request: Extract<BotListRequest, { kind: "pinned" | "sort" }>,
): ChangeOnItsWay<void> {
  const { id, send } = start(queryClient, request);
  return {
    answered: () => {
      send({ type: "answered", id });
    },
    refused: () => {
      send({ type: "refused", id });
    },
  };
}

// The answer of a Profile or Model save: the fields a save owns (bot-page.md §4.2).
export function writeSaveAnswer(queryClient: QueryClient, answer: BotRow): void {
  dispatch({ queryClient, store: storeOf(queryClient) }, { type: "saveAnswered", answer });
}

// One Always load change, on the bot page and on the Skills page: it sends the change, and the
// switch keeps the value on its way until the refresh after the answer ends. A failure goes to
// `onFailed` at once, and the refresh still follows.
export async function sendPinChange({
  queryClient,
  request,
  botId,
  skillId,
  alwaysLoad,
  expected,
  onFailed,
  refresh,
}: PinKey & {
  queryClient: QueryClient;
  request: () => Promise<BotRow>;
  alwaysLoad: boolean;
  expected: PinExpected;
  onFailed: (error: unknown) => void;
  refresh: () => Promise<unknown>;
}): Promise<void> {
  const { id, send } = start(queryClient, { kind: "pin", botId, skillId, expected, alwaysLoad });
  try {
    const answer = await request();
    send({ type: "answered", id, answer });
  } catch (error) {
    send({ type: "refused", id });
    onFailed(error);
  }
  try {
    await refresh();
  } finally {
    send({ type: "refreshEnded", id });
  }
}

// Remove of a skill from a bot (bot-page.md §7, skills-page.md §2a): the row goes at once, also
// over a load that lands before the answer. A failure brings the row back at once, also when
// the refresh after it fails, and goes to `onFailed`.
export function sendPinRemove({
  queryClient,
  request,
  botId,
  skillId,
  onFailed,
  refresh,
}: PinKey & {
  queryClient: QueryClient;
  request: () => Promise<unknown>;
  onFailed: (error: unknown) => void;
  refresh: () => Promise<unknown>;
}): void {
  const { id, send } = start(queryClient, { kind: "remove", botId, skillId });
  void request()
    .then(
      () => {
        send({ type: "answered", id });
      },
      (error: unknown) => {
        send({ type: "refused", id });
        onFailed(error);
      },
    )
    .finally(() => void refresh());
}

// The Always load value on its way for a bot and a skill, or null.
export function useAlwaysLoadsOnTheirWay(): (pin: PinKey) => boolean | null {
  const store = storeOf(useQueryClient());
  const state = useSyncExternalStore(
    (listener) => {
      store.listeners.add(listener);
      return () => {
        store.listeners.delete(listener);
      };
    },
    () => store.state,
  );
  return (pin) => alwaysLoadOnItsWay(state, pin);
}
