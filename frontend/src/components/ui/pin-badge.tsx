import { Pin, PinOff } from "lucide-react";
import { cn } from "../../lib/cn.ts";
import { Tooltip } from "./tooltip.tsx";

// The pin badge of pin.md §1, in the top-right corner of an item. The item has the `group`
// class. Not pinned: hidden until the item is hovered or focused, then a faded pin, solid
// `primary` with "Pin to top" under the pointer. Pinned: a small muted pin mark at rest, the
// unpin glyph with "Unpin" while the item is hovered. It is a button in every state, so the
// keyboard reaches it.
export function PinBadge({
  pinned,
  name,
  onClick,
  className,
}: {
  pinned: boolean;
  // The item's name, for screen readers: "Pin BA to top".
  name: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Tooltip label={pinned ? "Unpin" : "Pin to top"} side="top">
      <button
        type="button"
        aria-label={pinned ? `Unpin ${name}` : `Pin ${name} to top`}
        aria-pressed={pinned}
        onClick={onClick}
        className={cn(
          "group/pin flex size-6 items-center justify-center rounded-pill outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
          pinned
            ? "text-on-surface-muted hover:bg-primary hover:text-on-primary"
            : "text-on-surface-muted opacity-0 group-focus-within:opacity-60 group-hover:opacity-60 hover:bg-primary hover:text-on-primary hover:opacity-100 focus-visible:opacity-100",
          className,
        )}
      >
        {pinned ? (
          <>
            <Pin aria-hidden size={14} className="group-hover:hidden" />
            <PinOff aria-hidden size={14} className="hidden group-hover:block" />
          </>
        ) : (
          <Pin aria-hidden size={14} />
        )}
      </button>
    </Tooltip>
  );
}
