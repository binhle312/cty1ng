/**
 * `pnpm check:events` (realtime-events.md §4): the event types in the document's table must
 * equal the types in `shared/` plus PENDING, and the two must not overlap. The frontend
 * reducer's exhaustive switch over the shared types completes the check (from M0b).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EVENT_TYPES } from "@cty1ng/shared";

/**
 * Types in the document that no slice has built yet. A slice that adds a type to `shared/`
 * removes it from here in the same PR.
 */
export const PENDING = [
  "conversation.created",
  "conversation.updated",
  "conversation.deleted",
  "message.created",
  "message.delta",
  "message.completed",
  "message.failed",
  "message.stopped",
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
  "skill.created",
  "skill.updated",
  "skill.deprecated",
  "settings.updated",
  "spend.threshold_crossed",
  "project.created",
  "project.updated",
  "project.deleted",
  "memory.saved",
  "memory.updated",
  "memory.deleted",
] as const;

/** Event type names from the §4 table: every backticked name in a row's first cell. */
export function documentedTypes(markdown: string): string[] {
  const start = markdown.indexOf("## 4. Event types");
  if (start === -1) throw new Error("realtime-events.md has no '## 4. Event types' section");
  const end = markdown.indexOf("\n## ", start + 1);
  const section = markdown.slice(start, end === -1 ? undefined : end);
  const types: string[] = [];
  for (const line of section.split("\n")) {
    if (!line.startsWith("| `")) continue;
    const cell = line.split("|")[1] ?? "";
    for (const match of cell.matchAll(/`([a-z_.]+)`/g)) {
      if (match[1] !== undefined) types.push(match[1]);
    }
  }
  return types;
}

export function checkEvents(input: {
  documented: readonly string[];
  shared: readonly string[];
  pending: readonly string[];
}): string[] {
  const errors: string[] = [];
  const documented = new Set(input.documented);
  const shared = new Set(input.shared);
  const pending = new Set(input.pending);
  for (const type of documented) {
    if (!shared.has(type) && !pending.has(type)) {
      errors.push(`${type} is in realtime-events.md §4 but neither in shared/ nor in PENDING`);
    }
  }
  for (const type of shared) {
    if (!documented.has(type))
      errors.push(`${type} is in shared/ but not in realtime-events.md §4`);
    if (pending.has(type))
      errors.push(`${type} is in shared/ and still in PENDING; remove it from PENDING`);
  }
  for (const type of pending) {
    if (!documented.has(type))
      errors.push(`${type} is in PENDING but not in realtime-events.md §4`);
  }
  return errors;
}

if (import.meta.main) {
  const markdown = readFileSync(join(process.cwd(), "docs/realtime-events.md"), "utf8");
  const errors = checkEvents({
    documented: documentedTypes(markdown),
    shared: EVENT_TYPES,
    pending: PENDING,
  });
  if (errors.length > 0) {
    process.stderr.write(`check:events failed:\n${errors.map((e) => `  ${e}`).join("\n")}\n`);
    process.exit(1);
  }
  process.stdout.write("check:events: documented = shared + PENDING\n");
}
