# M1: Skill hub

Checkpoint: **plan** (schema).

## Goal

The owner can create, edit, version, restore, clone, deprecate, delete (to Trash), import and
export skills in the UI and the CLI. Versions are never updated, authorship is enforced, and the version model is ready
for bots to pin in M2.

## Read first

`docs/domain-model.md` §1, §3 (all), §10 (`trash_days`), §12 invariants 2, 5, 6, 19–21;
`docs/decisions/` D5, D6, D14, D49; `docs/design/components/skills-page.md` and `buttons.md`
(approved designs, previews in `docs/design/previews/command-dark/skills-*`);
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
- Delete to Trash, restore and purge (D49): the service and endpoints, and a purge job that runs
  at start and once a day. `run_skills` gets its copy columns when M3 creates it. The
  Trash page itself is M5b; until then the permanent delete (**Delete** on the Trash page, D62) has no UI.
- Events `skill.created|updated|deprecated|trashed|restored|purged`.
- `make seed` imports the skills in `seed/skills/` (`seed/README.md`): `working-principles`,
  `hand-off-work`, `write-user-stories`, and the prototype's other BA and Designer skills, rewritten in the
  suggested layout (`requirements/skill-hub.md`, "Suggested skill layout").

## Out of scope

Bots, pins, upgrade dialog behaviour (M2).

## Acceptance criteria

- UI-7.1, UI-7.2, UI-7.3, UI-7.5, UI-7.6, UI-7.7, UI-7.8. UI-7.4 shows the dialog with an empty
  list.
- UI-7.6a, except the restore suggestion card (M5b, Trash page).
- Invariants 2, 5, 19, 20 hold (tests named per `testing.md`); 21 is tested in M2 with bots.
- Editing as a non-author returns 403 `not_author` (test by setting a different `author_id`).
- Import: invalid files are reported and nothing is written; apply after the data changed since
  preview returns 409; zip-slip and oversized zips rejected.
- Clone saves nothing until Create; Create records `cloned_from_skill_version_id` and starts at v1.
- Delete of an active skill returns 409 `not_deprecated`; a purged skill frees its slug.
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

Migration for skill tables, including `skills.trashed_at`, `skills.trashed_bot_ids`,
and `skills.updated_at` (D49); zip handling (security); the skill
size limits (`security.md` §2.5).

## Open questions

None.
