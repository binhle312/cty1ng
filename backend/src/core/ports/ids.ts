// New ids: a UUIDv7 (D22) written as a TypeID with the table's prefix (D36).
export interface Ids {
  newId<const Prefix extends string>(prefix: Prefix): `${Prefix}_${string}`;
}
