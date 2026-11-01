# shared

Code that both the backend and the frontend import: the event schemas, TypeIDs and error codes
(`docs/architecture.md` §4). Zod only; no Node or browser APIs.

| File | What it is for |
| --- | --- |
| `package.json` | The `@cty1ng/shared` package and its entry points (`.`, `./bots`, `./case-folding`, `./catalog`, `./events`, `./ids`, `./errors`, `./settings`, `./skills`) |
| `tsconfig.json` | Type-check settings for this package |
| `src/` | The source |
| `src/index.ts` | Re-exports everything below |
| `src/events/` | The stream event envelope and every built event type (`docs/realtime-events.md` §1a, §4) |
| `src/events/index.ts` | Re-exports the event schemas |
| `src/events/stream-event.ts` | `StreamEvent`, the union of every event type, and `EVENT_TYPES` |
| `src/ids.ts` | One branded TypeID schema per table prefix (`BotId`, `MessageId`, …; D36) |
| `src/bots.ts` | Bot name rules (storage form, name key, slug, clone names, field limits and messages) and the bot API shapes (api.md §4) |
| `src/bots.test.ts` | Name key collisions and stability, slugs, clone names, field messages |
| `src/case-folding.ts` | Generated (`pnpm gen:case-folding`): the Unicode full case folding table for the name key |
| `src/catalog.ts` | The catalog file schemas (`config/models.yaml`, `config/tools.yaml`), effort levels, the `GET /models` and `GET /tools` shapes |
| `src/errors.ts` | API error codes with their HTTP status and the error shape (`docs/api.md` §1) |
| `src/settings.ts` | The settings built so far: Zod schema, defaults and ranges, and the ranges of a bot's own values (`docs/domain-model.md` §10) |
| `src/skills.ts` | Skill format rules (slug, description), the slug maker, copy names, the `Skill` and `SkillVersion` API shapes |

Start here: `src/events/stream-event.ts`. Do not: import from `backend/` or `frontend/`, or add
a type that is not in `docs/realtime-events.md` §4 first.
