import { StreamEvent } from "@cty1ng/shared/events";
import type { Readers } from "../ports/repositories.ts";
import type { Transport } from "../ports/transport.ts";

// The event hub (realtime-events.md §1, §2). Subscribers always read from the events table,
// never from an in-memory copy, so the live path and the replay path are the same code. The
// hub only wakes them after a commit (`notify`).
export interface EventHub extends Transport {
  notify(seq: number): void;
}

// How many events one read takes. It bounds what a slow subscriber holds in memory.
const PAGE_SIZE = 100;

export function createEventHub(deps: {
  readers: Readers;
  // A stored event that does not parse (for example a type from a newer version) is skipped.
  onInvalidEvent: (seq: number, type: string) => void;
}): EventHub {
  // How many notifies the hub has had. A subscriber waits for a notify after the read it just
  // made, not for a seq above its cursor: after pruning, a notified seq can be above the cursor
  // with no kept event to read, and comparing seqs would read empty pages without end.
  let notifies = 0;
  const waiters = new Set<() => void>();

  // Resolves at the first notify after `seen`, at once if one already came. A notify before the
  // read began was committed before it, so the read saw that event; a later one ends the wait.
  function waitForNotify(seen: number, signal: AbortSignal): Promise<void> {
    if (notifies > seen || signal.aborted) return Promise.resolve();
    return new Promise((resolve) => {
      const wake = (): void => {
        waiters.delete(wake);
        signal.removeEventListener("abort", wake);
        resolve();
      };
      waiters.add(wake);
      signal.addEventListener("abort", wake);
    });
  }

  async function* subscribe(
    afterSeq: number | null,
    signal: AbortSignal,
  ): AsyncGenerator<StreamEvent> {
    const { oldest, newest } = await deps.readers.events.bounds();
    const maxSeq = newest ?? 0;
    yield { type: "ready", data: { max_seq: maxSeq } };

    let cursor = maxSeq;
    // Whether the cursor is the seq of an event that was stored, so the next event must be
    // cursor + 1. After a complete prune the newest seq is unknown (`max_seq` is 0), so the
    // first event read sets the cursor.
    let anchored = newest !== null;
    if (afterSeq !== null) {
      // The cursor is outside the kept events: older than the oldest (pruned, §2 "gap rule"),
      // or newer than the newest (the database was reset). The client reloads with GETs.
      const tooOld = oldest !== null && afterSeq < oldest - 1;
      if (tooOld || afterSeq > maxSeq) {
        yield { type: "reset", data: {} };
      } else {
        cursor = afterSeq;
      }
    }

    // A function, not `signal.aborted` directly: the signal can abort while this generator waits.
    const stopped = (): boolean => signal.aborted;
    while (!stopped()) {
      const seen = notifies;
      const page = await deps.readers.events.after(cursor, PAGE_SIZE);
      let gap = false;
      for (const row of page) {
        if (stopped()) return;
        // Seqs have no gaps (the transport contract), so a skipped seq was pruned before this
        // subscriber sent it.
        if (anchored && row.seq !== cursor + 1) {
          gap = true;
          break;
        }
        cursor = row.seq;
        anchored = true;
        const parsed = StreamEvent.safeParse({ type: row.type, seq: row.seq, data: row.payload });
        if (parsed.success) yield parsed.data;
        else deps.onInvalidEvent(row.seq, row.type);
      }
      if (gap) {
        // The gap rule during a replay (realtime-events.md §2): `ready` with the newest seq, then
        // `reset`, as at the start. The client reloads, and the stream continues after the
        // newest event.
        const now = await deps.readers.events.bounds();
        cursor = now.newest ?? 0;
        anchored = now.newest !== null;
        yield { type: "ready", data: { max_seq: cursor } };
        yield { type: "reset", data: {} };
        continue;
      }
      if (page.length < PAGE_SIZE) await waitForNotify(seen, signal);
    }
  }

  return {
    subscribe,
    notify() {
      notifies += 1;
      for (const wake of [...waiters]) wake();
    },
  };
}
