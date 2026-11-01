import type { StreamEvent } from "@cty1ng/shared/events";
import type { Query, QueryClient } from "@tanstack/react-query";

// Test only: the notes of the test.ping events seen, so tests can see what the reducer applied.
export const TEST_PINGS_KEY = ["realtime", "test-pings"] as const;

// The generated query keys start with `{ _id: <operationId> }` (Hey API). Every skill
// operation id has "Skill" in it and every settings one "Settings" (api.md §2, §7).
function operationMatches(pattern: RegExp) {
  return (query: Query): boolean => {
    const [first] = query.queryKey;
    return (
      typeof first === "object" &&
      first !== null &&
      "_id" in first &&
      typeof first._id === "string" &&
      pattern.test(first._id)
    );
  };
}
const SKILL_QUERIES = operationMatches(/Skill/);
const SETTINGS_QUERIES = operationMatches(/Settings/);

// Applies stream events to the TanStack Query cache (realtime-events.md §3). Applying an event
// twice has the same result as once: a persisted event with a seq at or below the last
// applied one is skipped.
export function createEventReducer(queryClient: QueryClient) {
  let lastSeq: number | null = null;
  // The high mark of the last `ready` (the highest seq ever given). The server sends `reset` right after `ready`, and the
  // stream then continues after this seq (realtime-events.md §3, the `id:` of `reset`).
  let readyMaxSeq: number | null = null;

  return {
    get lastSeq(): number | null {
      return lastSeq;
    },

    // Returns false when the event was already applied.
    apply(event: StreamEvent): boolean {
      if ("seq" in event) {
        if (lastSeq !== null && event.seq <= lastSeq) return false;
        lastSeq = event.seq;
      }
      switch (event.type) {
        case "ready":
          // A first connection starts at the newest event. A reconnect keeps the cursor: the
          // replay that follows must not be skipped.
          readyMaxSeq = event.data.max_seq;
          lastSeq ??= readyMaxSeq;
          return true;
        case "reset":
          // The server lost the cursor (pruned events or a new database). Everything cached
          // may be stale, and the seq can start lower than before. The cursor moves to where
          // the server continues, not to null: a later reconnect's `ready` must not move it
          // past the events that the server replays then.
          lastSeq = readyMaxSeq;
          void queryClient.invalidateQueries();
          return true;
        case "test.ping": {
          const note = event.data.note;
          queryClient.setQueryData<string[]>(TEST_PINGS_KEY, (notes = []) => [...notes, note]);
          return true;
        }
        // A skill changed, or left or entered Trash: its lists and pages fetch again. The Skills
        // page (M1b) reads these queries.
        case "skill.created":
        case "skill.updated":
        case "skill.deprecated":
        case "skill.trashed":
        case "skill.restored":
        case "skill.purged":
        case "trash.changed":
          void queryClient.invalidateQueries({ predicate: SKILL_QUERIES });
          return true;
        // A bot changed: pins move the skills' bot counts, so the skill queries fetch again too
        // (the Bots tab of a skill, M2a). The Bots page (M2b) adds its own queries here.
        case "bot.created":
        case "bot.updated":
        case "bot.deleted":
        case "bot.restored":
        case "bot.purged":
        case "bots.reordered":
          void queryClient.invalidateQueries({ predicate: SKILL_QUERIES });
          return true;
        case "settings.updated":
          void queryClient.invalidateQueries({ predicate: SETTINGS_QUERIES });
          return true;
        default: {
          const _exhaustive: never = event;
          return _exhaustive;
        }
      }
    },
  };
}
