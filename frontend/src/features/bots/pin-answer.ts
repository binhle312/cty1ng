import { hashKey, type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { listBotsQueryKey } from "../../lib/api/generated/@tanstack/react-query.gen.ts";
import { showUntilAnswered } from "../../lib/api/optimistic.ts";
import type { SetBotSkillData } from "../../lib/api/generated/types.gen.ts";
import type { BotPin, BotRow } from "./bot-queries.ts";

// The answer of a skill pin change (bot-page.md §7, skills-page.md §2a), on the bot page and on
// the Skills page. A pin change never raises `row_version`, so nothing in the answer tells if the
// rest of the bot is older than the page: a Profile save, or a change of another skill, may have
// come first. So the answer writes only the pin of its own skill, and the refresh after it loads
// the rest. The pin changes only while the page still shows the pin the request expected: the
// server refused any change made before this one (409), so a different pin on the page is this
// change or a newer one, and the answer would take it back. A list load after the request went
// out may show a newer change with the expected value (on, then off in another tab): the same
// value tells nothing, so the answer then writes nothing, and the refresh shows the server's pin.

// The pin the request sent as `expected`; null for a new pin (the bot had none of the skill).
export type PinExpected = SetBotSkillData["body"]["expected"];

// The server loads of the bot list, counted for as long as the query client lives, not as long
// as a tab: a request can answer after the owner left the tab that sent it. A write from an
// answer (`setQueryData`) is not a load and does not count.
const loads = new WeakMap<QueryClient, { count: number }>();

export function botListLoads(queryClient: QueryClient): number {
  const known = loads.get(queryClient);
  if (known !== undefined) return known.count;
  const counter = { count: 0 };
  const listHash = hashKey(listBotsQueryKey());
  queryClient.getQueryCache().subscribe((event) => {
    if (
      event.type === "updated" &&
      event.action.type === "success" &&
      event.action.manual !== true &&
      event.query.queryHash === listHash
    ) {
      counter.count += 1;
    }
  });
  loads.set(queryClient, counter);
  return counter.count;
}

// The bot with the answer's pin of `skillId`, or the bot as it is when the page shows another pin.
export function withPinAnswer({
  bot,
  answer,
  skillId,
  expected,
}: {
  bot: BotRow;
  answer: BotRow;
  skillId: string;
  expected: PinExpected;
}): BotRow {
  const pin = answer.pins.find((item) => item.skill_id === skillId);
  if (pin === undefined) return bot;
  const shown = bot.pins.find((item) => item.skill_id === skillId);
  const asExpected =
    expected === null
      ? shown === undefined
      : shown !== undefined &&
        shown.skill_version_id === expected.skill_version_id &&
        shown.always_load === expected.always_load;
  if (!asExpected) return bot;
  const pins: BotPin[] =
    shown === undefined
      ? [...bot.pins, pin]
      : bot.pins.map((item) => (item === shown ? pin : item));
  return withPins(bot, pins);
}

// The bot with these pins, and the same counts as the server's (bots.service.ts).
function withPins(bot: BotRow, pins: BotPin[]): BotRow {
  const updates = pins.filter((item) => item.version < item.latest_version).length;
  return {
    ...bot,
    pins,
    counts: { ...bot.counts, skills: pins.length, skill_updates: updates },
  };
}

// Writes the answer's pin into the bot list, unless the list loaded after the request went out.
// `loadsAtSend` is `botListLoads` read just before the request.
export function writePinAnswer({
  queryClient,
  answer,
  skillId,
  expected,
  loadsAtSend,
}: {
  queryClient: QueryClient;
  answer: BotRow;
  skillId: string;
  expected: PinExpected;
  loadsAtSend: number;
}): void {
  // The owner's own add of a pin that a Remove on its way hides: the pin shows again.
  removesOnTheirWay.get(queryClient)?.get(pinKey({ botId: answer.id, skillId }))?.();
  if (botListLoads(queryClient) !== loadsAtSend) return;
  queryClient.setQueryData<BotRow[]>(listBotsQueryKey(), (current) =>
    current?.map((bot) =>
      bot.id === answer.id ? withPinAnswer({ bot, answer, skillId, expected }) : bot,
    ),
  );
}

// The Always load values on their way, by bot and skill, for as long as the query client lives:
// the owner may leave the tab and come back, or open the other page of the same pin, before the
// refresh after the answer (bot-page.md §7.1). Each value is its own object, so a change ends
// only its own value.
interface LoadsStore {
  values: ReadonlyMap<string, { alwaysLoad: boolean }>;
  listeners: Set<() => void>;
}
const loadsOnTheirWay = new WeakMap<QueryClient, LoadsStore>();

function loadsStore(queryClient: QueryClient): LoadsStore {
  const known = loadsOnTheirWay.get(queryClient);
  if (known !== undefined) return known;
  const store: LoadsStore = { values: new Map(), listeners: new Set() };
  loadsOnTheirWay.set(queryClient, store);
  return store;
}

function setLoads(store: LoadsStore, values: ReadonlyMap<string, { alwaysLoad: boolean }>) {
  store.values = values;
  for (const listener of store.listeners) listener();
}

const pinKey = ({ botId, skillId }: { botId: string; skillId: string }) => `${botId}:${skillId}`;

// The Always load value on its way for a bot and a skill, or null.
export function useAlwaysLoadsOnTheirWay(): (pin: {
  botId: string;
  skillId: string;
}) => boolean | null {
  const store = loadsStore(useQueryClient());
  const values = useSyncExternalStore(
    (listener) => {
      store.listeners.add(listener);
      return () => {
        store.listeners.delete(listener);
      };
    },
    () => store.values,
  );
  return (pin) => values.get(pinKey(pin))?.alwaysLoad ?? null;
}

// One pin change of a control that shows the value on its way (the Always load switch on the
// bot page and on the Skills page): it sends the change, writes the answer, and ends only after
// the refresh that follows. An answer that writes nothing (the list loaded while it was on its
// way) leaves the old pin in the list until that refresh, so the control keeps the value on its
// way until this resolves. A failure goes to `onFailed` at once, and the refresh still follows.
export async function sendPinChange({
  queryClient,
  request,
  botId,
  skillId,
  alwaysLoad,
  expected,
  onFailed,
  refresh,
}: {
  queryClient: QueryClient;
  // Sends the change; called after the load count is read.
  request: () => Promise<BotRow>;
  botId: string;
  skillId: string;
  // The value on its way, for `useAlwaysLoadsOnTheirWay`.
  alwaysLoad: boolean;
  expected: PinExpected;
  onFailed: (error: unknown) => void;
  refresh: () => Promise<unknown>;
}): Promise<void> {
  const store = loadsStore(queryClient);
  const key = pinKey({ botId, skillId });
  const mine = { alwaysLoad };
  setLoads(store, new Map(store.values).set(key, mine));
  const loadsAtSend = botListLoads(queryClient);
  try {
    const answer = await request();
    writePinAnswer({ queryClient, answer, skillId, expected, loadsAtSend });
  } catch (error) {
    onFailed(error);
  }
  try {
    await refresh();
  } finally {
    if (store.values.get(key) === mine) {
      const next = new Map(store.values);
      next.delete(key);
      setLoads(store, next);
    }
  }
}

// Remove of a skill from a bot (bot-page.md §7, skills-page.md §2a): the row goes at once, also
// over a load that lands before the answer (`lib/api/optimistic.ts`). A failure brings the row
// back with the refresh after it, and goes to `onFailed`.
// The end of each Remove on its way, by bot and skill. A pin has no id of its own, so the hold
// cannot tell a pin added again from the one it removed; the add ends the hold (`writePinAnswer`).
const removesOnTheirWay = new WeakMap<QueryClient, Map<string, () => void>>();

export function sendPinRemove({
  queryClient,
  request,
  botId,
  skillId,
  onFailed,
  refresh,
}: {
  queryClient: QueryClient;
  request: () => Promise<unknown>;
  botId: string;
  skillId: string;
  onFailed: (error: unknown) => void;
  refresh: () => Promise<unknown>;
}): void {
  const release = showUntilAnswered<BotRow[]>({
    queryClient,
    queryKey: listBotsQueryKey(),
    kind: `remove ${pinKey({ botId, skillId })}`,
    change: (list) =>
      list.map((bot) =>
        bot.id === botId
          ? withPins(
              bot,
              bot.pins.filter((pin) => pin.skill_id !== skillId),
            )
          : bot,
      ),
  });
  const removes = removesOnTheirWay.get(queryClient) ?? new Map<string, () => void>();
  removesOnTheirWay.set(queryClient, removes);
  const key = pinKey({ botId, skillId });
  const end = () => {
    release();
    if (removes.get(key) === end) removes.delete(key);
  };
  removes.set(key, end);
  void request()
    .then(end, (error: unknown) => {
      end();
      onFailed(error);
    })
    .finally(() => void refresh());
}
