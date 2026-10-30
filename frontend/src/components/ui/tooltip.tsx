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
}

export function Tooltip({ label, children, side = "right" }: TooltipProps) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} sideOffset={8}>
          <BaseTooltip.Popup className="rounded-control border border-outline-strong bg-surface-raised px-2 py-1 text-xs font-medium text-on-surface shadow-lg">
            {label}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
