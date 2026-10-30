import type { StreamEvent } from "@cty1ng/shared/events";
import type { QueryClient } from "@tanstack/react-query";

// Test only: the notes of the test.ping events seen, so tests can see what the reducer applied.
export const TEST_PINGS_KEY = ["realtime", "test-pings"] as const;

// Applies stream events to the TanStack Query cache (realtime-events.md §3). Applying an event
// twice has the same result as once: a persisted event with a seq at or below the last
// applied one is skipped.
export function createEventReducer(queryClient: QueryClient) {
  let lastSeq: number | null = null;

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
          lastSeq ??= event.data.max_seq;
          return true;
        case "reset":
          // The server lost the cursor (pruned events or a new database). Everything cached
          // may be stale, and the seq can start lower than before.
          lastSeq = null;
          void queryClient.invalidateQueries();
          return true;
        case "test.ping": {
          const note = event.data.note;
          queryClient.setQueryData<string[]>(TEST_PINGS_KEY, (notes = []) => [...notes, note]);
          return true;
        }
        default: {
          const _exhaustive: never = event;
          return _exhaustive;
        }
      }
    },
  };
}
