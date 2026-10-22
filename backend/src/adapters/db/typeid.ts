import { ID_PREFIXES, parseId, type IdOf, type IdPrefix } from "@cty1ng/shared";
import { TypeID } from "typeid-js";

/**
 * The one place a TypeID becomes a UUID and back (D36). The Drizzle column type uses it; the
 * `ids decode` CLI command reuses it for debugging. Nothing else converts.
 */
export function typeIdToUuid(id: string): string {
  return TypeID.fromString(id).toUUID();
}

export function uuidToTypeId<P extends IdPrefix>(prefix: P, uuid: string): IdOf<P> {
  return parseId(prefix, TypeID.fromUUID(prefix, uuid).toString());
}

export function decodeId(
  value: string,
): { typeId: string; uuid: string } | { uuid: string; typeIds: string[] } {
  if (value.includes("_")) {
    return { typeId: value, uuid: typeIdToUuid(value) };
  }
  // A bare UUID carries no prefix, so show it under every prefix.
  return {
    uuid: value,
    typeIds: ID_PREFIXES.map((prefix) => TypeID.fromUUID(prefix, value).toString()),
  };
}
