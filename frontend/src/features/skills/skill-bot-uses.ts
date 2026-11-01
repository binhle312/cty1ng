import { botsUsing, useBots, type BotPin, type BotRow } from "../bots/bot-queries.ts";

export interface BotUse {
  bot: BotRow;
  pin: BotPin;
}

// The bots that use one skill, read from the bot list (`GET /bots`, which has every pin): a
// union, so a screen cannot show "no bot" while the list is still loading or has failed. A failed
// background refresh keeps the data it has.
export type BotUses =
  | { kind: "loading" }
  | { kind: "error"; retry: () => void }
  | { kind: "ready"; uses: BotUse[]; all: BotRow[] };

export function useBotUses(skillId: string): BotUses {
  const bots = useBots();
  if (bots.data !== undefined) {
    return {
      kind: "ready",
      uses: botsUsing(bots.data, skillId),
      all: bots.data,
    };
  }
  if (bots.isError) return { kind: "error", retry: () => void bots.refetch() };
  return { kind: "loading" };
}
