import { isPersistedEventType } from "@cty1ng/shared";
import { asc, gt, max, min } from "drizzle-orm";
import type {
  EventLogReader,
  EventsRepository,
  NewEvent,
  SeqBounds,
  StoredEvent,
} from "../../core/ports/repositories";
import type { Db } from "./connection";
import { events } from "./schema";

export function createEventLogReader(db: Db): EventLogReader {
  return {
    async listAfter({ afterSeq, limit }): Promise<StoredEvent[]> {
      const rows = db
        .select()
        .from(events)
        .where(gt(events.seq, afterSeq))
        .orderBy(asc(events.seq))
        .limit(limit)
        .all();
      return rows.map(toStoredEvent);
    },
    async bounds(): Promise<SeqBounds> {
      const row = db
        .select({ minSeq: min(events.seq), maxSeq: max(events.seq) })
        .from(events)
        .get();
      return { minSeq: row?.minSeq ?? null, maxSeq: row?.maxSeq ?? null };
    },
  };
}

export function createEventsRepository(db: Db): EventsRepository {
  return {
    ...createEventLogReader(db),
    async append(event: NewEvent): Promise<number> {
      const row = db
        .insert(events)
        .values({
          type: event.type,
          conversationId: event.conversationId,
          payload: event.payload,
          createdAt: event.createdAt,
        })
        .returning({ seq: events.seq })
        .get();
      return row.seq;
    },
  };
}

function toStoredEvent(row: typeof events.$inferSelect): StoredEvent {
  if (!isPersistedEventType(row.type)) {
    throw new Error(`events row ${row.seq} has unknown type ${row.type}`);
  }
  return {
    seq: row.seq,
    type: row.type,
    conversationId: row.conversationId,
    payload: row.payload,
    createdAt: row.createdAt,
  };
}
