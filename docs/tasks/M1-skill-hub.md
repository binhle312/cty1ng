# M1: Skill hub

Checkpoint: **plan** (schema).

## Goal

The owner can create, edit, version, restore, clone, deprecate, import and export skills in the
UI and the CLI. Versions are immutable, authorship is enforced, and the version model is ready
for bots to pin in M2.

## Read first

`docs/domain-model.md` §1, §3 (all), §12 invariants 2, 5, 6; `docs/decisions/` D5, D6, D14;
`docs/api.md` §1, §2; `docs/requirements/skill-hub.md`; `docs/security.md` §2.4 (skill zip), §2.5;
`docs/testing.md` §3 (services and API).

## In scope

- Tables `skills`, `skill_versions` (and `bot_skills` may be created now but is unused until
  M2; say which in the plan).
- Services and endpoints in `api.md` §2, except `upgrade-candidates` (returns an empty list
  until M2) and the upgrade part of `POST /versions` (accepts `upgrade_bot_ids: []` only).
- `SKILL.md` parsing/serialising (port `_split_frontmatter` from the prototype).
- Import preview/apply (zip upload) and CLI `app skills import|export <folder>`.
- Pages: skill list, editor (create/edit/read-only for non-authors), history with diff and
  restore, import preview, export.
- Events `skill.created|updated|deprecated`.
- `make seed` imports the prototype's BA and Designer skills.

## Out of scope

Bots, pins, upgrade dialog behaviour (M2).

## Acceptance criteria

- UI-7.1, UI-7.2, UI-7.3, UI-7.5, UI-7.6, UI-7.7, UI-7.8. UI-7.4 shows the dialog with an empty
  list.
- Invariants 2 and 5 hold (tests named per `testing.md`).
- Editing as a non-author returns 403 `not_author` (test by setting a different `author_id`).
- Import: invalid files are reported and nothing is written; apply after the data changed since
  preview returns 409; zip-slip and oversized zips rejected.
- Clone records `cloned_from_skill_version_id` and starts at v1.
- Restore of v2 when latest is v5 creates v6 with v2's content.

## Tests

Service tests for versioning, authorship, deprecation, import; race tests from
`architecture.md` §11 (two saves of version N+1 with the same `base_version`, two metadata
PATCHes with the same `row_version`: one wins, one 409 `stale_write`); API tests for error codes;
Vitest for the editor's frontmatter form; Playwright: create skill → edit (v2) → diff → restore
(v3) → export contains v3.

## Needs human review

The UI design in the plan (layout, components, states), approved before UI code is written
(`docs/workflow.md` §2; sketches in `docs/design/` are not specs).

Migration for skill tables; zip handling (security).

## Open questions

None.
