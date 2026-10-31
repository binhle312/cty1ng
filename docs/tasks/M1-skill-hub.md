# M1: Skill hub

Checkpoint: **plan** (schema).

## Goal

The owner can create, edit, version, restore, clone, deprecate, delete (to Trash), import and
export skills in the UI and the CLI. Versions are never updated, authorship is enforced, and the version model is ready
for bots to pin in M2.

## Read first

`docs/domain-model.md` §1, §3 (all), §10 (`trash_days`, the `skill_*` limits), §12 invariants
2, 5, 6, 19–21, 25; `docs/decisions/` D5, D6, D14, D41 (only for `skill_draft_id`, which M5c
adds), D49, D62 (the purge and the **Delete** label); `docs/design/components/skills-page.md`
and `buttons.md` (approved designs; the current previews are
`docs/design/previews/command-dark/skills-page-tabs.*`, and `skills-page.md` wins over the
round 8 previews `skills-*`); `docs/api.md` §1, §2; `docs/requirements/skill-hub.md`;
`docs/security.md` §2.2 (Markdown), §2.4 (skill zip), §2.5, §2.13; `docs/architecture.md` §6.1
(timed jobs), §8 (configuration), §11 (concurrency); `docs/testing.md` §3 (services and API).

## In scope

- Tables `skills` (with `row_version`) and `skill_versions`, without `skill_draft_id` (M5c adds
  it) and without `bot_skills` (M2 creates it with `bots`) (`domain-model.md` §3.1).
- Services and endpoints in `api.md` §2, except `upgrade-candidates` (returns an empty list
  until M2), `POST /skills/{id}/bots` (it needs bots) and the upgrade part of `POST /versions` (accepts
  `upgrade_bot_ids: []` only). A rename alone is a PATCH; a rename with new text is one
  `POST /versions` (`api.md` §2).
- `SKILL.md` parsing/serialising (frontmatter split and serialise), the slug rule and the
  reserved slugs (`domain-model.md` §3.1), and the `skill_*` limit settings (§10).
- The sensitive-data guard rules (D39) as pure functions in `core/`, used by the skill service
  for create, rename, version, version restore and import, with no override (`security.md` §2.13).
  M3 reuses them for messages.
- Import preview/apply (zip upload) with the in-memory preview (`domain-model.md` §3.5,
  `IMPORT_PREVIEW_MINUTES`, `IMPORT_PREVIEW_MAX`), and the zip route's own body limit and size
  checks: the 5 MB file part and the 5 MB + 64 KB request, 20 MB unpacked, a `SKILL.md` ≤ 1 MB;
  the other routes keep their limits (`security.md` §2.4).
- CLI `skills import <folder> [--apply]`, `skills export <folder> [--slug …]`, and the temporary
  `skills trash` and `skills restore <slug>` (`api.md` §2), which M5b removes.
- Pages, at the URLs in `skills-page.md` §1: skill list, page top and the tabs Skill, Bots
  (empty state, **+ Add** disabled) and History (diff, Compare, Restore), editor
  (create/edit/read-only for non-authors), Clone, import page, Export card. Markdown preview
  follows `security.md` §2.2: no raw HTML, only `http`, `https` and `mailto` links, and no
  external images.
- Delete to Trash, restore and purge (D49): the service and endpoints, and a purge job that runs
  at start and every `PURGE_INTERVAL_HOURS` (`architecture.md` §6.1, §8). M1's purge clears `skills.cloned_from_skill_version_id` only; M3 adds `run_skills` and
  M5c `skill_drafts` (`domain-model.md` §3.4). The Trash page itself is M5b; until then the
  delete toast has no link and restore is the CLI or the API.
- Events `skill.created|updated|deprecated|trashed|restored|purged` and `trash.changed`
  (`{counts: {skill: n}}`), added to `realtime-events.md` §4 and `shared/` together.
