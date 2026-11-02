import {
  type Announcements,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, type SortingStrategy, useSortable } from "@dnd-kit/sortable";
import { Link } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { type KeyboardEvent, useRef, useState } from "react";
import { buttonVariants } from "../../components/ui/button.tsx";
import { Skeleton, SkeletonArea } from "../../components/ui/skeleton.tsx";
import { cn } from "../../lib/cn.ts";
import { LoadError } from "../skills/load-error.tsx";
import { SleepySlime } from "./bot-avatar.tsx";
import { BotGridCard, type CardDrag } from "./bot-grid-card.tsx";
import { SortButtons } from "./bot-sort-buttons.tsx";
import { matchesSearch } from "./bot-lines.ts";
import {
  othersOf,
  pinnedOf,
  useSetPins,
  withPin,
  withPinAt,
  withPinMoved,
  withoutPin,
} from "./bot-pins.ts";
import { type BotRow, useBots } from "./bot-queries.ts";
import { useDeleteBot } from "./delete-bot-dialog.tsx";
import { useClosestInside, useDragSensors } from "./drag-setup.ts";

// `/bots` (bots-page.md, UI-4): the title row with + Create, the search, the Pinned group in the
// owner's order, then the Others with the two sort buttons. A click on a card opens the bot.
export function BotsPage() {
  const bots = useBots();
  const [query, setQuery] = useState("");
  const remove = useDeleteBot();

  if (bots.data === undefined) {
    if (bots.isError) {
      return (
        <LoadError text="The app could not load the bots." onRetry={() => void bots.refetch()} />
      );
    }
    return <BotsSkeleton />;
  }
  const all = bots.data;
  if (all.length === 0) return <EmptyBots />;

  const searching = query.trim() !== "";
  const pinned = pinnedOf(all).filter((bot) => matchesSearch(bot, query));
  const others = othersOf(all).filter((bot) => matchesSearch(bot, query));

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <TitleRow />
      <label className="mt-5 flex h-control w-72 items-center gap-2 rounded-control border border-outline-strong px-2 focus-within:border-primary">
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
      {pinned.length > 0 && (
        <section aria-labelledby="pinned-title" className="mt-6">
          <h2
            id="pinned-title"
            className="text-xs font-semibold tracking-wide text-on-surface-muted uppercase"
          >
            Pinned
          </h2>
          <PinnedGrid
            bots={pinned}
            pinnedIds={pinnedOf(all).map((bot) => bot.id)}
            dragOff={searching}
            onDelete={remove.ask}
          />
        </section>
      )}
      {others.length > 0 && (
        <section aria-labelledby="others-title" className="mt-6">
          <div className="flex items-center gap-2">
            <h2
              id="others-title"
              className="text-xs font-semibold tracking-wide text-on-surface-muted uppercase"
            >
              Others
            </h2>
            <SortButtons />
          </div>
          <ul className="mt-3 grid grid-cols-4 gap-5">
            {others.map((bot) => (
              <li key={bot.id}>
                <OtherCard bot={bot} onDelete={remove.ask} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {pinned.length === 0 && others.length === 0 && (
        <p className="mt-10 text-center text-on-surface-muted">
          No bots match "{query.trim()}". Check the spelling, or clear the search.
        </p>
      )}
      {remove.dialog}
    </div>
  );
}

function TitleRow() {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-title font-semibold">Bots</h1>
        <p className="mt-1 text-on-surface-muted">
          Your teammates. Each bot has a persona, a model and skills.
        </p>
      </div>
      <CreateLink />
    </div>
  );
}

function CreateLink() {
  return (
    <Link to="/bots/new" className={buttonVariants({ kind: "primary" })}>
      <Plus aria-hidden size={16} />
      Create
    </Link>
  );
}

function OtherCard({ bot, onDelete }: { bot: BotRow; onDelete: (bot: BotRow) => void }) {
  const setPins = useSetPins();
  const bots = useBots().data ?? [];
  return (
    <BotGridCard
      bot={bot}
      onPin={() => {
        setPins(
          withPin(
            pinnedOf(bots).map((b) => b.id),
            bot.id,
          ),
        );
      }}
      onDelete={() => {
        onDelete(bot);
      }}
    />
  );
}

// The sortable strategy that moves nothing: the old place stays a gap and a drop line shows where
// the card lands (dashed-slot.md §3), instead of the cards making room.
const stayInPlace: SortingStrategy = () => null;

// The Pinned group: drag inside it, or Alt+← and Alt+→ on a focused card, reorders (pin.md §2).
// Each drop saves at once. Drag is off while a search is on. `bots` are the cards shown, which a
// search can cut; `pinnedIds` is every pinned bot, the list that a change sends.
function PinnedGrid({
  bots,
  pinnedIds,
  dragOff,
  onDelete,
}: {
  bots: BotRow[];
  pinnedIds: readonly string[];
  dragOff: boolean;
  onDelete: (bot: BotRow) => void;
}) {
  const setPins = useSetPins();
  const ids = bots.map((bot) => bot.id);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  // A click right after a drop must not open the bot.
  const justDropped = useRef(false);
  // A drop counts only inside the Pinned group.
  const grid = useRef<HTMLUListElement>(null);
  const sensors = useDragSensors();
  const collision = useClosestInside(grid);
  const nameOf = (id: string | number) => bots.find((bot) => bot.id === id)?.name ?? "";
  const placeOf = (id: string | number) =>
    `${String(ids.indexOf(String(id)) + 1)} of ${String(ids.length)}`;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}, pinned, ${placeOf(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over === null
        ? `${nameOf(active.id)} is outside the pinned bots.`
        : `${nameOf(active.id)} moves to place ${placeOf(over.id)}.`,
    onDragEnd: ({ active, over }) =>
      over === null
        ? `${nameOf(active.id)} did not move.`
        : `${nameOf(active.id)} dropped at place ${placeOf(over.id)}.`,
    onDragCancel: ({ active }) => `Moving ${nameOf(active.id)} is cancelled.`,
  };

  const end = () => {
    setActiveId(null);
    setOverId(null);
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    end();
    justDropped.current = true;
    setTimeout(() => {
      justDropped.current = false;
    }, 0);
    if (over === null || over.id === active.id) return;
    setPins(withPinAt(pinnedIds, String(active.id), pinnedIds.indexOf(String(over.id))));
  };
  const active = bots.find((bot) => bot.id === activeId);
  const activeIndex = activeId === null ? -1 : ids.indexOf(activeId);
  const overIndex = overId === null ? -1 : ids.indexOf(overId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "To move a pinned bot, press Space, use the arrow keys, then press Space to drop it. Esc cancels. Alt and the Left or Right arrow move it one place.",
        },
      }}
      onDragStart={({ active: start }: DragStartEvent) => {
        setActiveId(String(start.id));
      }}
      onDragOver={({ over }: DragOverEvent) => {
        setOverId(over === null ? null : String(over.id));
      }}
      onDragEnd={onDragEnd}
      onDragCancel={end}
    >
      <SortableContext items={ids} strategy={stayInPlace} disabled={dragOff}>
        <ul
          ref={grid}
          className="mt-3 grid grid-cols-4 gap-5"
          onClickCapture={(event) => {
            if (justDropped.current) event.preventDefault();
          }}
        >
          {bots.map((bot, index) => (
            <li key={bot.id} className="relative">
              <PinnedCard
                bot={bot}
                dropLine={
                  overIndex === -1 || overIndex !== index || overIndex === activeIndex
                    ? null
                    : activeIndex < overIndex
                      ? "after"
                      : "before"
                }
                onUnpin={() => {
                  setPins(withoutPin(pinnedIds, bot.id));
                }}
                onMove={(by) => {
                  if (!dragOff) setPins(withPinMoved(pinnedIds, bot.id, by));
                }}
                onDelete={() => {
                  onDelete(bot);
                }}
              />
            </li>
          ))}
        </ul>
      </SortableContext>
      <DragOverlay>
        {active === undefined ? null : (
          <BotGridCard bot={active} overlay onPin={noop} onDelete={noop} />
        )}
      </DragOverlay>
    </DndContext>
  );
}

