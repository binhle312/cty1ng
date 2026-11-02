import { Link } from "@tanstack/react-router";
import { ArrowLeft, Plus, Search } from "lucide-react";
import { useState } from "react";
import { buttonVariants } from "../../components/ui/button.tsx";
import { PinBadge } from "../../components/ui/pin-badge.tsx";
import { cn } from "../../lib/cn.ts";
import { BotAvatar } from "./bot-avatar.tsx";
import { matchesSearch, statusText } from "./bot-lines.ts";
import { othersOf, pinnedOf, useSetPins, withPin, withoutPin } from "./bot-pins.ts";
import type { BotRow } from "./bot-queries.ts";
import { SortButtons } from "./bot-sort-buttons.tsx";

// The list of the edit layout (bot-page.md §1, E1–E2): ← Back and + Create, Search, then Pinned
// in the owner's order and Others with the two sort buttons, as on the grid. A row is the 36 px
// avatar with its state badge, the name and the status line; the pin badge sits on the row's
// top-right corner, never on the avatar. The list stays mounted while the owner moves between
// bots, so it keeps its scroll place.
export function BotSideList({ bots, currentId }: { bots: BotRow[]; currentId: string | null }) {
  const [query, setQuery] = useState("");
  const setPins = useSetPins();
  const pinnedIds = pinnedOf(bots).map((bot) => bot.id);
  const pinned = pinnedOf(bots).filter((bot) => matchesSearch(bot, query));
  const others = othersOf(bots).filter((bot) => matchesSearch(bot, query));
  const now = new Date();
  const row = (bot: BotRow) => (
    <BotSideRow
      key={bot.id}
      bot={bot}
      current={bot.id === currentId}
      status={statusText(bot, now)}
      onPin={() => {
        setPins(
          bot.pinned_position === null ? withPin(pinnedIds, bot.id) : withoutPin(pinnedIds, bot.id),
        );
      }}
    />
  );
  return (
    <nav
      aria-label="Bots"
      className="flex h-full w-list-column shrink-0 flex-col border-r border-outline bg-surface-container"
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        <Link
          to="/bots"
          className="flex items-center gap-1 rounded-control px-1 text-on-surface-muted hover:text-on-surface focus-visible:outline-2 focus-visible:outline-primary"
        >
          <ArrowLeft aria-hidden size={14} />
          Back
        </Link>
        <Link to="/bots/new" className={buttonVariants({ size: "small" })}>
          <Plus aria-hidden size={14} />
          Create
        </Link>
      </div>
      <label className="mx-4 mt-3 flex h-control items-center gap-2 rounded-control border border-outline-strong px-2 focus-within:border-primary">
        <Search aria-hidden className="size-3.5 text-on-surface-muted" />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setQuery("");
          }}
          placeholder="Search"
          aria-label="Search bots"
          className="min-w-0 grow bg-transparent outline-none placeholder:text-on-surface-muted"
        />
      </label>
      <div className="mt-3 min-h-0 grow overflow-y-auto px-2 pb-4">
        {pinned.length > 0 && (
          <section aria-labelledby="side-pinned">
            <h2 id="side-pinned" className={GROUP_TITLE}>
              Pinned
            </h2>
            <ul>{pinned.map(row)}</ul>
          </section>
        )}
        {others.length > 0 && (
          <section aria-labelledby="side-others" className="mt-3">
            <div className="flex items-center justify-between pr-2">
              <h2 id="side-others" className={GROUP_TITLE}>
                Others
              </h2>
              <SortButtons />
            </div>
            <ul>{others.map(row)}</ul>
          </section>
        )}
        {pinned.length === 0 && others.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-on-surface-muted">
            No bots match "{query.trim()}".
          </p>
        )}
      </div>
    </nav>
  );
}

const GROUP_TITLE =
  "px-2 py-1.5 text-xs font-semibold tracking-wide text-on-surface-muted uppercase";

function BotSideRow({
  bot,
  current,
  status,
  onPin,
}: {
  bot: BotRow;
  current: boolean;
  status: string;
  onPin: () => void;
}) {
  return (
    <li
      data-testid="bot-row"
      data-bot={bot.slug}
      className={cn(
        "group relative flex items-center gap-3 rounded-card px-2 py-2 hover:bg-surface-raised",
        current && "bg-primary-tint",
      )}
    >
      <BotAvatar
        bot={bot}
        size="header"
        badge={bot.health?.level === "cannot_run" ? "cannot_run" : null}
      />
      <span className="min-w-0 grow">
        <Link
          to="/bots/$slug"
          params={{ slug: bot.slug }}
          aria-current={current ? "page" : undefined}
          className="block truncate font-semibold outline-none after:absolute after:inset-0 after:rounded-card focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-primary"
        >
          {bot.name}
        </Link>
        <span className="block truncate text-sm text-on-surface-muted">{status}</span>
      </span>
      <PinBadge
        pinned={bot.pinned_position !== null}
        name={bot.name}
        onClick={onPin}
        className="absolute top-1 right-1 z-10"
      />
    </li>
  );
}
