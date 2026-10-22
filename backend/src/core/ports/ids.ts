import type { IdOf, IdPrefix } from "@cty1ng/shared";

/** New ids: a UUIDv7 (D22) written as a TypeID with the table's prefix (D36). */
export interface Ids {
  newId<P extends IdPrefix>(prefix: P): IdOf<P>;
}