function noop(): void {
  // The overlay copy has no controls.
}

function PinnedCard({
  bot,
  dropLine,
  onUnpin,
  onMove,
  onDelete,
}: {
  bot: BotRow;
  // A drop line on this card's left or right edge, in the gap beside it.
  dropLine: "before" | "after" | null;
  onUnpin: () => void;
  onMove: (by: -1 | 1) => void;
  onDelete: () => void;
}) {
  const sortable = useSortable({ id: bot.id });
  const onKeyDown = (event: KeyboardEvent<HTMLAnchorElement>) => {
    if (event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      onMove(event.key === "ArrowLeft" ? -1 : 1);
      return;
    }
    sortable.listeners?.onKeyDown?.(event);
  };
  const drag: CardDrag = {
    setNodeRef: sortable.setNodeRef,
    setActivatorNodeRef: sortable.setActivatorNodeRef,
    handleProps: {
      ...sortable.listeners,
      onKeyDown,
      "aria-describedby": sortable.attributes["aria-describedby"],
    },
    isGap: sortable.isDragging,
  };
  return (
    <>
      <BotGridCard bot={bot} onPin={onUnpin} onDelete={onDelete} drag={drag} />
      {dropLine !== null && (
        <span
          aria-hidden
          data-testid="drop-line"
          className={cn(
            "absolute top-2 bottom-2 w-0.5 rounded-pill bg-primary opacity-80",
            dropLine === "before" ? "-left-2.5" : "-right-2.5",
          )}
        />
      )}
    </>
  );
}

// No bots (bots-page.md §8): the sleepy grey slime between two empty seats, and + Create. No
// search and no sort buttons.
function EmptyBots() {
  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-title font-semibold">Bots</h1>
          <p className="mt-1 text-on-surface-muted">
            Your teammates. Each bot has a persona, a model and skills.
          </p>
        </div>
      </div>
      <div className="mt-16 flex flex-col items-center text-center">
        <div aria-hidden className="flex items-end gap-4">
          <span className="size-avatar-list rounded-pill border-dashed-slot border-outline-strong" />
          <SleepySlime px={96} />
          <span className="size-avatar-list rounded-pill border-dashed-slot border-outline-strong" />
        </div>
        <h2 className="mt-6 text-xl font-semibold">It is quiet here</h2>
        <p className="mt-2 max-w-md text-on-surface-muted">
          No bots yet. A bot is a teammate with one role, for example BA or Designer. Make the first
          one, so this slime has company.
        </p>
        <div className="mt-5">
          <CreateLink />
        </div>
      </div>
    </div>
  );
}

function BotsSkeleton() {
  return (
    <SkeletonArea label="Loading bots">
      <div className="mx-auto max-w-6xl px-8 py-8">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="mt-2 h-4 w-80" />
        <Skeleton className="mt-5 h-7 w-72" />
        <div className={cn("mt-8 grid grid-cols-4 gap-5")}>
          {[0, 1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-80" />
          ))}
        </div>
      </div>
    </SkeletonArea>
  );
}
