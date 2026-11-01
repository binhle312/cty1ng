import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  type SortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { Popover as BasePopover } from "@base-ui/react/popover";
import { useRouterState } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Pin } from "lucide-react";
import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Tooltip } from "../../components/ui/tooltip.tsx";
import { cn } from "../../lib/cn.ts";
import { BotAvatar } from "../bots/bot-avatar.tsx";
import { unavailableText } from "../bots/bot-lines.ts";
import {
  othersOf,
  pinnedOf,
  useSetPins,
  withPin,
  withPinAt,
  withPinMoved,
  withoutPin,
} from "../bots/bot-pins.ts";
import type { BotRow } from "../bots/bot-queries.ts";
import { HeaderBotCard } from "./header-bot-card.tsx";
import { arrangeFrozen, headerDrop, OTHERS_ZONE, PINNED_ZONE } from "./header-order.ts";

// The others' order freezes while the owner engages with the header (UI-2.9): the pointer or the
// focus enters it, or its bot card is open. It applies in one step at the next click or key press
// outside the header, when the focus leaves the window, or when the page changes. Parts of the
// header that live in a portal (the bot card) carry `data-header-part`.
function useDeferredOrder(currentOthers: readonly string[]) {
  const [frozen, setFrozen] = useState<readonly string[] | null>(null);
  const engaged = useRef(false);
  const latest = useRef(currentOthers);
  useEffect(() => {
    latest.current = currentOthers;
  });
  const freeze = useCallback(() => {
    engaged.current = true;
    setFrozen((f) => f ?? latest.current);
  }, []);
  const thaw = useCallback(() => {
    engaged.current = false;
    setFrozen(null);
  }, []);
  // The owner's own pin, unpin or drag applies at once: the freeze takes the new order.
  const refreeze = useCallback(() => {
    setFrozen(null);
    requestAnimationFrame(() => {
      if (engaged.current) setFrozen(latest.current);
    });
  }, []);
  useEffect(() => {
    const outside = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-header-part]") !== null) return;
      if (engaged.current) thaw();
    };
    const onBlur = () => {
      if (engaged.current) thaw();
    };
    // A click or key press outside, focus that moves out of the header (Tab into the page), or
    // focus that leaves the window.
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", outside, true);
    document.addEventListener("focusin", outside, true);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", outside, true);
      document.removeEventListener("focusin", outside, true);
      window.removeEventListener("blur", onBlur);
    };
  }, [thaw]);
  // A new page applies the order (UI-2.9).
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setFrozen(null);
  }
  return { order: arrangeFrozen(frozen, currentOthers), freeze, thaw, refreeze };
}

