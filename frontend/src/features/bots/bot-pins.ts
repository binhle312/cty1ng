import { orderBots, type BotOrder } from "@cty1ng/shared/bots";
import { SETTING_DEFAULTS } from "@cty1ng/shared/settings";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { showToast } from "../../components/ui/toast.tsx";
import { readApiError } from "../../lib/api/api-error.ts";
import {
  getSettingsQueryKey,
  listBotsQueryKey,
  setPinnedBotsMutation,
} from "../../lib/api/generated/@tanstack/react-query.gen.ts";
import type { GetSettingsResponse } from "../../lib/api/generated/types.gen.ts";
import { BOT_QUERIES } from "../../lib/api/operation-queries.ts";
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
export function withPinAt(ids: readonly string[], id: string, index: number): string[] {
  const rest = withoutPin(ids, id);
  const at = Math.max(0, Math.min(index, rest.length));
  return [...rest.slice(0, at), id, ...rest.slice(at)];
}

// Alt+← and Alt+→: one place left or right; nothing at the ends.
export function withPinMoved(ids: readonly string[], id: string, by: -1 | 1): string[] {
  const from = ids.indexOf(id);
  if (from === -1) return [...ids];
  return withPinAt(ids, id, from + by);
}

// The bot list after a pin change, in header order: what the page shows before the server
// answers. The others go back to their sorted place, by the same rule as the server.
export function reorderedBots(
  bots: readonly BotRow[],
  pinnedIds: readonly string[],
  order: BotOrder,
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

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

// Saves a new pinned list at once, with no save bar (pin.md §2). The page and the header show it
// before the answer. It sends the pinned list it saw; when the list changed meanwhile (a bot
// deleted in another tab), the server refuses it with 409 `bot_list_changed`, and the page
// reloads the order (bots.md UI-4.5).
export function useSetPins() {
  const queryClient = useQueryClient();
  const mutation = useMutation(setPinnedBotsMutation());
  const { mutateAsync } = mutation;
  return useCallback(
    (nextIds: readonly string[]) => {
      const key = listBotsQueryKey();
      const bots = queryClient.getQueryData<BotRow[]>(key);
      if (bots === undefined) return;
      const expected = pinnedOf(bots).map((bot) => bot.id);
      if (sameIds(expected, nextIds)) return;
      const settings = queryClient.getQueryData<GetSettingsResponse>(getSettingsQueryKey());
      const order: BotOrder = {
        bot_order: settings?.bot_order ?? SETTING_DEFAULTS.bot_order,
        bot_order_direction: settings?.bot_order_direction ?? SETTING_DEFAULTS.bot_order_direction,
      };
      void queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<BotRow[]>(key, reorderedBots(bots, nextIds, order));
      mutateAsync({ body: { bot_ids: [...nextIds], expected_bot_ids: expected } })
        .catch((error: unknown) => {
          showToast(
            readApiError(error)?.code === "bot_list_changed"
              ? "The bot list changed. Try again."
              : "The app could not save the pinned bots. Try again.",
          );
        })
        .finally(() => {
          void queryClient.invalidateQueries({ predicate: BOT_QUERIES });
        });
    },
    [queryClient, mutateAsync],
  );
}
