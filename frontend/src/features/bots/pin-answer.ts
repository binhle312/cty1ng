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

// What the page knew when a pin request went out: the bot list loads so far, and the Removes of
// each pin (`removesOf`). Read it just before the request.
export interface PinSent {
  loads: number;
  removes: ReadonlyMap<string, Readonly<PinRemoves>>;
}

export function markPinSend(queryClient: QueryClient): PinSent {
  const removes = new Map<string, Readonly<PinRemoves>>();
  for (const [key, value] of removesOf(queryClient)) removes.set(key, { ...value });
  return { loads: botListLoads(queryClient), removes };
}

// Writes the answer's pin into the bot list, unless the list loaded after the request went out.
export function writePinAnswer({
  queryClient,
  answer,
  skillId,
  expected,
  sent,
}: {
  queryClient: QueryClient;
  answer: BotRow;
  skillId: string;
  expected: PinExpected;
  sent: PinSent;
}): void {
  const key = pinKey({ botId: answer.id, skillId });
  const now = removesOf(queryClient).get(key);
  const then = sent.removes.get(key);
  const removesSince = (now?.started ?? 0) - (then?.started ?? 0);
  if (removesSince > 0) {
    // Sent before a Remove of its pin (an Always load change or a Move): the answer is about the
    // pin before that Remove, so it never shows it again. The server took it before the Remove,
    // so a Remove that still waits, and was the only one since, puts back this pin if it fails.
    const pin = answer.pins.find((item) => item.skill_id === skillId);
    if (pin !== undefined && removesSince === 1) now?.waiting?.keep(pin);
    return;
  }
  // The owner's own add of a pin that a Remove on its way hides: the add ends the Remove and its
  // pin shows, also after a list load, which the Remove's hold kept hidden.
  const addedBack = then?.waiting != null && then.waiting === now?.waiting;
  if (addedBack) now.waiting?.end();
  if (!addedBack && botListLoads(queryClient) !== sent.loads) return;
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
  // Sends the change; called after `markPinSend`.
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
  const sent = markPinSend(queryClient);
  try {
    const answer = await request();
    writePinAnswer({ queryClient, answer, skillId, expected, sent });
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

// The Removes of each pin, by bot and skill, for as long as the query client lives: how many
// started, and the one on its way. A pin has no id of its own, so a request tells its pin from
// a pin added again by the count of Removes since it went out (`writePinAnswer`).
interface WaitingRemove {
  // The owner added the pin again: the Remove ends, and the added pin stays.
  end: () => void;
  // A newer pin the server has (an older change saved first): a failed Remove puts it back.
  keep: (pin: BotPin) => void;
}
interface PinRemoves {
  started: number;
  waiting: WaitingRemove | null;
}
const removesByClient = new WeakMap<QueryClient, Map<string, PinRemoves>>();

function removesOf(queryClient: QueryClient): Map<string, PinRemoves> {
  const known = removesByClient.get(queryClient);
  if (known !== undefined) return known;
  const removes = new Map<string, PinRemoves>();
  removesByClient.set(queryClient, removes);
  return removes;
}

// Remove of a skill from a bot (bot-page.md §7, skills-page.md §2a): the row goes at once, also
// over a load that lands before the answer (`lib/api/optimistic.ts`). A failure brings the row
// back at once, also when the refresh after it fails, and goes to `onFailed`.
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
  let removed = queryClient
    .getQueryData<BotRow[]>(listBotsQueryKey())
    ?.find((bot) => bot.id === botId)
    ?.pins.find((pin) => pin.skill_id === skillId);
  const held = showUntilAnswered<BotRow[]>({
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
    // A failed Remove puts the pin back, unless the bot has a pin of the skill again.
    undo: (list) =>
      list.map((bot) =>
        bot.id === botId &&
        removed !== undefined &&
        !bot.pins.some((pin) => pin.skill_id === skillId)
          ? withPins(bot, [...bot.pins, removed])
          : bot,
      ),
  });
  const key = pinKey({ botId, skillId });
  const removes = removesOf(queryClient);
  const mine: WaitingRemove = {
    end: () => {
      stopWaiting();
      held.answered();
    },
    keep: (pin) => {
      removed = pin;
    },
  };
  const stopWaiting = () => {
    const now = removes.get(key);
    if (now?.waiting === mine) removes.set(key, { ...now, waiting: null });
  };
  removes.set(key, { started: (removes.get(key)?.started ?? 0) + 1, waiting: mine });
  void request()
    .then(
      () => {
        stopWaiting();
        held.answered();
      },
      (error: unknown) => {
        stopWaiting();
        held.refused();
        onFailed(error);
      },
    )
    .finally(() => void refresh());
}