// The scroll of the roster zone (states 2 and 3): fades on a side with more bots, and ‹ › while
// the pointer or the focus is in the header.
function useRosterScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ left: false, right: false });
  const measure = useCallback(() => {
    const el = ref.current;
    if (el === null) return;
    setMore({
      left: el.scrollLeft > 1,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (el === null) return undefined;
    measure();
    // Old browsers and the test DOM have no ResizeObserver: the fades then follow the scroll only.
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    const inner = el.firstElementChild;
    if (inner !== null) observer.observe(inner);
    return () => {
      observer.disconnect();
    };
  }, [measure]);
  const page = useCallback((side: "left" | "right") => {
    const el = ref.current;
    if (el === null) return;
    el.scrollBy({ left: side === "left" ? -el.clientWidth : el.clientWidth, behavior: "smooth" });
  }, []);
  return { ref, more, measure, page };
}

// A drag moves nothing until the drop: the old place is a gap and a drop line shows where the
// avatar lands (dashed-slot.md §3).
const stayInPlace: SortingStrategy = () => null;

// The roster with pins, drag and the bot card. It is its own chunk (top-header.tsx): @dnd-kit
// stays out of the first load (frontend-conventions.md §4).
export function Roster({ bots }: { bots: readonly BotRow[] }) {
  const setPins = useSetPins();
  const pinned = pinnedOf(bots);
  const pinnedIds = pinned.map((bot) => bot.id);
  const deferred = useDeferredOrder(othersOf(bots).map((bot) => bot.id));
  const byId = new Map(bots.map((bot) => [bot.id, bot]));
  const others = deferred.order.flatMap((id) => {
    const bot = byId.get(id);
    return bot === undefined ? [] : [bot];
  });
  const { ref: scrollRef, more, measure, page } = useRosterScroll();
  const [hover, setHover] = useState(false);
  const [focusIn, setFocusIn] = useState(false);
  const [cardFor, setCardFor] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const save = (ids: readonly string[]) => {
    setPins(ids);
    deferred.refreeze();
  };
  const togglePin = (bot: BotRow) => {
    save(bot.pinned_position === null ? withPin(pinnedIds, bot.id) : withoutPin(pinnedIds, bot.id));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    // A long press starts a drag; a short tap opens the bot card; a swipe scrolls (HD6).
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      // Enter opens the bot card, so only Space picks an avatar up and drops it.
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );
  const nameOf = (id: string | number) => byId.get(String(id))?.name ?? "";
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}.`,
    onDragOver: ({ active, over }) => {
      if (over === null) return `${nameOf(active.id)} is outside the header.`;
      const drop = headerDrop({
        active: String(active.id),
        over: String(over.id),
        pinned: pinnedIds,
        others: deferred.order,
      });
      return drop.kind === "unpin"
        ? `Drop to unpin ${nameOf(active.id)}.`
        : drop.kind === "none"
          ? `${nameOf(active.id)} does not move here.`
          : `Drop to pin ${nameOf(active.id)} here.`;
    },
    onDragEnd: ({ active }) => `${nameOf(active.id)} dropped.`,
    onDragCancel: ({ active }) => `Moving ${nameOf(active.id)} is cancelled.`,
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    setOverId(null);
    const drop = headerDrop({
      active: String(active.id),
      over: over === null ? null : String(over.id),
      pinned: pinnedIds,
      others: deferred.order,
    });
    switch (drop.kind) {
      case "pin_at":
        save(withPinAt(pinnedIds, String(active.id), drop.index));
        break;
      case "pin_end":
        save(withPin(pinnedIds, String(active.id)));
        break;
      case "unpin":
        save(withoutPin(pinnedIds, String(active.id)));
        break;
      case "none":
        break;
      default: {
        const _exhaustive: never = drop;
        return _exhaustive;
      }
    }
  };

  const drop =
    activeId === null
      ? null
      : headerDrop({ active: activeId, over: overId, pinned: pinnedIds, others: deferred.order });
  // Where the drop line shows: before or after a pinned avatar.
  const lineAt = (id: string): "before" | "after" | null => {
    if (drop?.kind !== "pin_at" || overId !== id || activeId === null) return null;
    const from = pinnedIds.indexOf(activeId);
    return from !== -1 && from < drop.index ? "after" : "before";
  };
  const pinnedZoneActive =
    drop !== null &&
    (drop.kind === "pin_end" || (drop.kind === "pin_at" && !pinnedIds.includes(activeId ?? "")));
  const active = activeId === null ? undefined : byId.get(activeId);
  const showArrows = hover || focusIn;
  const fade: CSSProperties | undefined =
    more.left || more.right
      ? {
          maskImage: `linear-gradient(to right, ${more.left ? "transparent" : "black"} 0, black 30px, black calc(100% - 30px), ${more.right ? "transparent" : "black"} 100%)`,
        }
      : undefined;

  const avatarProps = (bot: BotRow, place: { pinned: boolean; index: number }) => ({
    bot,
    label: avatarLabel(bot, place.pinned ? { index: place.index, count: pinned.length } : null),
    tooltip: tooltipOf(bot, place.pinned),
    cardOpen: cardFor === bot.id,
    onCard: (open: boolean) => {
      setCardFor(open ? bot.id : null);
      if (open) deferred.freeze();
    },
    onPin: () => {
      togglePin(bot);
    },
    onFocus: (el: HTMLElement) => {
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
    },
  });

  return (
    <div
      className="relative flex w-full min-w-0 justify-center"
      onPointerEnter={() => {
        setHover(true);
        deferred.freeze();
      }}
      onPointerLeave={() => {
        setHover(false);
      }}
      onFocus={() => {
        setFocusIn(true);
        deferred.freeze();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocusIn(false);
      }}
    >
      {showArrows && more.left && (
        <ScrollButton
          side="left"
          onClick={() => {
            page("left");
          }}
        />
      )}
      <div
        ref={scrollRef}
        data-testid="roster"
        onScroll={measure}
        onWheel={(event) => {
          // The wheel scrolls sideways (state 3).
          if (event.deltaX === 0 && event.deltaY !== 0)
            event.currentTarget.scrollLeft += event.deltaY;
        }}
        className="no-scrollbar min-w-0 touch-pan-x overflow-x-auto"
        style={fade}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          autoScroll={false}
          accessibility={{
            announcements,
            screenReaderInstructions: {
              draggable:
                "To pin, unpin or move a bot, press Space, use the arrow keys, then press Space to drop it. Esc cancels. Alt and the Left or Right arrow move a pinned bot one place.",
            },
          }}
          onDragStart={({ active: start }) => {
            setActiveId(String(start.id));
            setCardFor(null);
            deferred.freeze();
          }}
          onDragOver={({ over }) => {
            setOverId(over === null ? null : String(over.id));
          }}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            setActiveId(null);
            setOverId(null);
          }}
        >
          <div className="mx-auto flex w-max items-center gap-2 px-1 py-2">
            <PinnedZone active={pinnedZoneActive} empty={pinned.length === 0}>
              <SortableContext items={pinnedIds} strategy={stayInPlace}>
                {pinned.map((bot, index) => (
                  <RosterAvatar
                    key={bot.id}
                    {...avatarProps(bot, { pinned: true, index })}
                    dropLine={lineAt(bot.id)}
                    onMove={(by) => {
                      save(withPinMoved(pinnedIds, bot.id, by));
                    }}
                  />
                ))}
              </SortableContext>
            </PinnedZone>
            <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-outline-strong" />
            <OthersZone>
              <SortableContext items={deferred.order} strategy={stayInPlace}>
                {others.map((bot, index) => (
                  <RosterAvatar
                    key={bot.id}
                    {...avatarProps(bot, { pinned: false, index })}
                    dropLine={null}
                    // Alt+← and Alt+→ move pinned bots only.
                    onMove={null}
                  />
                ))}
              </SortableContext>
            </OthersZone>
          </div>
          <DragOverlay>
            {active === undefined ? null : (
              <span className="flex flex-col items-center gap-1">
                <BotAvatar bot={active} className="shadow-xl" />
                {drop?.kind === "unpin" && (
                  <span className="rounded-control border border-outline-strong bg-surface-raised px-1.5 text-xs">
                    Unpin
                  </span>
                )}
              </span>
            )}
          </DragOverlay>
        </DndContext>
      </div>
      {showArrows && more.right && (
        <ScrollButton
          side="right"
          onClick={() => {
            page("right");
          }}
        />
      )}
    </div>
  );
}

function avatarLabel(bot: BotRow, pinned: { index: number; count: number } | null): string {
  const parts = [bot.name];
  if (pinned !== null) parts.push(`pinned, ${String(pinned.index + 1)} of ${String(pinned.count)}`);
  if (!bot.available && bot.unavailable_reason !== null) {
    parts.push(`cannot run: ${unavailableText(bot.unavailable_reason)}`);
  }
  return parts.join(", ");
}

// "BA · pinned · Idle", and the reason when the bot cannot run (H1, UI-2.3).
function tooltipOf(bot: BotRow, pinned: boolean): string {
  const parts = [bot.name];
  if (pinned) parts.push("pinned");
  parts.push(
    !bot.available && bot.unavailable_reason !== null
      ? unavailableText(bot.unavailable_reason)
      : "Idle",
  );
  return parts.join(" · ");
}

// HD1: the pinned bots, or, with none, the dashed pill "Drag a bot here to pin it". While a bot
// is dragged over it, it is an active dashed slot.
function PinnedZone({
  active,
  empty,
  children,
}: {
  active: boolean;
  empty: boolean;
  children: ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: PINNED_ZONE });
  if (empty) {
    return (
      <span
        ref={setNodeRef}
        data-testid="pin-zone"
        className={cn(
          "flex h-avatar shrink-0 items-center gap-1.5 rounded-pill border-dashed-slot px-3 transition-colors duration-120",
          active
            ? "border-primary bg-primary-tint text-primary"
            : "border-outline-strong text-on-surface-muted",
        )}
      >
        <Pin aria-hidden size={13} />
        Drag a bot here to pin it
        {children}
      </span>
    );
  }
  return (
    <span
      ref={setNodeRef}
      data-testid="pin-zone"
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-pill transition-colors duration-120",
        active && "border-dashed-slot border-primary bg-primary-tint px-1",
      )}
    >
      {children}
    </span>
  );
}

function OthersZone({ children }: { children: ReactNode }) {
  const { setNodeRef } = useDroppable({ id: OTHERS_ZONE });
  return (
    <span ref={setNodeRef} className="flex shrink-0 items-center gap-2">
      {children}
    </span>
  );
}

function RosterAvatar({
  bot,
  label,
  tooltip,
  cardOpen,
  onCard,
  onPin,
  onFocus,
  dropLine,
  onMove,
}: {
  bot: BotRow;
  label: string;
  tooltip: string;
  cardOpen: boolean;
  onCard: (open: boolean) => void;
  onPin: () => void;
  onFocus: (el: HTMLElement) => void;
  dropLine: "before" | "after" | null;
  // Alt+← and Alt+→ on a pinned avatar; null for the others.
  onMove: ((by: -1 | 1) => void) | null;
}) {
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, isDragging } = useSortable({
    id: bot.id,
  });
  const cannotRun = !bot.available;
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      onMove?.(event.key === "ArrowLeft" ? -1 : 1);
      return;
    }
    listeners?.onKeyDown?.(event);
  };
  return (
    <span
      ref={setNodeRef}
      data-testid="header-bot"
      data-bot={bot.slug}
      className={cn(
        "relative flex shrink-0 rounded-pill",
        isDragging && "border-dashed-slot border-outline [&>*]:invisible",
      )}
    >
      <BasePopover.Root
        open={cardOpen}
        onOpenChange={(open) => {
          onCard(open);
        }}
      >
        <Tooltip label={tooltip} side="bottom" disabled={cardOpen}>
          <BasePopover.Trigger
            ref={setActivatorNodeRef}
            aria-label={label}
            aria-describedby={attributes["aria-describedby"]}
            {...listeners}
            onKeyDown={onKeyDown}
            onFocus={(event) => {
              onFocus(event.currentTarget);
            }}
            className={cn(
              "flex rounded-pill outline-none hover:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              onMove !== null && "cursor-grab active:cursor-grabbing",
            )}
          >
            <BotAvatar bot={bot} badge={cannotRun ? "cannot_run" : null} />
          </BasePopover.Trigger>
        </Tooltip>
        <BasePopover.Portal>
          <BasePopover.Positioner side="bottom" sideOffset={10} className="z-50">
            <BasePopover.Popup
              aria-label={bot.name}
              data-header-part
              className="rounded-card border border-outline-strong bg-surface-raised p-3 text-on-surface shadow-2xl outline-none"
            >
              <HeaderBotCard bot={bot} onPin={onPin} />
            </BasePopover.Popup>
          </BasePopover.Positioner>
        </BasePopover.Portal>
      </BasePopover.Root>
      {dropLine !== null && (
        <span
          aria-hidden
          data-testid="drop-line"
          className={cn(
            "absolute top-0 bottom-0 w-0.5 rounded-pill bg-primary opacity-80",
            dropLine === "before" ? "-left-1.5" : "-right-1.5",
          )}
        />
      )}
    </span>
  );
}

function ScrollButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={side === "left" ? "Scroll bots left" : "Scroll bots right"}
      onClick={onClick}
      className={cn(
        "absolute top-1/2 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-pill border border-outline-strong bg-surface-raised text-on-surface-muted hover:text-on-surface",
        side === "left" ? "-left-9" : "-right-9",
      )}
    >
      <Icon aria-hidden size={16} />
    </button>
  );
}
