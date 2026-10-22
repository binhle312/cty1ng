# shared

Code both sides import: the event schemas, ids and error codes (architecture.md §4). Imports
neither `backend/` nor `frontend/`.

| File | What it is for |
| --- | --- |
| `package.json` | The `@cty1ng/shared` package; exports `src/index.ts` |
| `tsconfig.json` | Strict TypeScript settings (frontend-conventions.md §3) |
| `src/` | `ids.ts` (TypeID schemas per prefix, D36), `errors.ts` (API error codes and shape), `events/` (event envelope and payloads, realtime-events.md) |

Start here: `src/events/envelope.ts`. Do not: add a type that the backend owns only; it belongs
in the backend.
