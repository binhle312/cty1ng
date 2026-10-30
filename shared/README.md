# shared

Code that both the backend and the frontend import: the event schemas, TypeIDs and error codes
(`docs/architecture.md` §4). Zod only; no Node or browser APIs.

| File | What it is for |
| --- | --- |
| `package.json` | The `@cty1ng/shared` package and its entry points (`.`, `./events`, `./ids`, `./errors`) |
| `tsconfig.json` | Type-check settings for this package |
| `src/` | The source |
| `src/index.ts` | Re-exports everything below |
| `src/events/` | The stream event envelope and every built event type (`docs/realtime-events.md` §1a, §4) |
| `src/events/index.ts` | Re-exports the event schemas |
| `src/events/stream-event.ts` | `StreamEvent`, the union of every event type, and `EVENT_TYPES` |
| `src/ids.ts` | One branded TypeID schema per table prefix (`BotId`, `MessageId`, …; D36) |
| `src/errors.ts` | API error codes with their HTTP status and the error shape (`docs/api.md` §1) |

Start here: `src/events/stream-event.ts`. Do not: import from `backend/` or `frontend/`, or add
a type that is not in `docs/realtime-events.md` §4 first.
