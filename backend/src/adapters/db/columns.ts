import { customType } from "drizzle-orm/sqlite-core";
import { TypeID } from "typeid-js";

// The one place that converts ids (D36): TypeIDs everywhere outside the database, UUIDs inside
// it (TEXT on SQLite; native uuid on Postgres later).
export function typeIdColumn(prefix: string) {
  return customType<{ data: string; driverData: string }>({
    dataType: () => "text",
    toDriver: (value) => {
      // Throws on a malformed id or a wrong prefix.
      return TypeID.fromString(value, prefix).toUUID();
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
