# adapters/ids

The ids port: UUIDv7 (`uuidv7`, D22) written as a TypeID (`typeid-js`, D36).

| File | What it is for |
| --- | --- |
| `typeid-ids.ts` | `newId(prefix)` |

Do not: convert TypeIDs to UUIDs here; only `adapters/db/typeid.ts` converts.
