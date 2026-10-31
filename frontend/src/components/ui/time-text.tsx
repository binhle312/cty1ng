import { formatFullTime, formatTime } from "../../lib/time-format.ts";
import { cn } from "../../lib/cn.ts";
import { Tooltip } from "./tooltip.tsx";

// A time on a page ("5 min ago", "2026-10-21 14:05") with the full time and UTC offset in a
// tooltip (time-format.md §1). The time takes keyboard focus, so the tooltip also opens from
// the keyboard (UI-2.2). Do not put it inside a button or a label: one control in another is
// not allowed.
export function TimeText({ iso, className }: { iso: string; className?: string }) {
  return (
    <Tooltip label={formatFullTime(iso)} side="top">
      <time
        dateTime={iso}
        tabIndex={0}
        className={cn(
          "rounded-xs focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary",
          className,
        )}
      >
        {formatTime(iso, new Date())}
      </time>
    </Tooltip>
  );
}
