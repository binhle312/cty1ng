# skills

The Skill Hub (`docs/requirements/skill-hub.md`, `docs/domain-model.md` §3): skills, their
immutable versions, Clone, Deprecate, Trash, and import and export of `SKILL.md` folders.

| File | What it is for |
| --- | --- |
| `skills.service.ts` | Every skill use case: list, create, Clone, rename, new version, restore a version, diff, Deprecate, Trash, restore, purge, export |
| `skill-import.service.ts` | Import preview (kept in memory) and Apply in one transaction, with the full recheck (§3.5) |
| `skill.rules.ts` | Pure checks of a skill's name, description and body: limits, slug format, the D39 guard |
| `skill-md.ts` | Parses and writes `SKILL.md` (front matter `name`, `description`, then the body) |
| `skill-diff.ts` | The line diff between two versions (`diff` library) |
| `skill.rules.test.ts` | Tests of `skill.rules.ts` |
| `skill-md.test.ts` | Tests of `skill-md.ts` |

Start here: `skills.service.ts`. Do not: update or delete a skill version (`AGENTS.md` §5 rule 5);
only the Trash purge deletes one.
