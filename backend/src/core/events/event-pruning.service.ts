import type { Clock } from "../ports/clock.ts";
import type { UnitOfWork } from "../ports/repositories.ts";

// The event pruning job (domain-model.md §8, architecture.md §6.1): deletes the events older
// than EVENT_RETENTION_DAYS. It writes no event; a client whose cursor is older than the kept
// events gets `reset` (realtime-events.md §2).
export function createEventPruning(deps: { uow: UnitOfWork; clock: Clock; retentionDays: number }) {
  return {
    // Deletes every event created before now − retentionDays × 24 h; returns how many.
    pruneDue: (): Promise<number> => {
      const cutoff = new Date(deps.clock.now().getTime() - deps.retentionDays * 86_400_000);
      return deps.uow.run((tx) => tx.events.deleteBefore(cutoff));
    },
  };
}

export type EventPruning = ReturnType<typeof createEventPruning>;
