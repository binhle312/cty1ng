# bots

Bots (`docs/requirements/bots.md`, `docs/domain-model.md` §2): create, edit, Clone, pins to
skill versions, the pinned order, Trash, restore and purge.

| File | What it is for |
| --- | --- |
| `bots.service.ts` | Every bot use case: list, get, create (idempotent), update, Trash, CLI restore, pinned order, clone template, pins, skill pin moves, purge |
| `bots.service.test.ts` | Service tests: name key and slug, idempotency, model and effort, pins and the clone rule, order, Trash, purge, the skill endpoints that move pins; races from two tabs (PATCH, pinned order, pin) and the all-or-nothing batch |
| `avatars.service.ts` | Avatar uploads (hash, stage, publish under the lock) and the cleanup of unused files; the failure table |
| `avatars.service.test.ts` | The M2 plan §4a tests: upload vs cleanup, save vs cleanup, publish and touch failures, rollback after publish, staged leftovers |
| `bot.rules.ts` | Pure: field limits and the guard, the effort, the Advanced ranges, the header order, the health line |
| `bot.rules.test.ts` | Tests of `bot.rules.ts` |
| `tool-settings.rules.ts` | Pure: the effective tool settings (steps 1–6) and the checks on a body's `tool_settings` |
| `tool-settings.rules.test.ts` | Tests of `tool-settings.rules.ts` |

Start here: `bots.service.ts`. Do not: update a bot's `model_id` or `effort` after insert
(`AGENTS.md` §5 rule 5).
