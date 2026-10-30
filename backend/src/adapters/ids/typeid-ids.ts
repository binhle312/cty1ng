import { TypeID } from "typeid-js";
import { uuidv7 } from "uuidv7";
import type { Ids } from "../../core/ports/ids.ts";

// A UUIDv7 (D22) written as a TypeID (D36): `uuidv7` makes the value, typeid-js encodes it.
export const typeIdIds: Ids = {
  newId: (prefix) => `${prefix}_${TypeID.fromUUID(prefix, uuidv7()).getSuffix()}`,
};

// The `ids decode` CLI (D36): a TypeID gives its UUID; a UUID with a prefix gives the TypeID.
export function typeIdToUuid(value: string): string {
  return TypeID.fromString(value).toUUID();
}

export function uuidToTypeId(prefix: string, uuid: string): string {
  return TypeID.fromUUID(prefix, uuid).toString();
}
