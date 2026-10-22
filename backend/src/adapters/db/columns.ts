import type { IdOf, IdPrefix } from "@cty1ng/shared";
import { customType } from "drizzle-orm/sqlite-core";
import { typeIdToUuid, uuidToTypeId } from "./typeid";

/**
 * An id column: a UUID in the database (`TEXT` on SQLite, `uuid` on Postgres later), a TypeID
 * everywhere else (D36, architecture.md §10 guardrail 2).
 */
export function typeIdColumn<P extends IdPrefix>(name: string, prefix: P) {
  return customType<{ data: IdOf<P>; driverData: string }>({
    dataType: () => "text",
    toDriver: (id) => typeIdToUuid(id),
    fromDriver: (uuid) => uuidToTypeId(prefix, uuid),
  })(name);
}

/** A UTC timestamp stored as ISO-8601 text with `Z` (domain-model.md §1). */
export function utcTimestamp(name: string) {
  return customType<{ data: Date; driverData: string }>({
    dataType: () => "text",
    toDriver: (date) => date.toISOString(),
    fromDriver: (text) => new Date(text),
  })(name);
}
