import { Popover as BasePopover } from "@base-ui/react/popover";
import type { ReactElement, ReactNode } from "react";
import { cn } from "../../lib/cn.ts";

// A popover card on Base UI (the Custom colour card, bot-avatar.md §5): it opens under its
// trigger, keeps the focus inside, and Esc or a click outside closes it. Base UI's Popover adds
// no `<style>` element, so it works under the CSP (M2 plan, P7).
export function Popover({
  open,
  onOpenChange,
  trigger,
  label,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // The element that opens it. It must take a ref and the trigger props.
  trigger: ReactElement;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <BasePopover.Root open={open} onOpenChange={onOpenChange}>
      <BasePopover.Trigger render={trigger} />
      <BasePopover.Portal>
        {/* z-50, as menus and dialogs (frontend-conventions.md §5, layers). */}
        <BasePopover.Positioner side="bottom" align="start" sideOffset={8} className="z-50">
          <BasePopover.Popup
            aria-label={label}
            className={cn(
              "rounded-card border border-outline-strong bg-surface-raised p-4 text-on-surface shadow-2xl outline-none",
              className,
            )}
          >
            {children}
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
}
