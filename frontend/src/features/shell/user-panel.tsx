import { Link, useRouterState } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import {
  MenuHeader,
  MenuLinkItem,
  MenuPopup,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from "../../components/ui/menu.tsx";
import { Tooltip } from "../../components/ui/tooltip.tsx";
import { cn } from "../../lib/cn.ts";

// Until the owner sets a display name (user-panel.md §1).
export const OWNER_NAME = "Sir";

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

// The pages of the menu that exist (UI-1.20): an empty placeholder page counts. Memory and
// Trash come with their pages in M5b; the battery comes in M5.
const PAGES = [
  { to: "/bots", label: "Manage bots" },
  { to: "/skills", label: "Manage skills" },
  { to: "/stats", label: "Statistics" },
] as const;

function isUnder(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
}

function Avatar() {
  return (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded-full border border-outline-strong bg-surface-container text-sm font-semibold"
    >
      {OWNER_NAME.charAt(0)}
    </span>
  );
}

// The floating user panel (user-panel.md §1, §2, §4). Collapsed (bar 2 hidden) it shows the
// avatar only, with the tooltip "Sir · Menu", and its menu opens to the right with the name as
// a header (UI-1.21).
export function UserPanel({ collapsed }: { collapsed: boolean }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const onSettings = isUnder(pathname, "/settings");

  const trigger = collapsed ? (
    <MenuTrigger
      aria-label={`${OWNER_NAME} · Menu`}
      className={cn(
        "flex size-tile items-center justify-center rounded-card hover:bg-surface-bubble",
        FOCUS,
      )}
    >
      <Avatar />
    </MenuTrigger>
  ) : (
    <MenuTrigger
      className={cn(
        "flex h-tile min-w-0 grow items-center gap-2.5 rounded-card px-1 hover:bg-surface-bubble",
        FOCUS,
      )}
    >
      <Avatar />
      <span className="truncate font-semibold">{OWNER_NAME}</span>
    </MenuTrigger>
  );

  return (
    <nav
      aria-label="User panel"
      className={cn(
        "absolute bottom-2 left-2 z-10 flex h-panel items-center rounded-card border border-outline-strong bg-surface-raised shadow-xl",
        collapsed ? "w-11 justify-center" : "right-2 gap-1 px-1",
      )}
    >
      <MenuRoot>
        {collapsed ? <Tooltip label={`${OWNER_NAME} · Menu`}>{trigger}</Tooltip> : trigger}
        <MenuPopup
          side={collapsed ? "right" : "top"}
          align={collapsed ? "end" : "start"}
          label={`${OWNER_NAME} menu`}
        >
          {collapsed && <MenuHeader>{OWNER_NAME}</MenuHeader>}
          {PAGES.map((page) => (
            <MenuLinkItem
              key={page.to}
              current={isUnder(pathname, page.to)}
              render={<Link to={page.to} />}
            >
              {page.label}
            </MenuLinkItem>
          ))}
          <MenuSeparator />
          <MenuLinkItem current={onSettings} render={<Link to="/settings" />}>
            Settings
          </MenuLinkItem>
        </MenuPopup>
      </MenuRoot>
      {!collapsed && (
        <Tooltip label="Settings" side="top">
          <Link
            to="/settings"
            aria-label="Settings"
            className={cn(
              "flex size-button shrink-0 items-center justify-center rounded-card hover:bg-surface-bubble",
              onSettings ? "text-primary" : "text-on-surface-muted",
              FOCUS,
            )}
          >
            <Settings aria-hidden size={18} />
          </Link>
        </Tooltip>
      )}
    </nav>
  );
}
