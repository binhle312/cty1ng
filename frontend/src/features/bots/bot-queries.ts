import { useQuery } from "@tanstack/react-query";
import { apiErrorText, readApiError } from "../../lib/api/api-error.ts";
import { listBotsOptions } from "../../lib/api/generated/@tanstack/react-query.gen.ts";
import type { ListBotsResponse } from "../../lib/api/generated/types.gen.ts";

export type BotRow = ListBotsResponse[number];
export type BotPin = BotRow["pins"][number];

// The bots not in Trash, in header order. Bots in Trash are not in it (api.md §4).
export function useBots() {
  return useQuery(listBotsOptions());
}

// The line for a failed change of a skill pin (bot-page.md §7, skills-page.md §2a, §7): a pin
// that changed in another place first (409 `stale_write`) names what changed, else the error's
// own line. `changed` is the bot or skill, or null when the change was for a list of bots.
export function pinErrorText({
  error,
  changed,
}: {
  error: unknown;
  changed: string | null;
}): string {
  if (readApiError(error)?.code !== "stale_write") return apiErrorText(error);
  return changed === null
    ? "A bot changed in another place. Check the list and try again."
    : `${changed} changed in another place. Check it and try again.`;
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
