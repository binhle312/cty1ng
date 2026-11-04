import type { BotOrder } from "@cty1ng/shared/bots";
import { SETTING_DEFAULTS } from "@cty1ng/shared/settings";
import type { GetSettingsResponse, SetBotSkillData } from "../../lib/api/generated/types.gen.ts";
import { withSaveAnswer } from "./bot-edit-form.ts";
import { pinnedOf, reorderedBots } from "./bot-order.ts";
import type { BotPin, BotRow } from "./bot-queries.ts";

// The state of the bot list (`GET /bots`) and of the sort in the settings, on every page that
// shows them: the server value, and the requests of this page that wait, in the order they were
// sent. What the page shows is computed from the two (`shownBots`, `shownSettings`), so a load
// that lands while a request waits never shows an old value, and a refused request goes back to
// the server value with the other requests still on it (bot-page.md §7.1, skills-page.md §2a,
// pin.md §2; lessons `two-of-my-requests-at-once.md`, `state-table-before-stateful-code.md`).
//
// Pure: no React, no query client, no clock. `bot-list-store.ts` sends the events.
//
// The rules:
// - Shown: a Remove that waits hides its row; the newest pinned order and sort that wait show.
//   A pin change (Always load, Move, + Add) shows nothing in the list while it waits; the
//   Always load switch shows its value (`alwaysLoadOnItsWay`).
// - Refused: the request leaves at once.
// - Saved: the request leaves and its value goes into the server value, so it stays with no load
//   after it, also when the refresh after it fails. It ends the older requests of the same pin,
//   pinned order or sort: the server has a newer value, so their answers change nothing.
//   A pin answer goes in only while the page showed the pin the request expected, and only when
//   no list load landed since it went out: a newer change may have the expected value again
//   (on, then off in another tab), and the refresh after the answer shows it. An add sent
//   while a Remove of its pin waited goes in also after a load: the Remove kept that load
//   hidden, or answered before the add, and the server took the add after it.
// - An Always load change stays, after its answer, until the refresh after it ends: the switch
//   keeps the value on its way until then.

// The pin a pin change sent as `expected`; null for a new pin.
export type PinExpected = SetBotSkillData["body"]["expected"];

export interface PinKey {
  botId: string;
  skillId: string;
}

export type BotListRequest =
  // Always load (`alwaysLoad` is the value on its way), Move (Upgrade, Change version) or + Add
  // (`expected` null); `alwaysLoad` is null for the last two.
  | {
      kind: "pin";
      botId: string;
      skillId: string;
      expected: PinExpected;
      alwaysLoad: boolean | null;
    }
  | { kind: "remove"; botId: string; skillId: string }
  // The whole pinned list, in order.
  | { kind: "pinned"; ids: readonly string[] }
  | { kind: "sort"; order: BotOrder };

interface Waiting {
  id: number;
  request: BotListRequest;
  // The list loads when it went out.
  loadsAtSend: number;
  // Sent while a Remove of the same pin waited: the page showed no pin then.
  afterRemove: boolean;
  // Answered or refused; only an Always load change stays then, until its refresh ends.
  answered: boolean;
}

export interface BotListState {
  // The server value: the last loads, and the answers the rules above let in.
  bots: readonly BotRow[] | undefined;
  settings: GetSettingsResponse | undefined;
  // The list loads so far.
  loads: number;
  requests: readonly Waiting[];
}

export type BotListEvent =
  | { type: "sent"; id: number; request: BotListRequest }
  // A pin change carries the bot of the answer; a Remove, pinned order or sort carries nothing.
  // A pin change with no answer bot (the bot was not in the answer) only leaves.
  | { type: "answered"; id: number; answer?: BotRow }
  | { type: "refused"; id: number }
  | { type: "refreshEnded"; id: number }
  | { type: "listLoaded"; bots: readonly BotRow[] }
  | { type: "settingsLoaded"; settings: GetSettingsResponse }
  // A Profile or Model save: it writes only the fields a save owns (`withSaveAnswer`).
  | { type: "saveAnswered"; answer: BotRow };

