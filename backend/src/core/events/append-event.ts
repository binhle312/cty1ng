import {
  PERSISTED_EVENT_DATA,
  type ConversationId,
  type PersistedEventData,
  type PersistedEventType,
} from "@cty1ng/shared";
import type { Repositories } from "../ports/repositories";

/**
 * Appends one event in the caller's unit of work, so it commits or rolls back with the change
 * it describes (AGENTS.md §5 rule 3). The payload is checked against the event type's schema.
 * Subscribers are woken after the commit by the unit of work, not here.
 */
export async function appendEvent<T extends PersistedEventType>(
  tx: Repositories,
  event: {
    type: T;
    data: PersistedEventData<T>;
    conversationId: ConversationId | null;
    at: Date;
  },
): Promise<number> {
  const payload = PERSISTED_EVENT_DATA[event.type].parse(event.data);
  return tx.events.append({
    type: event.type,
    conversationId: event.conversationId,
    payload,
    createdAt: event.at,
  });
}
