# settings

The owner's settings (`docs/api.md` §7, `docs/domain-model.md` §10). The keys, ranges and
defaults are in `shared/src/settings.ts`.

| File | What it is for |
| --- | --- |
| `settings.service.ts` | `readSettings` (a missing or out-of-range value reads as its default), `get`, and `update`, which emits `settings.updated` |
| `settings.service.test.ts` | Defaults, saved values after a restart, the event, an out-of-range stored value |

Start here: `settings.service.ts`. Do not: hardcode a value the owner may change; add its key to
`shared/src/settings.ts` (`AGENTS.md` §10).
