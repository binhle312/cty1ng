import type { ListBotsResponse } from "../../lib/api/generated/types.gen.ts";
import { cn } from "../../lib/cn.ts";
import { SLIME_ART } from "../../themes/bot-palette.ts";

type Bot = ListBotsResponse[number];

// What an avatar needs from a bot. The Create page draws one from its form, so this is not the
// whole bot.
export type AvatarBot = Pick<Bot, "avatar_style" | "avatar_colour" | "avatar_url">;

// The standard sizes (bot-avatar.md §2): the circle and the Flat art box inside it.
export type AvatarSize = "header" | "list" | "large";

const CIRCLE: Record<AvatarSize, string> = {
  header: "size-avatar",
  list: "size-avatar-list",
  large: "size-avatar-large",
};
const ART_PX: Record<AvatarSize, number> = { header: 30, list: 56, large: 90 };
// The badge slot (§3): 16 px at header size, larger with the circle.
const BADGE: Record<AvatarSize, string> = {
  header: "size-4 text-badge",
  list: "size-5 text-xs",
  large: "size-6 text-sm",
};

// The one badge M2 has: a bot that cannot run (bot-status.md, "Cannot run"). The run states
// (queued, running, waiting) come with runs in M3.
export type AvatarBadge = "cannot_run";

// A bot avatar: the slime in the bot colour, or the uploaded image, in a `surface-raised` circle
// (bot-avatar.md). Only Flat is drawn (§1: Jelly and Pixel ship later, and the API refuses them),
// with the Idle face: M2 has no runs. The colour comes from data, so it is an SVG attribute, which
// the CSP allows. The avatar is decoration: the element around it names the bot.
export function BotAvatar({
  bot,
  size = "header",
  badge = null,
  className,
}: {
  bot: AvatarBot;
  size?: AvatarSize;
  badge?: AvatarBadge | null;
  className?: string;
}) {
  const upload = bot.avatar_style === "upload" && bot.avatar_url !== null;
  return (
    <span aria-hidden className={cn("relative inline-flex shrink-0", CIRCLE[size], className)}>
      <span className="flex size-full items-center justify-center overflow-hidden rounded-pill bg-surface-raised">
        {upload ? (
          <img src={bot.avatar_url ?? undefined} alt="" className="size-full object-cover" />
        ) : (
          <FlatSlime colour={bot.avatar_colour} px={ART_PX[size]} />
        )}
      </span>
      {badge === "cannot_run" && (
        <span
          data-badge="cannot-run"
          className={cn(
            "absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-pill bg-danger leading-none font-bold text-on-primary ring-2 ring-surface",
            BADGE[size],
          )}
        >
          !
        </span>
      )}
    </span>
  );
}

// The Flat slime, Idle face (design/assets/avatars/flat-idle.svg): the body at 95 % width, the
// shine, the blush, plain black eyes and a small smile. The face colours are part of the art.
const BODY = "M7 37C7 23 15 11 24 11S41 23 41 37C41 41 37 42 24 42S7 41 7 37Z";

export function FlatSlime({ colour, px }: { colour: string; px: number }) {
  return (
    <svg viewBox="0 0 48 48" width={px} height={px} aria-hidden data-colour={colour}>
      <g transform="matrix(0.95 0 0 1 1.2 0)">
        <path d={BODY} fill={colour} />
        <path
          d="M13.8 20a3.2 2 0 1 0 6.4 0a3.2 2 0 1 0 -6.4 0Z"
          fill={SLIME_ART.shine}
          opacity="0.5"
        />
        <ellipse cx="13.6" cy="33.6" rx="2.5" ry="1.3" fill={SLIME_ART.blush} opacity="0.45" />
        <ellipse cx="34.4" cy="33.6" rx="2.5" ry="1.3" fill={SLIME_ART.blush} opacity="0.45" />
      </g>
      <path
        d="M15.9 29a2.9 3.7 0 1 0 5.8 0a2.9 3.7 0 1 0 -5.8 0ZM26.3 29a2.9 3.7 0 1 0 5.8 0a2.9 3.7 0 1 0 -5.8 0Z"
        fill={SLIME_ART.face}
      />
      <path
        d="M22 34.8Q24 36.8 26 34.8"
        stroke={SLIME_ART.face}
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

// The sleepy grey slime of the Bots page empty state (bots-page.md §8): faded, eyes closed.
export function SleepySlime({ px }: { px: number }) {
  return (
    <svg viewBox="0 0 48 48" width={px} height={px} aria-hidden className="opacity-60">
      <g transform="matrix(0.95 0 0 1 1.2 0)">
        <path d={BODY} className="fill-outline-strong" />
      </g>
      <path
        d="M16 29.5Q18.8 31.5 21.6 29.5M26.4 29.5Q29.2 31.5 32 29.5"
        stroke={SLIME_ART.face}
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M22.4 35.4H25.6"
        stroke={SLIME_ART.face}
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}
