import { type BotOrder, orderBots } from "@cty1ng/shared/bots";
import type { BotRow } from "./bot-queries.ts";

// Pin, unpin and reorder (pin.md, bots-page.md §6, top-header.md §3). The server list comes in
// header order: the pinned bots by position, then the others by the `bot_order` sort.

// The pinned bots by position, whatever the order of the list.
export function pinnedOf(bots: readonly BotRow[]): BotRow[] {
  return bots
    .filter((bot) => bot.pinned_position !== null)
    .sort((a, b) => (a.pinned_position ?? 0) - (b.pinned_position ?? 0));
}

export function othersOf(bots: readonly BotRow[]): BotRow[] {
  return bots.filter((bot) => bot.pinned_position === null);
}

// A pin puts the bot at the end of the pinned group (pin.md §2).
export function withPin(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? [...ids] : [...ids, id];
}

export function withoutPin(ids: readonly string[], id: string): string[] {
  return ids.filter((other) => other !== id);
}

// The pinned list with `id` at `index` (a drop, or a pin at the drop place in the header).
export function withPinAt(
  ids: readonly string[],
  { id, index }: { id: string; index: number },
): string[] {
  const rest = withoutPin(ids, id);
  const at = Math.max(0, Math.min(index, rest.length));
  return [...rest.slice(0, at), id, ...rest.slice(at)];
}

// Alt+← and Alt+→: one place left or right; nothing at the ends.
export function withPinMoved(
  ids: readonly string[],
  { id, by }: { id: string; by: -1 | 1 },
): string[] {
  const from = ids.indexOf(id);
  if (from === -1) return [...ids];
  return withPinAt(ids, { id, index: from + by });
}

// The bot list after a pin change, in header order: what the page shows before the server
// answers. The others go back to their sorted place, by the same rule as the server.
export function reorderedBots(
  bots: readonly BotRow[],
  { pinnedIds, order }: { pinnedIds: readonly string[]; order: BotOrder },
): BotRow[] {
  const placed = bots.map((bot) => {
    const at = pinnedIds.indexOf(bot.id);
    return { ...bot, pinned_position: at === -1 ? null : at + 1 };
  });
  const byId = new Map(placed.map((bot) => [bot.id, bot]));
  return orderBots(
    placed.map((bot) => ({
      id: bot.id,
      pinnedPosition: bot.pinned_position,
      lastActivityAt: bot.last_activity_at === null ? null : new Date(bot.last_activity_at),
      createdAt: new Date(bot.created_at),
    })),
    order,
  ).flatMap((input) => {
    const bot = byId.get(input.id);
    return bot === undefined ? [] : [bot];
  });
}
