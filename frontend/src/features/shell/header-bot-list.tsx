import { Popover as BasePopover } from "@base-ui/react/popover";
import { Pin, Search } from "lucide-react";
import { type KeyboardEvent, useRef, useState } from "react";
import { Tooltip } from "../../components/ui/tooltip.tsx";
import { BotAvatar } from "../bots/bot-avatar.tsx";
import { matchesSearch, unavailableText } from "../bots/bot-lines.ts";
import type { BotRow } from "../bots/bot-queries.ts";

// The "+N" chip and the list of every bot (top-header.md §4, UI-2.12). N is the number of bots
// not fully in view. A pick closes the list; the roster then scrolls to the avatar and opens its
// bot card. The popup is part of the header for deferred reordering (A7): `data-header-part`.
export function AllBotsChip({
  pinned,
  others,
  hidden,
  onOpen,
  onPick,
}: {
  pinned: readonly BotRow[];
  others: readonly BotRow[];
  hidden: number;
  onOpen: () => void;
  onPick: (bot: BotRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  // After a pick the focus goes to the bot card, not back to the chip.
  const picked = useRef(false);
  const total = pinned.length + others.length;
  const pinnedRows = pinned.filter((bot) => matchesSearch(bot, text));
  const otherRows = others.filter((bot) => matchesSearch(bot, text));
  const first = pinnedRows[0] ?? otherRows[0];

  const pick = (bot: BotRow) => {
    picked.current = true;
    setOpen(false);
    onPick(bot);
  };
  const rows = () => Array.from(list.current?.querySelectorAll("button") ?? []);
  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      rows()[0]?.focus();
    } else if (event.key === "Enter" && first !== undefined) {
      event.preventDefault();
      pick(first);
    }
  };
  const onRowKey = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const all = rows();
    const at = all.findIndex((row) => row === document.activeElement);
    const next = at + (event.key === "ArrowDown" ? 1 : -1);
    if (next < 0) search.current?.focus();
    else all[Math.min(next, all.length - 1)]?.focus();
  };
  const row = (bot: BotRow) => (
    <li key={bot.id}>
      <button
        type="button"
        data-testid="all-bots-row"
        data-bot={bot.slug}
        onClick={() => {
          pick(bot);
        }}
        className="flex w-full items-center gap-2.5 rounded-control px-2 py-1 text-left outline-none hover:bg-surface-bubble focus-visible:bg-surface-bubble focus-visible:outline-2 focus-visible:outline-primary"
      >
        <BotAvatar bot={bot} badge={bot.available ? null : "cannot_run"} />
        <span className="min-w-0 grow truncate">{bot.name}</span>
        {bot.pinned_position !== null && (
          <>
            <Pin aria-hidden size={13} className="shrink-0 text-on-surface-muted" />
            <span className="sr-only">, pinned</span>
          </>
        )}
        {bot.available || bot.unavailable_reason === null ? (
          <span className="shrink-0 text-sm text-on-surface-muted">Idle</span>
        ) : (
          <span className="shrink-0 text-sm text-danger">
            {unavailableText(bot.unavailable_reason)}
          </span>
        )}
      </button>
    </li>
  );

  return (
    <BasePopover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          picked.current = false;
          setText("");
          onOpen();
        }
      }}
    >
      <Tooltip label="All bots" side="bottom" disabled={open}>
        <BasePopover.Trigger
          aria-label={`All ${String(total)} bots, ${String(hidden)} not in view`}
          data-testid="all-bots"
          className="absolute top-1/2 left-full z-10 ml-11 flex h-7 -translate-y-1/2 items-center rounded-pill border border-outline-strong bg-surface-raised px-2.5 text-sm font-medium text-on-surface outline-none hover:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          +{hidden}
        </BasePopover.Trigger>
      </Tooltip>
      <BasePopover.Portal>
        <BasePopover.Positioner side="bottom" align="end" sideOffset={10} className="z-50">
          <BasePopover.Popup
            aria-label="All bots"
            data-header-part
            initialFocus={search}
            finalFocus={() => !picked.current}
            className="flex w-65 flex-col gap-2 rounded-card border border-outline-strong bg-surface-raised p-2 text-on-surface shadow-2xl outline-none"
          >
            <label className="flex items-center gap-2 rounded-control border border-outline-strong px-2 py-1.5 focus-within:outline-2 focus-within:outline-primary">
              <Search aria-hidden size={14} className="shrink-0 text-on-surface-muted" />
              <input
                ref={search}
                type="search"
                aria-label="Find a bot"
                placeholder="Find a bot"
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                }}
                onKeyDown={onSearchKey}
                className="min-w-0 grow bg-transparent outline-none placeholder:text-on-surface-muted"
              />
            </label>
            {first === undefined ? (
              <p className="px-2 py-1 text-sm text-on-surface-muted">
                No bots match "{text.trim()}".
              </p>
            ) : (
              <ul
                ref={list}
                aria-label="Bots"
                onKeyDown={onRowKey}
                className="flex max-h-80 flex-col gap-0.5 overflow-y-auto"
              >
                {pinnedRows.map(row)}
                {pinnedRows.length > 0 && otherRows.length > 0 && (
                  <li aria-hidden className="mx-2 my-1 h-px bg-outline-strong" />
                )}
                {otherRows.map(row)}
              </ul>
            )}
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
}
