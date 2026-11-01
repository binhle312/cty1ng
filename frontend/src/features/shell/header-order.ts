// Deferred reordering of the header (app-shell.md UI-2.9): while the owner engages with the
// header, the order of the others is frozen. Activity that arrives meanwhile moves no avatar;
// the new order applies in one step later. Pinned bots are not frozen: only the owner moves them,
// and the owner's own pin, unpin or drag applies at once.

// The others in the frozen order: the bots that are still others keep their frozen place; a bot
// that joined the others meanwhile (a new bot) goes at the end, in the current order. A bot that
// left (deleted, or pinned) leaves.
export function arrangeFrozen(
  frozen: readonly string[] | null,
  current: readonly string[],
): string[] {
  if (frozen === null) return [...current];
  const now = new Set(current);
  const kept = frozen.filter((id) => now.has(id));
  const known = new Set(kept);
  return [...kept, ...current.filter((id) => !known.has(id))];
}

// What a drop in the header does (top-header.md §3, HD2–HD5). `over` is a pinned bot, an other
// bot, or one of the two zones.
export type HeaderDrop =
  { kind: "pin_at"; index: number } | { kind: "pin_end" } | { kind: "unpin" } | { kind: "none" };

export const PINNED_ZONE = "zone:pinned";
export const OTHERS_ZONE = "zone:others";

export function headerDrop({
  active,
  over,
  pinned,
  others,
}: {
  active: string;
  over: string | null;
  pinned: readonly string[];
  others: readonly string[];
}): HeaderDrop {
  if (over === null || over === active) return { kind: "none" };
  const fromPinned = pinned.includes(active);
  const overPinned = pinned.indexOf(over);
  if (overPinned !== -1) return { kind: "pin_at", index: overPinned };
  if (over === PINNED_ZONE) return fromPinned ? { kind: "none" } : { kind: "pin_end" };
  if (over === OTHERS_ZONE || others.includes(over)) {
    return fromPinned ? { kind: "unpin" } : { kind: "none" };
  }
  return { kind: "none" };
}
