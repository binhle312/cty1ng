import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import type { ReactElement, ReactNode } from "react";

// Tooltips on Base UI. They show within 300 ms of hover or keyboard focus (UI-2.2).
export const TOOLTIP_DELAY_MS = 250;

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <BaseTooltip.Provider delay={TOOLTIP_DELAY_MS}>{children}</BaseTooltip.Provider>;
}

interface TooltipProps {
  label: string;
  // The element that gets the tooltip. It must take a ref and the trigger props.
  children: ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  // Shows nothing while true. A control whose tooltip comes and goes keeps the wrapper and sets
  // this, so React keeps the same element and the keyboard focus stays on it.
  disabled?: boolean;
}

export function Tooltip({ label, children, side = "right", disabled = false }: TooltipProps) {
  return (
    <BaseTooltip.Root disabled={disabled}>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        {/* z-50, as dialogs and toasts: Base UI sets no z-index, and page parts at z-10 (the
            check box, a History time, the user panel) would show through. */}
        <BaseTooltip.Positioner side={side} sideOffset={8} className="z-50">
          <BaseTooltip.Popup className="rounded-control border border-outline-strong bg-surface-raised px-2 py-1 text-xs font-medium text-on-surface shadow-lg">
            {label}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
