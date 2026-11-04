# Source

Third-party skill, vendored unchanged except for this file and `LICENSE`.

| | |
| --- | --- |
| Upstream | https://github.com/cursor/plugins (path `pstack/skills/typescript-best-practices`) |
| Commit | `0317eb8b858c991c57721358daaee19dbe8c814d` (2026-10-17) |
| Licence | MIT (Lauren Tan), copied from `pstack/LICENSE` to `LICENSE` |
| Reviewed | 2026-11-04: two Markdown files; no scripts, network calls, subprocesses, key access or package installs. |

To update: copy the folder from a newer upstream commit, review the diff, and update this table
in the same PR. Do not edit the skill in place.

## Project rules win

`docs/frontend-conventions.md` and `docs/security.md` win where this skill disagrees with them:

| The skill says | The project rule |
| --- | --- |
| Pass objects, not positional arguments | One object only for more than two parameters, or two of the same type (`frontend-conventions.md` §1) |
| A time range is a start plus a duration | Not adopted: the frontend and URL keep `{ from, to }` (`frontend-conventions.md` §1) |
| A brand comes from a type guard, with the `__brand` shape | A brand comes from a schema parse; ids live in `shared/src/ids.ts` (`frontend-conventions.md` §1) |
| Pick one discriminant name | `type` on SSE events, `status` on runs and messages, `kind` on messages and UI view state (`frontend-conventions.md` §1) |
| When the type comes first, annotate the schema with it | The type is inferred from the schema, never declared twice (`frontend-conventions.md` §1) |
| Parse wire formats with `ignoreUnknownFields` | API schemas are `.strict()` (`security.md` §2.8) |

The skill also names the `type-system-discipline` and `boundary-discipline` principle skills.
They are not in this project.

Its frontmatter has `disable-model-invocation: true`, so an agent does not load it by itself in
Claude Code. Open it with `/typescript-best-practices`, or read `SKILL.md` as
[the skills index](../README.md) says.