export function initialBotListState({
  bots,
  settings,
}: {
  bots: readonly BotRow[] | undefined;
  settings: GetSettingsResponse | undefined;
}): BotListState {
  return { bots, settings, loads: 0, requests: [] };
}

export function botListReducer(state: BotListState, event: BotListEvent): BotListState {
  switch (event.type) {
    case "sent":
      return {
        ...state,
        requests: [
          ...state.requests,
          {
            id: event.id,
            request: event.request,
            loadsAtSend: state.loads,
            afterRemove: state.requests.some(
              (other) =>
                !other.answered &&
                other.request.kind === "remove" &&
                samePin(other.request, event.request),
            ),
            answered: false,
          },
        ],
      };
    case "answered":
      return answered(state, event);
    case "refused": {
      const mine = waitingOf(state, event.id);
      if (mine === undefined) return state;
      return endOrKeep(state, mine);
    }
    case "refreshEnded":
      return {
        ...state,
        requests: state.requests.filter((other) => !(other.id === event.id && other.answered)),
      };
    case "listLoaded":
      return { ...state, bots: event.bots, loads: state.loads + 1 };
    case "settingsLoaded":
      return { ...state, settings: event.settings };
    case "saveAnswered":
      return state.bots === undefined
        ? state
        : {
            ...state,
            bots: state.bots.map((bot) => withSaveAnswer({ bot, answer: event.answer })),
          };
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

// The request with this id that has no answer yet.
function waitingOf(state: BotListState, id: number): Waiting | undefined {
  return state.requests.find((other) => other.id === id && !other.answered);
}

// At its answer, an Always load change stays until its refresh ends; every other request leaves.
function endOrKeep(state: BotListState, mine: Waiting): BotListState {
  const keep = mine.request.kind === "pin" && mine.request.alwaysLoad !== null;
  return {
    ...state,
    requests: keep
      ? state.requests.map((other) => (other === mine ? { ...other, answered: true } : other))
      : state.requests.filter((other) => other !== mine),
  };
}

const samePin = (a: BotListRequest, b: BotListRequest): boolean =>
  (a.kind === "pin" || a.kind === "remove") &&
  (b.kind === "pin" || b.kind === "remove") &&
  a.botId === b.botId &&
  a.skillId === b.skillId;

const sameThing = (a: BotListRequest, b: BotListRequest): boolean =>
  samePin(a, b) || (a.kind === b.kind && (a.kind === "pinned" || a.kind === "sort"));

function answered(
  state: BotListState,
  { id, answer }: { id: number; answer?: BotRow | undefined },
): BotListState {
  const mine = waitingOf(state, id);
  if (mine === undefined) return state;
  const at = state.requests.indexOf(mine);
  // The older requests of the same thing that wait: the server has a newer value now.
  const older = state.requests
    .slice(0, at)
    .filter((other) => !other.answered && sameThing(other.request, mine.request));
  const server = savedInto(state, { mine, answer });
  const ended = new Set(older);
  return endOrKeep(
    { ...server, requests: state.requests.filter((other) => !ended.has(other)) },
    mine,
  );
}

// The server value with a saved request in it.
function savedInto(
  state: BotListState,
  { mine, answer }: { mine: Waiting; answer: BotRow | undefined },
): BotListState {
  const { request } = mine;
  const bots = state.bots;
  if (bots === undefined) return state;
  switch (request.kind) {
    case "remove":
      return {
        ...state,
        bots: bots.map((bot) =>
          bot.id === request.botId ? withPins(bot, pinsWithout(bot.pins, request.skillId)) : bot,
        ),
      };
    case "pin": {
      const pin = answer?.pins.find((item) => item.skill_id === request.skillId);
      if (answer === undefined || pin === undefined) return state;
      // The pin the page showed: the server's, or none while an older Remove of it waited.
      const removedBefore = mine.afterRemove;
      const loadedSince = state.loads !== mine.loadsAtSend;
      if (loadedSince && !removedBefore) return state;
      return {
        ...state,
        bots: bots.map((bot) => {
          if (bot.id !== request.botId) return bot;
          const shown = removedBefore ? undefined : pinOf(bot.pins, request.skillId);
          if (!isExpected(shown, request.expected)) return bot;
          const pins = pinOf(bot.pins, request.skillId)
            ? bot.pins.map((item) => (item.skill_id === request.skillId ? pin : item))
            : [...bot.pins, pin];
          return withPins(bot, pins);
        }),
      };
    }
    case "pinned":
      return {
        ...state,
        bots: reorderedBots(bots, { pinnedIds: request.ids, order: orderOf(state.settings) }),
      };
    case "sort":
      return {
        ...state,
        settings:
          state.settings === undefined ? undefined : { ...state.settings, ...request.order },
        bots: reorderedBots(bots, { pinnedIds: idsOf(pinnedOf(bots)), order: request.order }),
      };
    default: {
      const _exhaustive: never = request;
      return _exhaustive;
    }
  }
}

function isExpected(shown: BotPin | undefined, expected: PinExpected): boolean {
  if (expected === null) return shown === undefined;
  return (
    shown !== undefined &&
    shown.skill_version_id === expected.skill_version_id &&
    shown.always_load === expected.always_load
  );
}

const pinOf = (pins: readonly BotPin[], skillId: string) =>
  pins.find((pin) => pin.skill_id === skillId);
const pinsWithout = (pins: readonly BotPin[], skillId: string) =>
  pins.filter((pin) => pin.skill_id !== skillId);
const idsOf = (bots: readonly BotRow[]) => bots.map((bot) => bot.id);

// The bot with these pins, and the same counts as the server's (bots.service.ts).
function withPins(bot: BotRow, pins: BotPin[]): BotRow {
  const updates = pins.filter((item) => item.version < item.latest_version).length;
  return { ...bot, pins, counts: { ...bot.counts, skills: pins.length, skill_updates: updates } };
}

function orderOf(settings: GetSettingsResponse | undefined): BotOrder {
  return {
    bot_order: settings?.bot_order ?? SETTING_DEFAULTS.bot_order,
    bot_order_direction: settings?.bot_order_direction ?? SETTING_DEFAULTS.bot_order_direction,
  };
}

function newestPinned(state: BotListState): readonly string[] | undefined {
  for (const { request } of [...state.requests].reverse()) {
    if (request.kind === "pinned") return request.ids;
  }
  return undefined;
}

function newestSort(state: BotListState): BotOrder | undefined {
  for (const { request } of [...state.requests].reverse()) {
    if (request.kind === "sort") return request.order;
  }
  return undefined;
}

// The list the page shows: the server value itself when no request changes it.
export function shownBots(state: BotListState): readonly BotRow[] | undefined {
  const { bots } = state;
  if (bots === undefined) return undefined;
  const removes = state.requests.flatMap(({ request }) =>
    request.kind === "remove" ? [request] : [],
  );
  const pinned = newestPinned(state);
  const sort = newestSort(state);
  if (removes.length === 0 && pinned === undefined && sort === undefined) return bots;
  const hidden = bots.map((bot) => {
    const gone = removes.filter((remove) => remove.botId === bot.id);
    if (gone.length === 0) return bot;
    return withPins(
      bot,
      bot.pins.filter((pin) => !gone.some((remove) => remove.skillId === pin.skill_id)),
    );
  });
  if (pinned === undefined && sort === undefined) return hidden;
  return reorderedBots(hidden, {
    pinnedIds: pinned ?? idsOf(pinnedOf(hidden)),
    order: sort ?? orderOf(state.settings),
  });
}

// The settings the page shows: the sort on its way, if one waits.
export function shownSettings(state: BotListState): GetSettingsResponse | undefined {
  const sort = newestSort(state);
  if (sort === undefined || state.settings === undefined) return state.settings;
  return { ...state.settings, ...sort };
}

// The Always load value on its way for a pin, or null.
export function alwaysLoadOnItsWay(state: BotListState, key: PinKey): boolean | null {
  for (const { request } of [...state.requests].reverse()) {
    if (
      request.kind === "pin" &&
      request.alwaysLoad !== null &&
      request.botId === key.botId &&
      request.skillId === key.skillId
    ) {
      return request.alwaysLoad;
    }
  }
  return null;
}
