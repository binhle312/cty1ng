import {
  type Announcements,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { SortableContext, type SortingStrategy, useSortable } from "@dnd-kit/sortable";
import { type KeyboardEvent, type ReactNode, type RefObject, useRef, useState } from "react";
import type { CardDrag } from "./bot-grid-card.tsx";
import { useSetPins, withPinAt, withPinMoved } from "./bot-pins.ts";
import type { BotRow } from "./bot-queries.ts";
import { useClosestInside, useDragSensors } from "./drag-setup.ts";

// Reordering the pinned bots (pin.md §2): drag inside the pinned group, or Alt+← and Alt+→ on a
// focused pinned bot. Each drop or move saves at once. Drag and the keys are off while a search
// is on, so the owner never reorders a part of the list. The Bots page grid and the bot page's
// side list share it; each draws its own items and drop line.

// Where the drop line shows on an item: before it or after it.
export type DropLine = "before" | "after";

// The sortable strategy that moves nothing: the old place stays a gap and a drop line shows where
// the item lands (dashed-slot.md §3), instead of the items making room.
const stayInPlace: SortingStrategy = () => null;

const INSTRUCTIONS =
  "To move a pinned bot, press Space, use the arrow keys, then press Space to drop it. Esc cancels. Alt and the Left or Right arrow move it one place.";

// `bots` are the pinned bots shown, which a search can cut; `pinnedIds` is every pinned bot, the
// list that a change sends. `area` is the pinned group: a drop outside it changes nothing.
export function PinnedSort({
  bots,
  pinnedIds,
  dragOff,
  area,
  overlay,
  children,
}: {
  bots: BotRow[];
  pinnedIds: readonly string[];
  dragOff: boolean;
  area: RefObject<HTMLElement | null>;
  // The copy that follows the pointer while a bot moves.
  overlay: (bot: BotRow) => ReactNode;
  children: (place: { dropLine: (index: number) => DropLine | null }) => ReactNode;
}) {
  const setPins = useSetPins();
  const ids = bots.map((bot) => bot.id);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const justDropped = useRef(false);
  const sensors = useDragSensors();
  const collision = useClosestInside(area);
  const nameOf = (id: UniqueIdentifier) => bots.find((bot) => bot.id === id)?.name ?? "";
  const placeOf = (id: UniqueIdentifier) =>
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
  const dropLine = (index: number): DropLine | null =>
    overIndex === -1 || overIndex !== index || overIndex === activeIndex
      ? null
      : activeIndex < overIndex
        ? "after"
        : "before";

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      accessibility={{ announcements, screenReaderInstructions: { draggable: INSTRUCTIONS } }}
      onDragStart={({ active: start }) => {
        setActiveId(String(start.id));
      }}
      onDragOver={({ over }) => {
        setOverId(over === null ? null : String(over.id));
      }}
      onDragEnd={onDragEnd}
      onDragCancel={end}
    >
      <SortableContext items={ids} strategy={stayInPlace} disabled={dragOff}>
        {/* A click right after a drop must not open the bot. */}
        <div
          className="contents"
          onClickCapture={(event) => {
            if (justDropped.current) event.preventDefault();
          }}
        >
          {children({ dropLine })}
        </div>
      </SortableContext>
      <DragOverlay>{active === undefined ? null : overlay(active)}</DragOverlay>
    </DndContext>
  );
}

// One pinned bot inside `PinnedSort`: its drag handle, and Alt+← and Alt+→ that move it one place.
export function usePinnedItem({
  botId,
  pinnedIds,
  dragOff,
}: {
  botId: string;
  pinnedIds: readonly string[];
  dragOff: boolean;
}): CardDrag {
  const setPins = useSetPins();
  const sortable = useSortable({ id: botId });
  const onKeyDown = (event: KeyboardEvent<HTMLAnchorElement>) => {
    if (event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      if (!dragOff) setPins(withPinMoved(pinnedIds, botId, event.key === "ArrowLeft" ? -1 : 1));
      return;
    }
    sortable.listeners?.onKeyDown?.(event);
  };
  return {
    setNodeRef: sortable.setNodeRef,
    setActivatorNodeRef: sortable.setActivatorNodeRef,
    handleProps: {
      ...sortable.listeners,
      onKeyDown,
      "aria-describedby": sortable.attributes["aria-describedby"],
    },
    isGap: sortable.isDragging,
  };
}
