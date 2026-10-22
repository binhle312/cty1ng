import { and, eq } from "drizzle-orm";
import type { SettingsRepository } from "../../core/ports/repositories";
import type { Db } from "./connection";
import { settings } from "./schema";

export function createSettingsRepository(db: Db): SettingsRepository {
  return {
    async get(key) {
      const row = db.select().from(settings).where(eq(settings.key, key)).get();
      return row?.value;
    },
    async put(key, value) {
      db.insert(settings)
        .values({ key, value })
        .onConflictDoUpdate({ target: settings.key, set: { value } })
        .run();
    },
    async compareAndSet({ key, expected, next }) {
      // The JSON column encodes `expected` the same way it stored the value, so equal values
      // compare as equal text.
      const result = db
        .update(settings)
        .set({ value: next })
        .where(and(eq(settings.key, key), eq(settings.value, expected)))
        .run();
      return result.changes === 1;
    },
  };
}
