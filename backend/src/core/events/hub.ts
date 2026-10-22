import { PersistedEvent, type StreamEvent } from "@cty1ng/shared";
import type { EventLogReader, SeqBounds, StoredEvent } from "../ports/repositories";
import type { EventFeed, StreamCursor } from "../ports/transport";

export interface EventHub extends EventFeed {
  /** Called after every commit that may have appended events. */
  notify(): void;
}

/**
 * The in-process hub (realtime-events.md §1). Subscribers always read committed events from
 * the log, never from memory, so replay and live delivery are the same code: read everything
 * after the cursor, then wait for a commit and read again.
 */
export function createEventHub(deps: { log: EventLogReader; pageSize?: number }): EventHub {
  const pageSize = deps.pageSize ?? 500;
  let commits = 0;
  const waiters = new Set<() => void>();

  function notify(): void {
    commits += 1;
    for (const wake of waiters) wake();
    waiters.clear();
  }

  /** Resolves on the first commit after `seen`, or when the signal aborts. */
  function nextCommit(seen: number, signal: AbortSignal): Promise<void> {
    if (commits !== seen || signal.aborted) return Promise.resolve();
    return new Promise((resolve) => {
      const wake = (): void => {
        waiters.delete(wake);
        signal.removeEventListener("abort", wake);
        resolve();
      };
      waiters.add(wake);
      signal.addEventListener("abort", wake, { once: true });
    });
  }

  async function* subscribe(input: {
    cursor: StreamCursor;
    signal: AbortSignal;
  }): AsyncGenerator<StreamEvent> {
    const { signal } = input;
    // Read the commit counter before the first read, so a commit that lands between the read
    // and the wait is not missed.
    let seen = commits;
    const bounds = await deps.log.bounds();
    const maxSeq = bounds.maxSeq ?? 0;
    let cursor = startCursor(input.cursor, bounds);
    if (cursor === "reset") {
      yield { type: "reset", data: {} };
      cursor = maxSeq;
    }
    yield { type: "ready", data: { max_seq: maxSeq } };

    while (!signal.aborted) {
      const rows = await deps.log.listAfter({ afterSeq: cursor, limit: pageSize });
      for (const row of rows) {
        yield toStreamEvent(row);
        cursor = row.seq;
      }
      if (rows.length === pageSize) continue;
      await nextCommit(seen, signal);
      seen = commits;
    }
  }

  return { notify, subscribe };
}

/** Where replay starts, or "reset" when the cursor is outside the kept log (§2 gap rule). */
function startCursor(cursor: StreamCursor, bounds: SeqBounds): number | "reset" {
  const maxSeq = bounds.maxSeq ?? 0;
  switch (cursor.kind) {
    case "fresh":
      return maxSeq;
    case "unusable":
      return "reset";
    case "after": {
      // Ahead of the log: the client saw a different database (for example a fresh data dir).
      if (cursor.seq > maxSeq) return "reset";
      // Events after the cursor were pruned, so replay would leave a gap.
      if (bounds.minSeq !== null && cursor.seq < bounds.minSeq - 1) return "reset";
      return cursor.seq;
    }
    default: {
      const _exhaustive: never = cursor;
      return _exhaustive;
    }
  }
}

function toStreamEvent(row: StoredEvent): StreamEvent {
  // The payload was validated on append; parse again because it comes back from storage
  // (frontend-conventions.md §1, unknown at boundaries).
  return PersistedEvent.parse({ seq: row.seq, type: row.type, data: row.payload });
}
