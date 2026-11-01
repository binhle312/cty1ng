import { Link } from "@tanstack/react-router";
import { Pin, Settings } from "lucide-react";
import { Tooltip } from "../../components/ui/tooltip.tsx";
import { cn } from "../../lib/cn.ts";
import { BotAvatar } from "../bots/bot-avatar.tsx";
import { healthLine } from "../bots/bot-lines.ts";
import type { BotRow } from "../bots/bot-queries.ts";

// The header bot card (bot-card.md): the identity row with the pin button and the gear, then the
// status row. M2 hides Message and Add here: there are no conversations yet (§1). The card is
// part of the header for deferred reordering (UI-2.9): `data-header-part`.
export function HeaderBotCard({ bot, onPin }: { bot: BotRow; onPin: () => void }) {
  const pinned = bot.pinned_position !== null;
  const health = healthLine(bot.health);
  return (
    <div data-header-part className="flex w-65 flex-col">
      <div className="flex items-start gap-2.5 pb-3">
        <BotAvatar bot={bot} />
        <div className="min-w-0 grow">
          <div className="flex items-center gap-1">
            <p className="min-w-0 grow truncate font-semibold">{bot.name}</p>
            <Tooltip label={pinned ? "Unpin" : "Pin to top"} side="top">
              <button
                type="button"
                aria-label={pinned ? `Unpin ${bot.name}` : `Pin ${bot.name} to top`}
                aria-pressed={pinned}
                onClick={onPin}
                className={cn(
                  "flex size-5.5 items-center justify-center rounded-pill outline-none hover:bg-surface-bubble focus-visible:outline-2 focus-visible:outline-primary",
                  pinned ? "text-primary" : "text-on-surface-muted",
                )}
              >
                <Pin aria-hidden size={13} />
              </button>
            </Tooltip>
            <Tooltip label="Open the bot's settings in a new tab" side="top">
              <Link
                to="/bots/$slug"
                params={{ slug: bot.slug }}
                search={{ tab: "profile" }}
                target="_blank"
                aria-label={`${bot.name} settings, opens in a new tab`}
                className="flex size-5 items-center justify-center rounded-pill text-on-surface-muted outline-none hover:bg-surface-bubble hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary"
              >
                <Settings aria-hidden size={13} />
              </Link>
            </Tooltip>
          </div>
          <p className="truncate text-sm text-on-surface-muted">{bot.description}</p>
        </div>
      </div>
      <div className="border-t border-outline-strong pt-3">
        {health?.level === "danger" ? (
          <p className="flex items-center gap-1.5 text-danger">
            <span aria-hidden className="font-bold">
              !
            </span>
            {health.text}
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-on-surface-muted">
            <span aria-hidden className="size-1.5 rounded-pill bg-on-surface-muted" />
            Idle
          </p>
        )}
      </div>
    </div>
  );
}
