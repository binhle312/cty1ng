import { Ellipsis, House, MessagesSquare, Plus } from "lucide-react";
import { MenuPopup, MenuRoot, MenuTrigger } from "../../components/ui/menu.tsx";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { VARIANTS } from "../../themes/variants.ts";
import { TurnedOff } from "./turned-off.tsx";

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const NO_CONVERSATIONS = "Conversations are not available yet";

// Bar 2 on Home, first run (left-bar.md §3) in M0: no bots, no conversations. The
// conversation controls are turned off until M3; the project hint waits for projects (M5b);
// the Memory and Library rows come with their slices (M5b, M6). M0c plan, decision C.
export function BarTwo({ onHide }: { onHide: () => void }) {
  return (
    <section
      aria-label="Home Sweet Home"
      className="flex w-bar-two shrink-0 flex-col border-r border-outline bg-surface-container"
    >
      <div className="flex items-center gap-2.5 border-b border-outline py-3 pr-3 pl-3.5">
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-card bg-primary-tint text-primary"
        >
          <House size={16} strokeWidth={1.8} />
        </span>
        <span className="flex min-w-0 grow flex-col">
          <span className="truncate text-lg font-semibold">Home Sweet Home</span>
          <span className="text-xs text-on-surface-muted">No bots yet</span>
        </span>
        <MenuRoot>
          <MenuTrigger
            aria-label="Home menu"
            className={`flex size-6 items-center justify-center rounded-control text-on-surface-muted hover:bg-surface-raised ${FOCUS}`}
          >
            <Ellipsis aria-hidden size={16} />
          </MenuTrigger>
          <MenuPopup side="bottom" align="end" sideOffset={4} label="Home menu">
            <BaseMenu.Item
              onClick={onHide}
              className="flex h-control cursor-default items-center gap-2 rounded-control px-2 outline-none select-none data-highlighted:bg-surface-bubble"
            >
              <span className="grow">Hide bar</span>
              {VARIANTS.command.keyboardHints && (
                <kbd className="font-mono text-xs text-on-surface-muted">Ctrl+B</kbd>
              )}
            </BaseMenu.Item>
          </MenuPopup>
        </MenuRoot>
      </div>

      <div className="flex items-center gap-2 py-2 pr-2 pl-4">
        <MessagesSquare aria-hidden size={16} className="text-on-surface-muted" />
        <h2 className="grow text-sm font-semibold text-on-surface-muted">Conversations</h2>
        <TurnedOff
          label="New conversation"
          reason={NO_CONVERSATIONS}
          className="flex size-6 items-center justify-center rounded-control text-on-surface-muted"
        >
          <Plus aria-hidden size={16} />
        </TurnedOff>
      </div>

      <div className="px-2.5 pt-1">
        <TurnedOff
          label="Hey, let's talk 👋"
          reason={NO_CONVERSATIONS}
          className="flex h-button w-full items-center justify-center gap-2 rounded-card border-dashed-slot border-outline-strong font-medium text-on-surface-muted"
        >
          <Plus aria-hidden size={16} />
          <span>Hey, let&apos;s talk 👋</span>
        </TurnedOff>
      </div>
    </section>
  );
}
