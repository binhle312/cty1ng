import type { ReactNode } from "react";
import { cn } from "../../lib/cn.ts";

// The small pills of the Skills page: the version ("v3"), "Deprecated", "not saved" and the
// import groups (New, Changed, Unchanged, Invalid, Conflict). Text in a badge is 11 px at weight
// 600 (ui-rules L1, L2).
const TONE = {
  neutral: "border-outline-strong text-on-surface-muted",
  waiting: "border-waiting text-waiting",
  primary: "border-primary text-primary",
  success: "border-success text-success",
  danger: "border-danger text-danger",
} as const;

export function Pill({
  children,
  tone = "neutral",
  mono = false,
}: {
  children: ReactNode;
  tone?: keyof typeof TONE;
  mono?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-4 shrink-0 items-center rounded-pill border px-1.5 text-xs leading-none font-semibold",
        mono && "font-mono",
        TONE[tone],
      )}
    >
      {children}
    </span>
  );
}

export function VersionPill({ version }: { version: number }) {
  return <Pill mono>v{version}</Pill>;
}
