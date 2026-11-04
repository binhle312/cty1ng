# M1 plan: Skill hub

> **Record, not spec.** Copied from [#52, first comment](https://github.com/binhle312/cty1ng/pull/52#issuecomment-6537531597) on 2026-11-04. The owning documents win where they differ ([index](README.md)).
>
> **Approval:** approved by the owner on 2026-10-31 (`docs/status.md`, Done). §7 has the owner's decisions. Covers M1a and M1b.

Brief: `docs/tasks/M1-skill-hub.md` (updated by the spec gap pass, #51). Checkpoint: **plan**. The owner approves the schema, the dependencies and the UI design before the build.

## 0. Slice split (proposal)

M1 is large, and `workflow.md` §2 keeps UI and infrastructure in separate PRs:

| PR | Holds | Ends with |
| --- | --- | --- |
| **M1a** backend | schema + migration, guard rules, services, API, zip adapter, CLI, purge job, settings endpoint, seed | `make seed` works; every API and service test green; generated client has the skill endpoints |
| **M1b** frontend | Skills page, editor, History, import page, Export card, dialogs, Markdown preview | Playwright journey and the AC list green |

Each PR runs the full gate. This plan covers both; the UI design section (§5) is approved once.

## 1. Risk probes (done 2026-10-31; scratch files, nothing installed in the workspace)

| # | Question | Result |
| --- | --- | --- |
| P1 | Can M5c add `skill_versions.skill_draft_id` with its FK later (spec gap #4)? | ✅ drizzle-kit 0.31.11 writes `ALTER TABLE skill_versions ADD skill_draft_id text REFERENCES skill_drafts(id)`, no table rebuild. In SQLite (better-sqlite3, `foreign_keys=ON`) the old rows keep NULL, a bad draft id is refused, a good one passes |
| P2 | Markdown preview under our CSP and `security.md` §2.2 | ⚠️→✅ react-markdown 10.1.0 + remark-gfm 4.0.1: no `eval`/`new Function` in the 110-package tree, `npm audit` clean, raw HTML escaped. **But the defaults break §2.2 three ways:** external images load (`<img src="https://…">` + a React preload link), `javascript:`/`data:` links become `<a href="">`, and table alignment is a `style` attribute. **Fix, proven:** a 10-line rehype plugin (align → class), an `a` component (only `http`/`https`/`mailto` become links, others are text, `rel="noopener noreferrer"`), an `img` component (alt text + URL, never loaded). Output: no `style=`, no `<img`, no preload, hrefs only `https:`/`mailto:`. Relative links (`./x.md`) become text too |
| P3 | Zip reading and writing | ✅ yauzl 3.4.0 (`strictFileNames`, `lazyEntries`): `../../evil/SKILL.md` → error "invalid relative path"; `/etc/SKILL.md` → "absolute path"; a 30 MB entry → refused by our total check before reading; a header that lies about the size → yauzl stops the stream ("too many bytes"). yazl 3.3.1 writes a zip that yauzl reads back |
| P4 | Ratio cap 100:1 (`security.md` §2.4) on real skills | ⚠️ A valid 20 KB skill can pass 100:1: a long checklist measured 254:1, a table 276:1. The real seed skill is 2:1. **Decided:** replace it (§7 item 2) |
| P5 | Import route body limits in Hono | ✅ With the global 1 MB limit skipped for upload routes and `bodyLimit(5 MB + 64 KB)` on the route plus a file-part check: a 5 MB zip → 200; 5 MB + 1 → 413; a 6 MB request → 413; a 7 MB chunked body with no length → 413; 1 MB + 1 JSON on a JSON route → 413; a 5 MB multipart on a JSON route → 413 |
| P6 | Generated client (Hey API 0.99.0) for the zip upload and the zip download, **against real Hono routes** (corrected 2026-10-31 after review: the first run used a mock `fetch`, a `z.string()` file schema on the server, and an export declared as multipart) | ⚠️→✅ Two fixes, both needed. (1) **Client:** the Zod plugin makes `format: binary` into `z.string()`, so the SDK refuses the `File` before sending; a `$resolvers.string` hook in `scripts/gen-api.ts` maps `format: binary` to `z.instanceof(Blob)` and leaves every other string alone. (2) **Server:** the file part is `z.instanceof(File).openapi({ type: "string", format: "binary" })`; a `z.string()` part refuses the `File` with 400. The export response is declared `application/zip`. Result, client → `app.request` with no mock: upload 200 with name and size, download 200 `application/zip` as a `Blob`, a text part or no part → 422 `validation_error`. M1a keeps this as an integration test (§4) |
| P7 | Base UI parts M1 adds under the CSP | ✅ The only CSP risk in Base UI 1.9.0 is the injected `<style>` in `utils/styles.mjs` (hide scrollbar), used only by Select, ScrollArea and Drawer. Dialog, AlertDialog, Tabs, Checkbox, Switch and Toast set styles through React (CSSOM), as Menu does today, and Menu passes the M0c CSP e2e. The e2e CSP watch confirms each in the build |

## 2. Schema (needs approval; `domain-model.md` §3.1)

One migration, `skills` and `skill_versions` only:

```text
skills          id PK NOT NULL, slug UNIQUE NOT NULL, name NOT NULL, author_id NOT NULL,
                cloned_from_skill_version_id NULL → skill_versions(id),
                row_version INTEGER NOT NULL DEFAULT 1,
                created_at, updated_at, deprecated_at NULL, trashed_at NULL, trashed_bot_ids JSON NULL
                CHECK (trashed_at IS NULL OR deprecated_at IS NOT NULL)
skill_versions  id PK NOT NULL, skill_id NOT NULL → skills(id), version INTEGER NOT NULL,
                description NOT NULL, body_md NOT NULL, changelog NULL, created_by NOT NULL, created_at,
                UNIQUE (skill_id, version), UNIQUE (skill_id, id)
```

Not in M1: `skill_draft_id` (M5c, proven by P1), `bot_skills` (M2). The `CHECK` makes D49's "set only when deprecated" a database rule (new; say no and it stays a service rule). Settings rows: the defaults of `trash_days`, `skill_name_max`, `skill_body_max`, `skill_body_warn_lines` are read with a fallback to their default; no seed rows.

## 3. Backend (M1a)

```text
shared/src/
  skills.ts                 SKILL_FORMAT, slug rule, slugFromName (đ→d, cut at 64), Skill/version schemas
  errors.ts                 + preview_expired (the rest exist)
  events/stream-event.ts    + skill.trashed|restored|purged, trash.changed (and docs §4 in the same commit)
backend/src/core/
  guard/sensitive-data.rules.ts   D39 patterns (pure); kinds only, never the matched text in logs
  skills/skill.rules.ts           limits, next free slug (-copy-2), stale checks: pure
  skills/skill-md.ts              SKILL.md frontmatter split and serialise (yaml core schema)
  skills/skills.service.ts        create, rename, new version (+ rename in one tx), restore version,
                                  deprecate, undeprecate, trash, restore, purge; author checks; events
  skills/skill-import.service.ts  preview (in-memory store, IMPORT_PREVIEW_*), apply (full recheck)
  skills/skill-diff.ts            line diff with the `diff` package → DiffLine[]
  settings/settings.service.ts    GET and PATCH for the keys built so far (open question 3)
  trash/purge.service.ts          purge skills past trashed_at + trash_days (one per tx, with events)
backend/src/adapters/
  db/schema.ts, repositories.ts   tables + skills repository
  http/routes/skills.ts           api.md §2 (handlers parse, call one service, map)
  http/routes/settings.ts         GET/PATCH /settings
  http/uploads/skill-zip.ts       yauzl read (limits, zip slip, skip non-SKILL.md), yazl write
  http/middleware.ts              maxBody() skips the upload routes, which set their own limit
backend/src/app/
  cli.ts                          skills import [--apply] | export [--slug] | trash | restore <slug>
  main.ts, config.ts              purge timer; PURGE_INTERVAL_HOURS, IMPORT_PREVIEW_MINUTES, IMPORT_PREVIEW_MAX
scripts/gen-api.ts                the binary resolver (P6)
.dependency-cruiser.cjs           yauzl, yazl become adapter-only libraries
seed/skills/                      + interview-stakeholder, design-ui-prototype, review-against-stories
Makefile                          seed → cli skills import seed/skills --apply (idempotent)
```

The CLI reads folders and builds the same `{path, bytes}` list as the zip adapter, so the import service never touches files (`core-not-to-fs`).

## 4. Tests

- **Rules (Vitest):** slug maker (`Viết câu chuyện`, `Đặt lịch`, a 70-char name, Japanese → empty), slug rule and reserved slugs, next free slug (`-copy`, `-copy-2`, cut before the suffix), guard patterns (each kind + Luhn), limits from settings.
- **Skills service:** versioning; rename without a version; rename + version in one tx (a guard refusal in the body leaves the name unchanged); authorship 403 on every write; deprecate/undeprecate; trash only when deprecated; restore; invariants 2, 5, 19, 20, 25; the `CHECK` refuses `trashed_at` without `deprecated_at`.
- **Clone:** Create from a version records `cloned_from_skill_version_id`, starts at v1 with the cloner as author; a taken copy slug gets `-copy-2`; nothing is written before Create.
- **Purge:** a skill past `trash_days` is purged, one per transaction, with `skill.purged` and `trash.changed`; its slug is free again. **Purge of a clone's source:** the clone survives, its `cloned_from_skill_version_id` becomes NULL, and its versions and text are unchanged. A skill not yet due is untouched.
- **Import:** preview writes nothing; apply writes only ticked rows; a deleted-and-recreated slug, a rename, a deprecate or a new version after the preview → `stale_write`; expired, unknown or used preview → `preview_expired`; deprecated or trashed slug → conflict; the store keeps at most `IMPORT_PREVIEW_MAX`. **Zip** (`security.md` §2.4 and §3, updated): 200-entry limit, 20 MB total, a `SKILL.md` over 1 MB is `invalid` and not read, a lying size header is stopped, zip slip and absolute paths refused, non-`SKILL.md` files listed as skipped and never opened.
- **Settings (`GET`/`PATCH /settings`, M1a keys only):** defaults when no row exists; a PATCH persists and the next GET returns it; each key's range (below, above, not a whole number → 422 with the key); unknown key → 422; one `settings.updated` event per successful PATCH, none on a refused one; a lowered `skill_name_max` makes the next save of a longer name fail with the same rule the editor uses.
- **Events:** each skill write emits its event in the same transaction (`skill.created|updated|deprecated|trashed|restored|purged`, `trash.changed` with `{counts: {skill: n}}`); a refused write emits none.
- **Races (`architecture.md` §11):** two `POST /versions` with the same `base_version`; two PATCHes with the same `row_version`: one wins, one 409.
- **API:** every error code of §2; the guard on each write path incl. a PATCH with a secret in the name; the body limits (P5 shapes); 404 for a trashed skill. **Generated client integration (P6):** the SDK's `previewSkillImport` with a `File` and `exportSkills` against the real Hono app (`app.request`), no mock responses.
- **CLI:** import without `--apply` writes nothing; export refuses a non-empty folder; `trash` and `restore`; `make seed` twice changes nothing.
- **Frontend (M1b):** Vitest for the editor form and counters from settings; the Markdown wrapper (the P2 cases). Playwright: create → edit (v2) → diff → restore (v3) → export has v3; Clone opens filled, Create makes v1 of the copy; **reload keeps the skill, the tab and the Compare pair** (`/skills/{slug}?tab=history&from=1&to=3`); a deprecated skill's URL opens after a reload with Show deprecated off; CSP watch on every page; journey step 1 "create skill".

## 5. UI design (approval before UI code)

The design is the agreed `skills-page.md` (rounds 8 and 16) plus the spec gap answers; M1 builds it as written. Layout:

```text
┌ rail ┬ Skills (300) ───────────┬ page top: Name  v3  · slug · by You · used by 0 bots      ⋯ ┐
│      │ Skills          + Create│ [Skill] [Bots 0] [History 3]                                 │
│      │ 🔍 Search skills        │                                                              │
│      │ ☐ Show deprecated       │  Name ............................................ 12 / 64  │
│      │ Import   Export         │  Description ..................................... 80 / 1,024│
│      │ ▌write-user-stories v3  │  Body  [Write][Preview]                    Markdown          │
│      │  hand-off-work      v1  │  ┌──────────────────────────────────────────────────────┐   │
│      │  working-principles v1  │  │ (preview, safe Markdown)                             │   │
│      │                         │  └──────────────────────────────────────────────────────┘   │
│      │                         ├─ ● 2 changes not saved  [What changed? …]  Discard  Save as v4┤
└──────┴─────────────────────────┴──────────────────────────────────────────────────────────────┘
```

New UI parts in `components/ui/`: Dialog, AlertDialog, Tabs, Checkbox, Switch, Toast (Base UI, P7), Markdown (P2). M1-only states: the toast after Create and Save ("Created {name} ✨", "Saved v{n} ✨"), Bots tab "No bot uses this skill yet." with **+ Add** off ("Create a bot first."), no "Remove from bots" in the banner, delete dialog without a bot list, **Trash** as plain text in the delete toast.

## 6. Risks

- Hey API upgrades could change the resolver hook (`$resolvers` is documented, `~resolvers` is the old name); the generated-client check in CI catches a change.
- The in-memory preview store is lost on restart (accepted: Apply returns `preview_expired`).
- CLI writes don't reach open pages (accepted for M1).
- The guard can flag harmless text (D39 limits); a skill has no override, so a false match blocks a save. The error names the line, so the owner can reword it.

## 7. Decisions (owner, 2026-10-31)

1. **Dependencies:** approved: `yauzl` 3.4.0, `yazl` 3.3.1, `diff` 9.0.0, `react-markdown` 10.1.0, `remark-gfm` 4.0.1. The Markdown wrapper (P2) stays.
2. **Zip bomb rule:** the 100:1 ratio goes. A `SKILL.md` entry over 1 MB uncompressed is `invalid` (too large) and not read. Kept: 200 entries, 20 MB total, the skipped-file rule, the streamed size checks. `security.md` §2.4 and §3 and the M1 brief's acceptance criteria change together in M1a.
3. **Settings endpoint:** `GET` and `PATCH /settings` in M1a, limited to `trash_days`, `skill_name_max`, `skill_body_max`, `skill_body_warn_lines`; tests in §4.
4. **Split:** M1a (backend) then M1b (frontend).
5. **`CHECK (trashed_at IS NULL OR deprecated_at IS NOT NULL)`** in the migration.

Schema and UI design: no conflict found in review; the generated SQL is reviewed in the M1a PR.
