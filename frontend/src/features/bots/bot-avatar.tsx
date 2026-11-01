import type { CSSProperties } from "react";
import type { ListBotsResponse } from "../../lib/api/generated/types.gen.ts";
import { cn } from "../../lib/cn.ts";

type Bot = ListBotsResponse[number];

// What an avatar needs from a bot.
export type AvatarBot = Pick<Bot, "name" | "avatar_style" | "avatar_colour" | "avatar_url">;

// Text on a bot colour is black or white, whichever has the higher contrast, because a custom
// colour can be light or dark (bot-avatar.md §5). WCAG relative luminance of `#RRGGBB`.
export function readableOn(colour: string): "black" | "white" {
  const channel = (start: number) => {
    const value = Number.parseInt(colour.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  // Black beats white when the luminance is above about 0.179 (the point where both contrast
  // ratios are equal).
  return luminance > 0.179 ? "black" : "white";
}

// The first letter of the name, whole even when it is outside the Basic Multilingual Plane.
function initialOf(name: string): string {
  const code = name.codePointAt(0);
  return code === undefined ? "" : String.fromCodePoint(code).toUpperCase();
}

// The smallest avatar the Skills page needs (M2a): the 36 px circle of the lists
// (bot-avatar.md §2). Flat is the bot colour with the first letter of the name; an uploaded image
// is shown as it is. Jelly and Pixel are drawn like Flat until the full component (M2b) draws
// them. The colour comes from data, so it is set with `style` (the CSSOM, which the CSP allows).
export function BotAvatar({ bot, className }: { bot: AvatarBot; className?: string }) {
  const circle = cn(
    "flex size-avatar shrink-0 items-center justify-center overflow-hidden rounded-pill bg-surface-raised",
    className,
  );
  if (bot.avatar_style === "upload" && bot.avatar_url !== null) {
    return (
      <span className={circle}>
        <img src={bot.avatar_url} alt="" className="size-full object-cover" />
      </span>
    );
  }
  const style: CSSProperties = {
    backgroundColor: bot.avatar_colour,
    color: readableOn(bot.avatar_colour),
  };
  return (
    <span aria-hidden className={cn(circle, "text-base font-semibold")} style={style}>
      {initialOf(bot.name)}
    </span>
  );
}
