import { StreamEvent } from "@cty1ng/shared/events";
import type { Readers } from "../ports/repositories.ts";
import type { Transport } from "../ports/transport.ts";

// The event hub (realtime-events.md §1, §2). Subscribers always read from the events table,
// never from an in-memory copy, so the live path and the replay path are the same code. The
// hub only wakes them after a commit (`notify`).
export interface EventHub extends Transport {
  // An event was committed, or events were pruned: every subscriber reads again.
  notify(): void;
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
    // One high mark: the highest seq ever given, kept or pruned (realtime-events.md §2). `ready`
    // carries it and the stream continues after it. Seqs have no gaps (the transport contract),
    // so every seq up to it was given, and the next event must be the cursor + 1. `oldest` is
    // read first: an event committed in between is above `oldest` and at most the high mark.
    const { oldest } = await deps.readers.events.bounds();
    const highMark = (await deps.readers.events.lastSeq()) ?? 0;
    yield { type: "ready", data: { max_seq: highMark } };

    let cursor = highMark;
    if (afterSeq !== null) {
      // The cursor is outside the kept events: older than the oldest kept one, or with every
      // event pruned and below the high mark (pruned, §2 "gap rule"), or above the high mark
      // (the database was reset). The client reloads with GETs.
      const pruned = oldest === null ? afterSeq < highMark : afterSeq < oldest - 1;
      if (pruned || afterSeq > highMark) {
        yield { type: "reset", data: {} };
      } else {
        cursor = afterSeq;
      }
    }

    // A function, not `signal.aborted` directly: the signal can abort while this generator waits.
    const stopped = (): boolean => signal.aborted;
    while (!stopped()) {
      const seen = notifies;
      let page = await deps.readers.events.after(cursor, PAGE_SIZE);
      let gap = false;
      if (page.length === 0) {
        // An empty page has no seq to compare, but events after the cursor may have been pruned
        // unsent. The last given seq is read first, then the page again: an event committed in
        // between is in the second page, so it is not taken for a gap.
        const last = await deps.readers.events.lastSeq();
        page = await deps.readers.events.after(cursor, PAGE_SIZE);
        gap = page.length === 0 && last !== null && last > cursor;
      }
      for (const row of page) {
        if (stopped()) return;
        // A skipped seq was pruned before this subscriber sent it.
        if (row.seq !== cursor + 1) {
          gap = true;
          break;
        }
        cursor = row.seq;
        const parsed = StreamEvent.safeParse({ type: row.type, seq: row.seq, data: row.payload });
        if (parsed.success) yield parsed.data;
        else deps.onInvalidEvent(row.seq, row.type);
      }
      if (gap) {
        // The gap rule during a replay (realtime-events.md §2): `ready` with the high mark now,
        // then `reset`, as at the start; the client reloads and the stream continues after it.
        // Every lost seq is at or below it, so the same gap is not found again; an event
        // committed later has a higher seq.
        cursor = (await deps.readers.events.lastSeq()) ?? cursor;
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
