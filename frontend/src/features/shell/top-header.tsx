import { Link, useRouterState } from "@tanstack/react-router";
import { Pin, Plus } from "lucide-react";
import { lazy, Suspense } from "react";
import { cn } from "../../lib/cn.ts";
import { BotAvatar } from "../bots/bot-avatar.tsx";
import { othersOf, pinnedOf } from "../bots/bot-pins.ts";
import { type BotRow, useBots } from "../bots/bot-queries.ts";

// The interactive roster loads in its own chunk, so @dnd-kit is not in the first load
// (frontend-conventions.md §4). Until it is there, the same avatars stand in the same places.
const Roster = lazy(() => import("./header-roster.tsx").then((m) => ({ default: m.Roster })));

// The top header (top-header.md, app-shell.md UI-2): the bot roster in the middle 6 of 12
// columns. Pinned bots first in the owner's order, a short divider, then the others by the
// `bot_order` sort, as on the Bots page. With no bots, only the add slot (state 11).
export function TopHeader() {
  const bots = useBots();
  const all = bots.data;
  return (
    <header
      aria-label="Bots"
      data-header-part
      className="grid h-header shrink-0 grid-cols-12 items-center border-b border-outline bg-surface"
    >
      <div className="relative col-span-6 col-start-4 flex min-w-0 justify-center">
        {all === undefined ? null : all.length === 0 ? (
          <AddSlot />
        ) : (
          <Suspense fallback={<RosterStandIn bots={all} />}>
            <Roster bots={all} />
          </Suspense>
        )}
      </div>
    </header>
  );
}

// State 11: no bots yet. A dashed circle with "+"; it opens the Create bot page.
function AddSlot() {
  const onCreate = useRouterState({ select: (state) => state.location.pathname === "/bots/new" });
  return (
    <Link
      to="/bots/new"
      className="group flex items-center gap-2.5 rounded-pill pr-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span
        aria-hidden
        className={cn(
          "flex size-avatar items-center justify-center rounded-full border-dashed-slot transition-colors duration-120",
          onCreate
            ? "border-primary bg-primary-tint text-primary"
            : "border-outline-strong text-on-surface-muted group-hover:text-on-surface",
        )}
      >
        <Plus size={18} />
      </span>
      <span className={onCreate ? "text-primary" : "text-on-surface-muted"}>
        Hey, add your bot here 👋
      </span>
    </Link>
  );
}

// The roster before its chunk has loaded: the same layout, with nothing to press yet.
function RosterStandIn({ bots }: { bots: readonly BotRow[] }) {
  const pinned = pinnedOf(bots);
  const avatars = (list: readonly BotRow[]) =>
    list.map((bot) => (
      <BotAvatar key={bot.id} bot={bot} badge={bot.available ? null : "cannot_run"} />
    ));
  return (
    <div aria-busy="true" className="flex w-full min-w-0 justify-center overflow-hidden">
      <div className="mx-auto flex w-max items-center gap-2 px-1 py-2">
        {pinned.length === 0 ? (
          <span className="flex h-avatar shrink-0 items-center gap-1.5 rounded-pill border-dashed-slot border-outline-strong px-3 text-on-surface-muted">
            <Pin aria-hidden size={13} />
            Drag a bot here to pin it
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-2">{avatars(pinned)}</span>
        )}
        <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-outline-strong" />
        <span className="flex shrink-0 items-center gap-2">{avatars(othersOf(bots))}</span>
      </div>
    </div>
  );
}
