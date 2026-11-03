import type { BotOrder } from "@cty1ng/shared/bots";
import { SETTING_DEFAULTS } from "@cty1ng/shared/settings";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Clock } from "lucide-react";
import { SortButton } from "../../components/ui/sort-button.tsx";
import { showToast } from "../../components/ui/toast.tsx";
import {
  getSettingsOptions,
  getSettingsQueryKey,
  listBotsQueryKey,
  updateSettingsMutation,
} from "../../lib/api/generated/@tanstack/react-query.gen.ts";
import type { GetSettingsResponse } from "../../lib/api/generated/types.gen.ts";
import { SETTINGS_OR_BOT_QUERIES } from "../../lib/api/operation-queries.ts";
import { showUntilAnswered } from "../../lib/api/optimistic.ts";
import { pinnedOf, reorderedBots } from "./bot-pins.ts";
import type { BotRow } from "./bot-queries.ts";

// The two sort buttons beside the Others title (bots-page.md §5, time-format.md §2), on the Bots
// page and in the bot page list (bot-page.md §1). One setting holds the sort for both and the
// header. The list moves at once; the server keeps it.
export function SortButtons() {
  const queryClient = useQueryClient();
  const settings = useQuery(getSettingsOptions());
  const { mutateAsync } = useMutation(updateSettingsMutation());
  const order: BotOrder = {
    bot_order: settings.data?.bot_order ?? SETTING_DEFAULTS.bot_order,
    bot_order_direction: settings.data?.bot_order_direction ?? SETTING_DEFAULTS.bot_order_direction,
  };
  const choose = (sort: BotOrder["bot_order"]) => {
    const next: BotOrder =
      order.bot_order === sort
        ? {
            bot_order: sort,
            bot_order_direction: order.bot_order_direction === "desc" ? "asc" : "desc",
          }
        : { bot_order: sort, bot_order_direction: "desc" };
    // The new sort shows until the answer, also over a load that lands before it, and a newer
    // sort replaces it (`lib/api/optimistic.ts`).
    const held = [
      showUntilAnswered<GetSettingsResponse>({
        queryClient,
        queryKey: getSettingsQueryKey(),
        kind: "sort",
        change: (old) => ({ ...old, ...next }),
        undo: (old) => ({ ...old, ...order }),
      }),
      showUntilAnswered<BotRow[]>({
        queryClient,
        queryKey: listBotsQueryKey(),
        kind: "sort",
        change: (old) =>
          reorderedBots(
            old,
            pinnedOf(old).map((bot) => bot.id),
            next,
          ),
        undo: (old) =>
          reorderedBots(
            old,
            pinnedOf(old).map((bot) => bot.id),
            order,
          ),
      }),
    ];
    mutateAsync({ body: next })
      .then(
        () => {
          for (const change of held) change.answered();
        },
        () => {
          for (const change of held) change.refused();
          showToast("The app could not save the sort. Try again.");
        },
      )
      .finally(() => {
        void queryClient.invalidateQueries({ predicate: SETTINGS_OR_BOT_QUERIES });
      });
  };
  const tip = (sort: BotOrder["bot_order"], name: string) => {
    if (order.bot_order !== sort) return `${name}, newest first.`;
    return order.bot_order_direction === "desc"
      ? `${name}, newest first. Click again for oldest first.`
      : `${name}, oldest first. Click again for newest first.`;
  };
  const label = (sort: BotOrder["bot_order"], name: string) =>
    order.bot_order === sort
      ? `Sort by ${name.toLowerCase()}, ${order.bot_order_direction === "desc" ? "newest" : "oldest"} first`
      : `Sort by ${name.toLowerCase()}`;
  return (
    <div className="flex items-center gap-1">
      <SortButton
        icon={<Clock aria-hidden size={14} />}
        on={order.bot_order === "recent"}
        direction={order.bot_order_direction}
        tooltip={tip("recent", "Recent activity")}
        label={label("recent", "Recent activity")}
        onClick={() => {
          choose("recent");
        }}
      />
      <SortButton
        icon={<CalendarDays aria-hidden size={14} />}
        on={order.bot_order === "created"}
        direction={order.bot_order_direction}
        tooltip={tip("created", "Created time")}
        label={label("created", "Created time")}
        onClick={() => {
          choose("created");
        }}
      />
    </div>
  );
}