- `make seed` imports the skills in `seed/skills/` through the import service with `--apply`
  (`seed/README.md`): `working-principles`, `hand-off-work`, `write-user-stories`, and the three
  BA and Designer skills that this slice writes (`interview-stakeholder`, `design-ui-prototype`,
  `review-against-stories`), in the suggested layout (`requirements/skill-hub.md`, "Suggested
  skill layout"). A second `make seed` changes nothing.

## Out of scope

Bots, pins, `bot_skills`, the bot cards after a save (§7 of `skills-page.md`: M1 shows only the
toast), upgrade dialog behaviour (M2). The Trash page (M5b). Live updates of open pages after a
CLI write (accepted: a reload shows them).

## Acceptance criteria

- UI-7.1, UI-7.2, UI-7.3, UI-7.5, UI-7.6, UI-7.7, UI-7.8. UI-7.4: a save shows the toast only
  (no bots exist, `skills-page.md` §7). UI-7.5a: the Bots tab shows its empty state.
- UI-7.6a, except the restore suggestion card (M5b, Trash page).
- Invariants 2, 5, 19, 20 and 25 hold (tests named per `testing.md`); 6 and 21 are tested in M2
  with bots.
- Editing as a non-author returns 403 `not_author` (test by setting a different `author_id`).
- A rename creates no version; a rename with new text is one transaction.
- A reserved or malformed slug is refused on every create path (editor, Clone, import, seed).
- A likely secret in a skill is refused on every write path, with no override; one test per
  path, including a `PATCH /skills/{id}` with a secret in the name.
- Import: invalid files are reported and nothing is written; apply after the data changed since
  preview returns 409 `stale_write` (also when a skill was deleted and made again with the same
  slug); an expired or used preview returns 409 `preview_expired`; a deprecated or trashed slug
  is a conflict; zip-slip and oversized zips rejected, a `SKILL.md` over 1 MB is an invalid row; a zip of exactly
  5 MB passes.
- The editor's counters, errors and line warning use the `skill_*` settings: a test lowers
  `skill_name_max` and the editor and the server refuse the same name.
- The URL of a deprecated skill opens after a reload, with **Show deprecated** off.
- Clone saves nothing until Create; Create records `cloned_from_skill_version_id` and starts at
  v1; a taken copy slug gets `-copy-2`.
- Delete of an active skill returns 409 `not_deprecated`; a purged skill frees its slug.
- Restore of v2 when latest is v5 creates v6 with v2's content.
- A reload keeps the skill, the tab and the Compare pair (`skills-page.md` §1).

## Tests

Service tests for versioning, authorship, deprecation, import; race tests from
`architecture.md` §11 (two saves of version N+1 with the same `base_version`, two metadata
PATCHes with the same `row_version`: one wins, one 409 `stale_write`); API tests for error codes;
Vitest for the editor's frontmatter form and the slug maker (`đ`, the cut at 64); Playwright:
create skill → edit (v2) → diff → restore (v3) → export contains v3. Journey (`testing.md` §3,
`journey-first-use.spec.ts`): the "create skill" part of step 1 passes by the end of M1.

## Needs human review

The UI design in the plan (layout, components, states), approved before UI code is written
(`docs/workflow.md` §2; sketches in `docs/design/` are not specs).

Migration for skill tables, including `skills.row_version`, `skills.trashed_at`,
`skills.trashed_bot_ids` and `skills.updated_at` (D49); zip handling and the zip route's body
limit (security); the skill size limits (`security.md` §2.5); the sensitive-data guard rules.

New dependencies, with a CSP probe in the plan: a zip reader that streams and checks entry
sizes (proposed `yauzl`), a zip writer for export (proposed `yazl`), a line diff (proposed
`diff`), and a Markdown renderer (proposed `react-markdown`, without `rehype-raw`).

## Open questions

None. The M1 spec gap pass (owner, 2026-10-30) answered them in the owning documents.
