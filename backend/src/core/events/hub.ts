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
  let lastNotified = 0;
  const waiters = new Set<() => void>();

  function waitForNotify(cursor: number, signal: AbortSignal): Promise<void> {
    if (lastNotified > cursor || signal.aborted) return Promise.resolve();
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
      const page = await deps.readers.events.after(cursor, PAGE_SIZE);
      for (const row of page) {
        if (stopped()) return;
        cursor = row.seq;
        const parsed = StreamEvent.safeParse({ type: row.type, seq: row.seq, data: row.payload });
        if (parsed.success) yield parsed.data;
        else deps.onInvalidEvent(row.seq, row.type);
      }
      if (page.length < PAGE_SIZE) await waitForNotify(cursor, signal);
    }
  }

  return {
    subscribe,
    notify(seq) {
      lastNotified = Math.max(lastNotified, seq);
      for (const wake of [...waiters]) wake();
    },
  };
}
