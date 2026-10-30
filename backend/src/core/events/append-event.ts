import { StreamEvent } from "@cty1ng/shared/events";
import type { ConversationId } from "@cty1ng/shared/ids";
import type { Clock } from "../ports/clock.ts";
import type { Tx } from "../ports/repositories.ts";

// A persisted event type without its seq: the database assigns the seq on insert.
type PersistedStreamEvent = Extract<StreamEvent, { seq: number }>;
export type NewStreamEvent = PersistedStreamEvent extends infer E
  ? E extends PersistedStreamEvent
    ? Omit<E, "seq">
    : never
  : never;

export interface AppendEventInput {
  event: NewStreamEvent;
  // Set when the event belongs to a conversation (realtime-events.md §4); null for app-wide.
  conversationId: ConversationId | null;
}

export type AppendEvent = (tx: Tx, input: AppendEventInput) => Promise<number>;

// appendEvent(tx, …) inserts the event in the caller's transaction (AGENTS.md §5 rule 3) and
// wakes the stream after that transaction commits, never before and never after a rollback.
export function createAppendEvent(deps: {
  clock: Clock;
  notify: (seq: number) => void;
}): AppendEvent {
  return async (tx, { event, conversationId }) => {
    // The payload is checked against its schema before it is stored, so the stream never reads
    // back an event it cannot parse.
    StreamEvent.parse({ ...event, seq: 1 });
    const seq = await tx.events.append({
      type: event.type,
      conversationId,
      payload: event.data,
      createdAt: deps.clock.now(),
    });
    tx.afterCommit(() => {
      deps.notify(seq);
    });
    return seq;
  };
}
