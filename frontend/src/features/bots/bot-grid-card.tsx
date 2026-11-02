import { Link, useNavigate } from "@tanstack/react-router";
import { Ellipsis } from "lucide-react";
import type { Ref } from "react";
import {
  MenuItem,
  MenuLinkItem,
  MenuPopup,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from "../../components/ui/menu.tsx";
import { PinBadge } from "../../components/ui/pin-badge.tsx";
import { TimeText } from "../../components/ui/time-text.tsx";
import { cn } from "../../lib/cn.ts";
import { BotAvatar } from "./bot-avatar.tsx";
import { BotBand } from "./bot-band.tsx";
import { countText, healthLine, modelLine } from "./bot-lines.ts";
import type { BotRow } from "./bot-queries.ts";

// What a drag gives a pinned card (bots-page.md §6): the element refs and the handle props (with
// the keyboard: Space picks the card up, Alt+← and Alt+→ move it). The drop line is drawn by the
// Bots page beside the card: the card clips what is outside it.
export interface CardDrag {
  setNodeRef: Ref<HTMLElement>;
  setActivatorNodeRef: Ref<HTMLAnchorElement>;
  handleProps: Record<string, unknown>;
  // The card that moves: its place is a gap.
  isGap: boolean;
}

// One card of the Bots page (bots-page.md §2, V3). The whole card is one link to the bot page;
// the pin badge and the ⋯ menu sit above the link. A pinned card shows the grab cursor.
export function BotGridCard({
  bot,
  onPin,
  onDelete,
  drag,
  overlay = false,
}: {
  bot: BotRow;
  onPin: () => void;
  onDelete: () => void;
  drag?: CardDrag;
  // The copy that follows the pointer while a card moves: no controls.
  overlay?: boolean;
}) {
  const pinned = bot.pinned_position !== null;
  const health = healthLine(bot.health);
  const cannotRun = bot.health?.level === "cannot_run";
  const needsAttention = bot.health?.level === "needs_attention";
  return (
    <article
      ref={drag?.setNodeRef}
      data-testid="bot-card"
      data-bot={bot.slug}
      className={cn(
        "group relative flex min-h-80 flex-col items-center overflow-hidden rounded-card border bg-surface-container px-4 pt-5 pb-4 text-center",
        cannotRun ? "border-danger" : needsAttention ? "border-primary" : "border-outline",
        drag?.isGap === true && "border-dashed-slot border-outline bg-transparent",
        overlay && "cursor-grabbing shadow-2xl",
      )}
    >
      {drag?.isGap === true ? null : (
        <>
          <BotBand colour={bot.avatar_colour} className="h-20" />
          <BotAvatar
            bot={bot}
            size="list"
            badge={cannotRun ? "cannot_run" : null}
            className="mt-2"
          />
          <h3 className="mt-3 w-full truncate font-semibold">
            {overlay ? (
              bot.name
            ) : (
              <Link
                to="/bots/$slug"
                params={{ slug: bot.slug }}
                ref={drag?.setActivatorNodeRef}
                {...drag?.handleProps}
                className={cn(
                  "rounded-card outline-none after:absolute after:inset-0 after:rounded-card focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-primary",
                  pinned ? "cursor-grab active:cursor-grabbing" : "cursor-default",
                )}
              >
                {bot.name}
              </Link>
            )}
          </h3>
          <span className="mt-1.5 max-w-full truncate rounded-pill border border-outline-strong px-2 py-0.5 text-xs text-on-surface-muted">
            {modelLine(bot)}
          </span>
          <p className="mt-2.5 line-clamp-2 text-on-surface-muted">{bot.description}</p>
          <div className="mt-4 grid w-full grid-cols-3 gap-1 text-xs text-on-surface-muted">
            <CountCell value={bot.counts.skills} noun="skill" updates={bot.counts.skill_updates} />
            <CountCell value={bot.counts.projects} noun="project" />
            <CountCell value={bot.counts.conversations} noun="conversation" />
          </div>
          <div className="mt-auto flex w-full flex-col items-center gap-1 pt-4 text-xs">
            {health !== null && (
              <p className={health.level === "danger" ? "text-danger" : "text-primary"}>
                {health.level === "danger" ? "⚠ " : ""}
                {health.text}
              </p>
            )}
            <StatusLine bot={bot} />
          </div>
          {!overlay && (
            <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
              <BotMenu bot={bot} onDelete={onDelete} />
              <PinBadge pinned={pinned} name={bot.name} onClick={onPin} />
            </div>
          )}
        </>
      )}
    </article>
  );
}

function CountCell({
  value,
  noun,
  updates = 0,
}: {
  value: number;
  noun: "skill" | "project" | "conversation";
  updates?: number;
}) {
  const words = countText(value, noun).split(" ").slice(1).join(" ");
  return (
    <p className="flex flex-col items-center">
      <span className="text-lg font-semibold text-on-surface">
        {value}
        {updates > 0 && (
          <span className="ml-1 text-xs text-primary">
            ↑{updates}
            <span className="sr-only"> skill updates</span>
          </span>
        )}
      </span>
      <span>{words}</span>
    </p>
  );
}

// The status line (bot-status.md §2). M2 has no runs: Idle, with the last active time when
// there is one.
function StatusLine({ bot }: { bot: BotRow }) {
  return (
    <p className="relative z-10 flex items-center gap-1.5 text-on-surface-muted">
      <span aria-hidden className="size-1.5 rounded-pill bg-on-surface-muted" />
      {bot.last_activity_at === null ? (
        "Idle · no activity yet"
      ) : (
        <>
          Idle · last active <TimeText iso={bot.last_activity_at} />
        </>
      )}
    </p>
  );
}

// The ⋯ menu (bots-page.md §3): Details, Clone, Delete. Message comes with M3.
export function BotMenu({ bot, onDelete }: { bot: BotRow; onDelete: () => void }) {
  const navigate = useNavigate();
  return (
    <MenuRoot>
      <MenuTrigger
        aria-label={`${bot.name} actions`}
        className="flex size-6 items-center justify-center rounded-pill text-on-surface-muted opacity-0 outline-none group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-surface-raised hover:text-on-surface focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-primary data-popup-open:opacity-100"
      >
        <Ellipsis aria-hidden size={16} />
      </MenuTrigger>
      <MenuPopup side="bottom" align="end" sideOffset={6} label={`${bot.name} actions`}>
        <MenuLinkItem
          current={false}
          render={<Link to="/bots/$slug" params={{ slug: bot.slug }} />}
        >
          Details
        </MenuLinkItem>
        <MenuSeparator />
        <MenuItem
          onClick={() => {
            void navigate({ to: "/bots/new", search: { from: bot.id } });
          }}
        >
          Clone
        </MenuItem>
        <MenuSeparator />
        <MenuItem danger onClick={onDelete}>
          Delete
        </MenuItem>
      </MenuPopup>
    </MenuRoot>
  );
}
