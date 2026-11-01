import { ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn.ts";
import { Tooltip } from "./tooltip.tsx";

// A sort button (time-format.md §2): an icon for the sort, then the one sort icon of the app,
// an arrow beside three bars. The arrow points down for newest first. The sort that is on has a
// `primary` tint and a solid arrow; one that is off has a faded arrow. A click on a sort that is
// off turns it on; a click on the sort that is on flips the direction.
export function SortButton({
  icon,
  on,
  direction,
  tooltip,
  label,
  onClick,
}: {
  icon: ReactNode;
  on: boolean;
  direction: "desc" | "asc";
  tooltip: string;
  // The accessible name: the sort and its state.
  label: string;
  onClick: () => void;
}) {
  const Arrow = direction === "desc" || !on ? ArrowDownWideNarrow : ArrowUpNarrowWide;
  return (
    <Tooltip label={tooltip} side="top">
      <button
        type="button"
        aria-label={label}
        aria-pressed={on}
        onClick={onClick}
        className={cn(
          "flex h-6 items-center gap-0.5 rounded-control px-1 outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
          on
            ? "bg-primary-tint text-primary"
            : "text-on-surface-muted hover:bg-surface-raised hover:text-on-surface",
        )}
      >
        {icon}
        <Arrow aria-hidden size={14} className={on ? undefined : "opacity-50"} />
      </button>
    </Tooltip>
  );
}
