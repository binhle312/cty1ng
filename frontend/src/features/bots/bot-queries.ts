import { useQuery } from "@tanstack/react-query";
import { listBotsOptions } from "../../lib/api/generated/@tanstack/react-query.gen.ts";
import type { ListBotsResponse } from "../../lib/api/generated/types.gen.ts";

export type BotRow = ListBotsResponse[number];
export type BotPin = BotRow["pins"][number];

// The bots not in Trash, in header order. Bots in Trash are not in it (api.md §4).
export function useBots() {
  return useQuery(listBotsOptions());
}

// The pin of one skill on a bot, or undefined.
export function pinOf(bot: BotRow, skillId: string): BotPin | undefined {
  return bot.pins.find((pin) => pin.skill_id === skillId);
}

// The bots that use a skill, each with its pin.
export function botsUsing(bots: BotRow[], skillId: string): { bot: BotRow; pin: BotPin }[] {
  return bots.flatMap((bot) => {
    const pin = pinOf(bot, skillId);
    return pin === undefined ? [] : [{ bot, pin }];
  });
}
