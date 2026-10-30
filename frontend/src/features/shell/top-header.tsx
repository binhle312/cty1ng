import { Link, useRouterState } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { cn } from "../../lib/cn.ts";

// The top header (top-header.md) in M0: no bots exist, so the roster zone shows only the add
// slot (state 11), which opens the Create bot page. The pin pill comes when a bot exists
// (M0c plan, decision D). The roster uses the middle 6 of 12 columns (§1).
export function TopHeader() {
  const onCreate = useRouterState({ select: (state) => state.location.pathname === "/bots/new" });
  return (
    <header
      aria-label="Bots"
      className="grid h-header shrink-0 grid-cols-12 items-center border-b border-outline bg-surface"
    >
      <div className="col-span-6 col-start-4 flex justify-center">
        <Link
          to="/bots/new"
          className="group flex items-center gap-2.5 rounded-pill pr-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span
            aria-hidden
            className={cn(
              "flex size-avatar items-center justify-center rounded-full border-dashed-slot transition-colors duration-120",
              onCreate
                ? "border-primary bg-primary-tint text-primary"
                : "border-outline-strong text-on-surface-muted group-hover:text-on-surface",
            )}
          >
            <Plus size={18} />
          </span>
          <span className={onCreate ? "text-primary" : "text-on-surface-muted"}>
            Hey, add your bot here 👋
          </span>
        </Link>
      </div>
    </header>
  );
}
