import { asc, eq, gt, max, min, and } from "drizzle-orm";
import { ConversationId } from "@cty1ng/shared/ids";
import type {
  EventsWriter,
  PersistedEvent,
  SettingsWriter,
} from "../../core/ports/repositories.ts";
import type { Db } from "./client.ts";
import { events, settings } from "./schema.ts";

// Repositories over one Drizzle connection: the writer inside a transaction, or the reader
// outside one (the reader never calls the write methods; its connection is read-only).

export function eventsRepository(db: Db): EventsWriter {
  return {
    append: (event) => {
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
      return Promise.resolve(row.seq);
    },
    after: (seq, limit) => {
      const rows = db
        .select()
        .from(events)
        .where(gt(events.seq, seq))
        .orderBy(asc(events.seq))
        .limit(limit)
        .all();
      return Promise.resolve(rows.map(toPersistedEvent));
    },
    bounds: () => {
      const row = db
        .select({ oldest: min(events.seq), newest: max(events.seq) })
        .from(events)
        .get();
      return Promise.resolve({ oldest: row?.oldest ?? null, newest: row?.newest ?? null });
    },
  };
}

function toPersistedEvent(row: typeof events.$inferSelect): PersistedEvent {
  return {
    seq: row.seq,
    type: row.type,
    // Parsed at the boundary: the column type gives a plain string.
    conversationId: row.conversationId === null ? null : ConversationId.parse(row.conversationId),
    payload: row.payload,
    createdAt: row.createdAt,
  };
}

export function settingsRepository(db: Db): SettingsWriter {
  return {
    get: (key) => {
      const row = db.select().from(settings).where(eq(settings.key, key)).get();
      return Promise.resolve(row?.value);
    },
    set: (key, value) => {
      db.insert(settings)
        .values({ key, value })
        .onConflictDoUpdate({ target: settings.key, set: { value } })
        .run();
      return Promise.resolve();
    },
    // Compares the stored JSON text, so `expected` must serialise the same way it was written.
    // `expected === undefined` means "no row yet".
    setIf: (key, expected, next) => {
      const result =
        expected === undefined
          ? db.insert(settings).values({ key, value: next }).onConflictDoNothing().run()
          : db
              .update(settings)
              .set({ value: next })
              .where(and(eq(settings.key, key), eq(settings.value, expected)))
              .run();
      return Promise.resolve(result.changes === 1);
    },
  };
}
