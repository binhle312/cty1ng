import type { ReactNode } from "react";
import { Checkbox } from "../../components/ui/checkbox.tsx";
import { cn } from "../../lib/cn.ts";
import { BotAvatar } from "./bot-avatar.tsx";
import type { BotRow } from "./bot-queries.ts";

// A row of a bot list: the bot and what shows at the right (for example the version pill).
export interface BotListRow {
  bot: BotRow;
  detail?: ReactNode;
}

// The bot list of the cards (skills-page.md §7): one row for each bot with a check box, the avatar
// and the name. A ticked row has a `primary` border, and a click on the row ticks or clears the
// box (buttons.md §5).
export function BotPickList({
  rows,
  ticked,
  onToggle,
  label,
}: {
  rows: BotListRow[];
  ticked: ReadonlySet<string>;
  onToggle: (botId: string) => void;
  label: string;
}) {
  return (
    <ul aria-label={label} className="mt-3 flex max-h-64 flex-col gap-1.5 overflow-y-auto">
      {rows.map(({ bot, detail }) => {
        const on = ticked.has(bot.id);
        return (
          <li key={bot.id}>
            <Checkbox
              checked={on}
              onChange={() => {
                onToggle(bot.id);
              }}
              className={cn(
                "rounded-card border px-3 py-2",
                on ? "border-primary bg-primary-tint" : "border-outline",
              )}
            >
              <BotAvatar bot={bot} />
              <span className="min-w-0 grow truncate font-semibold">{bot.name}</span>
              {detail}
            </Checkbox>
          </li>
        );
      })}
    </ul>
  );
}

// The same list with no check boxes: the bots that a Delete removes the skill from (§11).
export function BotNameList({ rows, label }: { rows: BotListRow[]; label: string }) {
  return (
    <ul aria-label={label} className="mt-3 flex max-h-64 flex-col gap-1.5 overflow-y-auto">
      {rows.map(({ bot, detail }) => (
        <li
          key={bot.id}
          className="flex items-center gap-2 rounded-card border border-outline px-3 py-2"
        >
          <BotAvatar bot={bot} />
          <span className="min-w-0 grow truncate font-semibold">{bot.name}</span>
          {detail}
        </li>
      ))}
    </ul>
  );
}
