import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { showToast } from "../../components/ui/toast.tsx";
import { readApiError } from "../../lib/api/api-error.ts";
import {
  listBotsQueryKey,
  setPinnedBotsMutation,
} from "../../lib/api/generated/@tanstack/react-query.gen.ts";
import { BOT_QUERIES } from "../../lib/api/operation-queries.ts";
import { startOrderChange } from "./bot-list-store.ts";
import { pinnedOf } from "./bot-order.ts";
import type { BotRow } from "./bot-queries.ts";

function sameIds({ a, b }: { a: readonly string[]; b: readonly string[] }): boolean {
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
      if (sameIds({ a: expected, b: nextIds })) return;
      // The new order shows until the answer, also over a load that lands before it, and a newer
      // pin change replaces it; the others keep the sort shown, which may be a sort on its way
      // (`bot-list-state.ts`).
      const held = startOrderChange(queryClient, { kind: "pinned", ids: [...nextIds] });
      mutateAsync({ body: { bot_ids: [...nextIds], expected_bot_ids: expected } })
        .then(
          () => {
            held.answered();
          },
          (error: unknown) => {
            held.refused();
            showToast(
              readApiError(error)?.code === "bot_list_changed"
                ? "The bot list changed. Try again."
                : "The app could not save the pinned bots. Try again.",
            );
          },
        )
        .finally(() => {
          void queryClient.invalidateQueries({ predicate: BOT_QUERIES });
        });
    },
    [queryClient, mutateAsync],
  );
}
