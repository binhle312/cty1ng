import { Menu as BaseMenu } from "@base-ui/react/menu";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../../lib/cn.ts";

// Menus on Base UI: arrow keys move, Enter runs an item, Esc closes and puts the focus back on
// the trigger (left-bar.md §1.2, user-panel.md §2).
export const MenuRoot = BaseMenu.Root;
export const MenuTrigger = BaseMenu.Trigger;

interface MenuPopupProps {
  side: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  children: ReactNode;
  label: string;
}

export function MenuPopup({
  side,
  align = "start",
  sideOffset = 8,
  children,
  label,
}: MenuPopupProps) {
  return (
    <BaseMenu.Portal>
      <BaseMenu.Positioner side={side} align={align} sideOffset={sideOffset}>
        <BaseMenu.Popup
          aria-label={label}
          className="min-w-48 rounded-card border border-outline-strong bg-surface-raised p-1 text-on-surface shadow-xl outline-none"
        >
          {children}
        </BaseMenu.Popup>
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  );
}

const ITEM =
  "relative flex h-control cursor-default items-center gap-2 rounded-control px-2 outline-none select-none data-highlighted:bg-surface-bubble";

// A menu item that opens a page. `current` marks the open page with a `primary` bar. Base UI
// keeps a menu open after a link item by default; ours close, as the other items do.
export function MenuLinkItem({
  current,
  className,
  children,
  ...props
}: ComponentProps<typeof BaseMenu.LinkItem> & { current: boolean }) {
  return (
    <BaseMenu.LinkItem
      closeOnClick
      {...props}
      aria-current={current ? "page" : undefined}
      className={cn(ITEM, className)}
    >
      {current && (
        <span
          aria-hidden
          className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-pill bg-primary"
        />
      )}
      {children}
    </BaseMenu.LinkItem>
  );
}

export function MenuHeader({ children }: { children: ReactNode }) {
  return (
    <div className="px-2 pt-1 pb-1.5 text-xs font-semibold text-on-surface-muted">{children}</div>
  );
}

export function MenuSeparator() {
  return <BaseMenu.Separator className="mx-1 my-1 h-px bg-outline" />;
}
