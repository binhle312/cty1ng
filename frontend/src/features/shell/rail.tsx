import { Link } from "@tanstack/react-router";
import { House, Plus } from "lucide-react";
import { Tooltip } from "../../components/ui/tooltip.tsx";
import { TurnedOff } from "./turned-off.tsx";

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

// The rail (left-bar.md §1) in M0: the Home tile, a divider and the New project tile, which is
// turned off until projects exist in M5b (owner, 2026-10-30).
export function Rail({ onHome }: { onHome: () => void }) {
  return (
    <nav
      aria-label="Projects"
      className="flex w-rail shrink-0 flex-col items-center gap-2 border-r border-outline bg-surface pt-3"
    >
      <div className="relative size-tile">
        <span
          aria-hidden
          className="absolute top-1.5 bottom-1.5 -left-2.5 w-1 rounded-r-control bg-on-surface"
        />
        <Tooltip label="Home">
          <Link
            to="/"
            aria-label="Home"
            aria-current="true"
            onClick={onHome}
            className={`flex size-tile items-center justify-center rounded-card bg-primary-tint text-primary ${FOCUS}`}
          >
            <House aria-hidden size={20} strokeWidth={1.8} />
          </Link>
        </Tooltip>
      </div>
      <div aria-hidden className="h-0.5 w-7 rounded-pill bg-outline" />
      <TurnedOff
        label="New project"
        reason="Projects are not available yet"
        className="flex size-tile items-center justify-center rounded-card border-dashed-slot border-outline-strong text-on-surface-muted"
      >
        <Plus aria-hidden size={18} strokeWidth={2} />
      </TurnedOff>
    </nav>
  );
}
