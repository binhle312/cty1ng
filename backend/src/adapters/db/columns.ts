import { customType } from "drizzle-orm/sqlite-core";
import { TypeID } from "typeid-js";

// The one place that converts ids (D36): TypeIDs everywhere outside the database, UUIDs inside
// it (TEXT on SQLite; native uuid on Postgres later).
export function typeIdColumn(prefix: string) {
  return customType<{ data: string; driverData: string }>({
    dataType: () => "text",
    toDriver: (value) => {
      // Throws on a malformed id or a wrong prefix. An id with the right shape whose value is no
      // UUID (for example the version 0) gets its hex form: no row has it, so a read finds
      // nothing. `toUUID()` would throw on it, and the request would end as a 500.
      const hex = Buffer.from(TypeID.fromString(value, prefix).toUUIDBytes()).toString("hex");
      return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20),
      ].join("-");
    },
    fromDriver: (uuid) => TypeID.fromUUID(prefix, uuid).toString(),
  });
}

// UTC timestamps as ISO-8601 text with `Z` (domain-model.md §1), so Postgres can map the same
// helper to timestamptz later.
export const utcTimestamp = customType<{ data: Date; driverData: string }>({
  dataType: () => "text",
  toDriver: (value) => value.toISOString(),
  fromDriver: (text) => new Date(text),
});
