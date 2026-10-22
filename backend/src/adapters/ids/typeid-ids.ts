import { parseId } from "@cty1ng/shared";
import { TypeID } from "typeid-js";
import { uuidv7 } from "uuidv7";
import type { Ids } from "../../core/ports/ids";

/** UUIDv7 (D22) written as a TypeID (D36). */
export const typeIdIds: Ids = {
  newId(prefix) {
    return parseId(prefix, TypeID.fromUUID(prefix, uuidv7()).toString());
  },
};
