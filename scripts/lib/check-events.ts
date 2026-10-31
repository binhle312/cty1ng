// The checks behind `pnpm check:events` (realtime-events.md §4): the event table in the docs
// must equal the types built in shared/ plus PENDING, and the two must not overlap.

// Types in the realtime-events.md §4 table that shared/ does not define yet. Each slice moves
// its types out of this list when it adds them to shared/. The list only gets shorter.
export const PENDING = [
  "conversation.created",
  "conversation.updated",
  "conversation.deleted",
  "message.created",
  "message.delta",
  "message.completed",
  "message.failed",
  "message.stopped",
  "message.feedback",
  "run.queued",
  "run.started",
  "run.step",
  "run.finished",
  "member.pending",
  "member.joined",
  "member.left",
  "handoff.created",
  "handoff.decided",
  "skill_draft.created",
  "skill_draft.decided",
  "bot.created",
  "bot.updated",
  "bot.deleted",
  "bots.reordered",
  "spend.threshold_crossed",
  "project.created",
  "project.updated",
  "project.deleted",
  "projects.reordered",
  "memory.saved",
  "memory.updated",
  "memory.deleted",
  "memory.seen",
  "memory.restored",
  "memory_proposal.updated",
] as const;

// The names in the first column of the §4 table, for example `bot.created` / `bot.updated`.
export function documentedTypes(realtimeEventsMd: string): string[] {
  const start = realtimeEventsMd.indexOf("## 4. Event types");
  const end = realtimeEventsMd.indexOf("\n## 5.", start);
  if (start === -1 || end === -1)
    throw new Error("realtime-events.md has no §4 Event types section");
  const types: string[] = [];
  for (const line of realtimeEventsMd.slice(start, end).split("\n")) {
    const firstCell = /^\|([^|]+)\|/.exec(line)?.[1] ?? "";
    for (const match of firstCell.matchAll(/`([a-z_]+(?:\.[a-z_]+)?)`/g)) {
      if (match[1] !== undefined) types.push(match[1]);
    }
  }
  return types;
}

export function checkEvents(
  documented: readonly string[],
  built: readonly string[],
  pending: readonly string[],
): string[] {
  const problems: string[] = [];
  for (const type of built) {
    if (pending.includes(type))
      problems.push(`\`${type}\` is built in shared/ and still in PENDING: remove it from PENDING`);
    if (!documented.includes(type))
      problems.push(`\`${type}\` is in shared/ but not in realtime-events.md §4`);
  }
  for (const type of pending) {
    if (!documented.includes(type))
      problems.push(`\`${type}\` is in PENDING but not in realtime-events.md §4`);
  }
  for (const type of documented) {
    if (!built.includes(type) && !pending.includes(type)) {
      problems.push(
        `\`${type}\` is in realtime-events.md §4 but neither in shared/ nor in PENDING`,
      );
    }
  }
  return problems;
}
