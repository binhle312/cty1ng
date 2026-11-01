# bots

Bots (`docs/requirements/bots.md`, `docs/domain-model.md` §2): create, edit, Clone, pins to
skill versions, the pinned order, Trash, restore and purge.

| File | What it is for |
| --- | --- |
| `tool-settings.rules.ts` | Pure: the effective tool settings (steps 1–6) and the checks on a body's `tool_settings` |
| `tool-settings.rules.test.ts` | Tests of `tool-settings.rules.ts` |

Start here: `tool-settings.rules.ts`. Do not: update a bot's `model_id` or `effort` after insert
(`AGENTS.md` §5 rule 5).
