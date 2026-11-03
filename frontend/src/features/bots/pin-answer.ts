import { hashKey, type QueryClient } from "@tanstack/react-query";
import { listBotsQueryKey } from "../../lib/api/generated/@tanstack/react-query.gen.ts";
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
  // The same counts as the server's (bots.service.ts).
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
  if (botListLoads(queryClient) !== loadsAtSend) return;
  queryClient.setQueryData<BotRow[]>(listBotsQueryKey(), (current) =>
    current?.map((bot) =>
      bot.id === answer.id ? withPinAnswer({ bot, answer, skillId, expected }) : bot,
    ),
  );
}

// One pin change of a control that shows the value on its way (the Always load switch on the
// bot page and on the Skills page): it sends the change, writes the answer, and ends only after
// the refresh that follows. An answer that writes nothing (the list loaded while it was on its
// way) leaves the old pin in the list until that refresh, so the control keeps the value on its
// way until this resolves. A failure goes to `onFailed` at once, and the refresh still follows.
export async function sendPinChange({
  queryClient,
  request,
  skillId,
  expected,
  onFailed,
  refresh,
}: {
  queryClient: QueryClient;
  // Sends the change; called after the load count is read.
  request: () => Promise<BotRow>;
  skillId: string;
  expected: PinExpected;
  onFailed: (error: unknown) => void;
  refresh: () => Promise<unknown>;
}): Promise<void> {
  const loadsAtSend = botListLoads(queryClient);
  try {
    const answer = await request();
    writePinAnswer({ queryClient, answer, skillId, expected, loadsAtSend });
  } catch (error) {
    onFailed(error);
  }
  await refresh();
}
