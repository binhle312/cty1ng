import type { CSSProperties } from "react";
import { cn } from "../../lib/cn.ts";

// The colour band (bot-page.md §5): the bot colour at 33 % fading to 9 %, top to bottom, for every
// style and for an uploaded image. The Bots page cards, the Create preview card and the bot page
// use it. The colour comes from data, so it is a `style` (the CSSOM, which the CSP allows).
export function bandStyle(colour: string): CSSProperties {
  return { backgroundImage: `linear-gradient(${colour}54, ${colour}17)` };
}

export function BotBand({ colour, className }: { colour: string; className?: string }) {
  return (
    <div
      aria-hidden
      data-band={colour}
      className={cn("absolute inset-x-0 top-0", className)}
      style={bandStyle(colour)}
    />
  );
}
