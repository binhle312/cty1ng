import type { ReactNode } from "react";
import { cn } from "../../lib/cn.ts";
import { Tooltip } from "../../components/ui/tooltip.tsx";

// A control that exists in the agreed design but does not work yet (ui-rules B5): 40%
// opacity, still reachable with Tab, and a tooltip that says why. It does nothing on click.
export function TurnedOff({
  reason,
  label,
  className,
  children,
  side = "right",
}: {
  reason: string;
  label: string;
  className?: string;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <Tooltip label={reason} side={side}>
      <button
        type="button"
        aria-label={label}
        aria-disabled="true"
        aria-description={reason}
        className={cn(
          "cursor-not-allowed opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          className,
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}
