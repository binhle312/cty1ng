# M2 plan: Bots

> **Record, not spec.** Copied from [#57, first comment](https://github.com/binhle312/cty1ng/pull/57#issuecomment-6551029909) on 2026-11-04. The owning documents win where they differ ([index](README.md)).
>
> **Approval:** approved by the owner on 2026-11-01 (revision 4, decisions 1-15). Covers M2a, M2b and M2c.

**Approved by the owner on 2026-11-01** (revision 4, with decisions 1–15). The build starts with M2a.

Brief: `docs/tasks/M2-bots.md` (updated by the spec gap pass, #56). Checkpoint: **plan** (schema, uploads). The owner approves the split, the schema, the dependencies, the catalog contents and the UI design before the build.

**Revision 4 (2026-11-01):** a **Guide** seed bot comes first, with an Always load skill `using-the-app` that explains the app (decisions 12–15).

**Revision 3 (2026-11-01):** Google Gemini joins Anthropic in the M2 catalog (owner: the first bots use Gemini; later Google, Anthropic, OpenAI and DeepSeek). P8, §2, §7 and §9 items 8–11 are new.

**Revision 2 (2026-11-01), after the plan review:** M2a now keeps the Skills page correct on its own (§0a), the avatar file contract is complete (§4a), and §9 holds the decisions.

## 0. Slice split

M2 is larger than M1. [planning workflow](../workflows/planning.md#slice-size) keeps UI and infrastructure apart, and the pages are two groups that share nothing but the API:

| PR | Branch | Holds | Ends with |
| --- | --- | --- | --- |
| **M2a** backend | `m2a-bots-backend` | catalog + tool catalog, schema + migration, name key, slug, effective tools, bots service and API, avatars (`sharp`), purge (bot tombstone, avatar cleanup), bot settings keys, the skill endpoints that now touch pins, events, CLI `bots trash|restore`, seed bots; **and the Skills page changes that the backend makes necessary (§0a)** | every API and service test green; `make seed` makes BA and Designer; generated client has the bot endpoints; the Skills page tells the truth about seeded bots |
| **M2b** Bots page, header, Create | `m2b-bots-pages` | Bots page (grid, pins, sort, health, search, empty), header roster (tooltips, badges, pinned zone, deferred order, keyboard), bot card, Create page (4 steps, preview, tools, Advanced, idempotent send, leave guard), Clone mode, the avatar parts (colour row, Custom card, upload crop card) | Playwright: create skill → create bot → clone with the other fake model |
| **M2c** bot page, Skills with bots | `m2c-bot-page` | bot page (edit layout, Profile / Skills / Model / Activity / Usage tabs, save bar, conflicts, colour band, unavailable banner), the upgrade card C4 and the assign card C4b after a skill save or Create | Playwright journey J4 (upgrade flow); the full AC list green |

**Dependencies:** M2b starts from merged M2a (it needs the generated client). M2c starts from merged M2b (it reuses the bot list, the avatar, the colour row and the crop card). Each PR leaves `main` working on its own; nothing waits for a later PR to be correct.

Each PR runs the full gate. This plan covers all three; the UI design (§6) is approved once.

### 0a. What M2a changes in the Skills page (plan review, finding 1 and 2)

M2a's seed makes bots, so after M2a alone the Skills page must not say "No bot uses it" or drop pins without a word. M2a takes these frontend changes, all from the agreed `skills-page.md` (UI-7.5a, UI-7.6, UI-7.6a), so no new design:

| Change | Why it cannot wait |
| --- | --- |
| `skill-page.tsx:209` stops sending `upgrade_bot_ids`; `pnpm gen:api` in the same commit | M2a removes the field; the `.strict()` body would refuse the Save with 422 |
| Deprecate dialog lists the bots that use the skill, with tick boxes, and sends `remove_bot_ids` (UI-7.6) | today it says "No bot uses it." |
| Delete dialog names the bots whose pins it removes (UI-7.6a) | today it warns about nothing |
| Bots tab rows (UI-7.5a): Upgrade to vN, Always load, Change version, Remove, + Add, and the M1-only "Create a bot first." goes | today it says "No bot uses this skill yet." while bots use it |

This is an exception to "UI and infrastructure in separate PRs" ([planning workflow](../workflows/planning.md#slice-size)): it is the smallest set that keeps `main` correct after M2a. Tests: the M1 Skills e2e passes after M2a alone (save v2, deprecate, delete), plus Vitest for the two dialogs with and without bots and an e2e "seeded bot shows on the Bots tab; deprecate with BA ticked removes its pin". The upgrade and assign cards after a save (C4, C4b) stay in M2c: without them nothing is wrong, a save simply moves no pin, and the Bots tab already offers "Upgrade to vN".

## 1. Risk probes (done 2026-11-01; scratch files, nothing installed in the workspace)

| # | Question | Result |
| --- | --- | --- |
| P1 | Current Anthropic model ids, the effort parameter, and how the AI SDK passes it | ✅ Four current models (§2), each with efforts `low, medium, high, xhigh, max` in `output_config.effort`; the default differs per model (Opus 5.5 and Haiku 5.5 medium, Sonnet 5.5 and Fable 5.1 high). Thinking is adaptive; `budget_tokens` → 400 on all four. `ai` 7.0.143 + `@ai-sdk/anthropic` 4.0.82 (both 2026-10-16; the newest are under two weeks old): `providerOptions: { anthropic: { effort } }` type-checks (`AnthropicLanguageModelOptions`, `index.d.ts:592`, effort `:659`), sent as `output_config.effort` (`index.js:3782`). Do not also use the top-level `reasoning` option (it is ignored when `effort` is set). The SDK silently lowers `xhigh`/`max` to `high` when thinking is off, as a warning only: M3's adapter must check warnings. No install scripts, `npm audit` clean. `ai` pulls `@ai-sdk/gateway` and `@vercel/oidc`, unused. Sources: platform.claude.com `about-claude/models/overview`, `build-with-claude/effort`, `agents-and-tools/tool-use/*`, `mcp-connector` (read 2026-11-01) |
| P2 | `sharp` for avatars (`security.md` §2.4) | ✅ with three fixes. `sharp` 0.35.5 (2026-09-27, Apache-2.0; bundles libvips 8.18.7, **LGPL-3.0-or-later**, as a prebuilt `@img/sharp-libvips-linux-x64`). **No install script**: it works with `allowBuilds` unchanged. **Type:** a `metadata().format` allowlist alone is not enough, because sharp parses SVG, GIF, TIFF, AVIF. Fix, proven: at start `sharp.block({operation: ['VipsForeignLoad']})` then unblock only the PNG, JPEG and WebP buffer loaders; plus a magic-byte check, plus `metadata().format` must equal the magic-byte type. SVG, SVG renamed `.png`, GIF, TIFF, AVIF, HEIC and text renamed `.png` → refused, no SVG loader runs. **Pixel limit:** `limitInputPixels: 25_000_000` refuses a 6000×6000 PNG, and a 1×1 PNG whose header says 100000×100000, in ~3 ms and ~1 MB (a full decode is 195 ms, +114 MB): the check is on the header. **Re-encode:** `fit: cover` 256×256 WebP strips EXIF, ICC, XMP; animated WebP → first frame. **Orientation:** `autoOrient: true` is needed, else a phone photo is sideways. **Same bytes in → same SHA-256 out**, across processes (a sharp upgrade may change bytes; then a new upload just makes a new file). 2 MB 4000×3000 JPEG: 56–76 ms. Options: `failOn: 'error'`, `animated: false`, `autoOrient: true` |
| P3 | Name key case folding (`domain-model.md` §2) | ✅ **generated table**, ⚠️ two spec fixes. A table from `CaseFolding-17.0.0.txt` (Node 24: Unicode 17.0, ICU 78.3): 1,585 C+F entries, 17.6 KB, no dependency, 0 differences from Python's `str.casefold()` (also Unicode 17); 100k keys in 178 ms. The library `unicode-case-folding` 1.1.2 builds from "latest" (Unicode 18) and differs on 21 code points from Node's NFKC; others are unmaintained. A test asserts the table's version equals `process.versions.unicode`. All brief pairs pass; "İ" → "i̇" (not equal to "i"), stable. **Fix 1:** the spec order is not idempotent for 50 code points (the last NFKC can make spaces: "A ´" → `"a␣␣́"`); trim and collapse once more after the last NFKC, and every code point is stable. **Fix 2:** white space is `\p{White_Space}` (JS `\s` misses U+0085 and counts U+FEFF) |
| P4 | Drizzle for `bots` and `bot_skills` | ✅ with two code notes. drizzle-kit 0.31.11 writes the composite PK, the composite FK to `skill_versions(skill_id, id)`, the named CHECKs, the self FK and the partial unique indexes; on the repo's schema the migration is only CREATE TABLE / CREATE INDEX (no rebuild); `db:check` passes. With `foreign_keys=ON`: a pin to another skill's version is refused (insert and update); `bots_name_kept` refuses a live or Trash duplicate and allows it after a purge. ⚠️ SQLite checks uniqueness **row by row**, so `SET pinned_position = pinned_position - 1` (closing the gap after a delete) fails: the delete uses the same "all NULL, then 1…n" rewrite as `PUT /bots/pins`. ⚠️ A constraint error is `SqliteError.code` from the query builder but `DrizzleError.cause.code` from `db.run(sql…)`: one mapper reads both and tells `name_key`, `slug` and `create_key` apart |
| P5 | Drag to pin, unpin and reorder under our CSP (production build, exact CSP header, Playwright Chromium, `securitypolicyviolation` watch as `watchCsp`) | ✅ `@dnd-kit/core` 6.3.1 + `@dnd-kit/sortable` 10.0.0 (+ `@dnd-kit/utilities` 3.2.2), MIT, ~17 kB gzip: **0 violations**; its live region and hidden instructions use React `style` props (CSSOM). Drag Others → Pinned pins at the drop place; Space picks up, Esc cancels, the live region reads the move. Rejected: `@dnd-kit/react` 0.x (injects `<style>` elements: 3 violations; only a nonce turns it off) and native HTML5 drag (no keyboard, weak touch). Build notes: move items only in `onDragEnd` (moving across groups in `onDragOver` looped, React #185); wrap `listeners.onKeyDown` so Alt+←/→ runs first; own announcements; TouchSensor with ~300 ms delay. Risk: the stable line has had no release since 2024-12 |
| P6 | Crop card and Custom colour card under our CSP | ✅ **own components**. `<img src=blob:…>` is blocked by `img-src 'self' data:` (control case: 1 violation), so the file is read with `FileReader.readAsDataURL`. Own crop card (~1.8 kB): pointer drag with `setPointerCapture`, arrow keys, Base UI Slider for zoom, round mask in CSS, `canvas` → `toBlob('image/png')` → `File` → multipart: 0 violations, the server got a 256×256 PNG. `react-easy-crop` injects a `<style>` (1 violation) unless `disableAutomaticStylesInjection` + its CSS file. `react-colorful` always injects a `<style>` (1 violation, the picker collapses to 0 px); only a nonce fixes it. Own colour card (~2 kB): S/V box with `role="slider"`, Base UI Slider hue bar, R/G/B/Hex in step (HSV state, so the hue survives grey), in a Base UI Popover: 0 violations |
| P7 | Base UI Popover and Slider (new to the repo) | ✅ Neither imports `utils/styles.mjs` (the injected `<style>` of Select and ScrollArea). Slider's `PrehydrationScript` renders only when hydrating server HTML, never in our client-only app. 0 violations at runtime. Side finding (not for M2): `CSPProvider disableStyleElements` removes Select's `<style>`, which could reopen Select later with a decision |
| P8 | Google Gemini: current models, thinking setting, AI SDK package | ✅ Three GA models (§2); no preview models, because a preview can be deprecated with two weeks' notice and a bot's model never changes. Thinking is `providerOptions.google.thinkingConfig.thinkingLevel` (`minimal`, `low`, `medium`, `high`; Flash-Lite only has `minimal`; thinking cannot be turned off on Gemini 3+). `@ai-sdk/google` 4.0.99 (2026-10-16) uses the same `@ai-sdk/provider` and `provider-utils` as `ai` 7.0.143 (no duplicates), no install scripts, `npm audit` clean; `thinkingConfig` at `dist/index.d.ts:19-23`, model ids at `:16`. `providerOptions.google` is untyped in `streamText`, so `effort.ts` types it with `satisfies GoogleLanguageModelOptions` (a bad level then fails to compile). Do not use the top-level `reasoning` option: the SDK maps it to `minimal` for Argon, which Argon does not support. Key: `createGoogle({ apiKey })` takes any variable. Sources: ai.google.dev `gemini-api/docs/models`, `thinking`, `pricing`, `changelog`, `terms`, `api-key` (read 2026-11-01) |

## 2. Catalog (needs approval: contents)

Checked in the Anthropic docs on 2026-11-01 (models overview, effort, tool reference, each tool page; sources in P1). The current family, no legacy models; Fable 5.1 left out for now (decision 3):

| id | label | efforts | default | multimodal | context | provider_tools |
| --- | --- | --- | --- | --- | --- | --- |
| `anthropic:claude-opus-5-5` | Claude Opus 5.5 | low, medium, high, xhigh, max | medium | ✓ | 1,000,000 | all six |
| `anthropic:claude-sonnet-5-5` | Claude Sonnet 5.5 | the same five | high | ✓ | 1,000,000 | all six |
| `anthropic:claude-haiku-5-5` | Claude Haiku 5.5 | the same five | medium | ✓ | 1,000,000 | all six |
| `google:gemini-3.8-flash` | Gemini 3.8 Flash | low, medium, high | medium | ✓ | 1,048,576 | Google three |
| `google:gemini-4-argon` | Gemini 4 Argon | low, medium, high | medium | ✓ | 1,048,576 | Google three |
| `google:gemini-3.5-flash-lite` | Gemini 3.5 Flash-Lite | minimal, low, medium, high | minimal | ✓ | 1,048,576 | Google three |

Google entries: `api_key_env: GEMINI_API_KEY` (Google's own name; the adapter passes it to `createGoogle`). "Google three": `google_search`, `url_context`, `google_code_execution` (decision 10), `switch: later`. Argon has no free tier.

"All six": `web_search`, `web_fetch`, `code_execution`, `mcp_connector`, `advisor`, `tool_search`, all `switch: later` or `locked` in M2. Order in the file = catalog order (the seed takes the first available one).

**What this changes in the spec** (docs updated in M2a): the example `efforts: [low, medium, high]` in `domain-model.md` §4 becomes the five real levels; `default_effort` is per model; no current model has `efforts: []` (the fake `fake:scripted` keeps that path tested). The effort mapping always sends the stored effort, never leaves it out.

**Provider-neutral adapter** (owner: Google, Anthropic, OpenAI and DeepSeek over time): `adapters/model/ai-sdk/providers.ts` holds one row per provider (SDK factory, effort mapping); `effort.ts` maps each catalog value per provider with one test each. A new provider adds a row, a package, catalog entries and a test; the bots service, the catalog rules and the UI do not change. `domain-model.md` §4 "Providers in M2" and the M2 brief change from "Anthropic only" to "Anthropic and Google" in M2a.

## 3. Schema (needs approval; `domain-model.md` §2, §3.1)

One migration, `bots` and `bot_skills`, as the spec writes them (approved columns: PR #20, #56):

```text
bots        id PK, slug UNIQUE, name, name_key, row_version DEFAULT 1, description, persona_md,
            avatar_style DEFAULT 'flat', avatar_colour, avatar_path NULL, model_id, effort NULL,
            request_limit, max_reply_chars, history_share_pct, tool_settings JSON,
            cloned_from_bot_id NULL → bots(id), create_key NULL UNIQUE, create_request_hash NULL,
            pinned_position NULL, created_by, created_at, updated_at, deleted_at NULL, purged_at NULL
            CHECK (purged_at IS NULL OR deleted_at IS NOT NULL)
            CHECK ((create_key IS NULL) = (create_request_hash IS NULL))
            UNIQUE INDEX bots_name_kept ON bots(name_key) WHERE purged_at IS NULL
            UNIQUE INDEX bots_pinned_position ON bots(pinned_position) WHERE pinned_position IS NOT NULL
bot_skills  bot_id → bots(id), skill_id → skills(id), skill_version_id, always_load DEFAULT false,
            added_at, updated_at, PRIMARY KEY (bot_id, skill_id),
            FOREIGN KEY (skill_id, skill_version_id) → skill_versions(skill_id, id)
```

Not in M2: `memory_history_versions` (M5b), no `write_paths` (D52). Extra CHECKs (decision 6): `CHECK (avatar_style IN ('flat','jelly','pixel','upload'))` and `CHECK ((avatar_style = 'upload') = (avatar_path IS NOT NULL))`. The service still checks both first, for a useful error, and the API still refuses `jelly` and `pixel` in M2.

Settings: the bot keys of `domain-model.md` §10 join `GET`/`PATCH /settings` with their ranges and cross-field checks, plus `bot_order` and `bot_order_direction`. No seed rows; defaults are read with a fallback, as in M1.

## 4. Backend (M2a)

```text
config/
  models.yaml                       Anthropic entries (§2); fake entries are added in code with FAKE_MODEL=1
  tools.yaml                        files, view_images, skills, hand_off, memory (internal, open);
                                    web_search, web_fetch, code_execution, advisor, tool_search (provider, later);
                                    mcp_connector (provider, locked)
shared/src/
  bots.ts                           Bot, BotPin, CreateBot, PatchBot, PinsBody schemas; BOT_SLUG_MAX, avatar styles
  catalog.ts                        CatalogEntry, ToolEntry (GET /models, GET /tools)
  errors.ts                         + idempotency_key_reused, bot_list_changed, bot_deleted, bot_purged,
                                    effort_not_supported, model_not_available, tool_job_conflict,
                                    tool_not_available (the ones M1 has not added)
  events/stream-event.ts            + bot.created|updated|deleted|restored|purged, bots.reordered,
                                    trash.changed counts.bot (and realtime-events.md §4 in the same commit)
backend/src/core/
  ports/avatar-files.ts             stage, publish, exists, touch, list, remove (§4a); fake + contract suite
  catalog/catalog.rules.ts          parse + check models.yaml and tools.yaml (Zod), availability from
                                    a key-presence map (no process.env in core), the fake entries
  bots/name-key.rules.ts            botNameKey(), normaliseName() (P3)
  bots/case-folding.ts              generated from CaseFolding-17.0.0.txt (P3); its version = Node's Unicode
  bots/bot-slug.rules.ts            slugFromBotName(), next free slug ≤ BOT_SLUG_MAX, `new` reserved
  bots/tool-settings.rules.ts       effectiveToolSettings() steps 1–6, checkToolSettingsBody()
  bots/bot.rules.ts                 limits from settings (only the fields sent), clone name, header
                                    order, health lines, canonical body hash input
  bots/bots.service.ts              list, get, create (idempotency first), patch, delete, clone template,
                                    pins (PUT one, DELETE one), pinned order, restore, purge
  skills/skills.service.ts          + assign/upgrade (POST /skills/{id}/bots), real bots_using /
                                    bots_outdated / upgrade candidates, deprecate remove_bot_ids,
                                    trash removes pins + trashed_bot_ids, restore suggests live bots;
                                    − upgrade_bot_ids
  settings/settings.service.ts      + bot_* and health_* keys, bot_order, bot_order_direction, the
                                    cross-field checks
  trash/purge.service.ts            + bots (tombstone, bot_skills delete), avatar orphan cleanup
backend/src/adapters/
  db/schema.ts, repositories.ts     bots, bot_skills; migration 0002
  db/constraint-errors.ts           SqliteError.code or DrizzleError.cause.code → name_taken / slug retry / key (P4)
  http/routes/bots.ts               api.md §4 (bots, pins, clone template, skill pins)
  http/routes/models.ts             GET /models, GET /tools
  http/routes/avatars.ts            GET /avatars/limits, POST /avatars, GET /avatars/{sha}.webp
  http/uploads/avatar-image.ts      sharp (P2): loaders blocked but PNG/JPEG/WebP at start, magic bytes = format,
                                    limitInputPixels, autoOrient, failOn error, first frame, 256×256 WebP
  http/uploads/avatar-files.ts      the file adapter under DATA_DIR/avatars (§4a)
  model/ai-sdk/effort.ts            catalog effort → @ai-sdk/anthropic provider options (P1)
backend/src/app/
  config.ts                         AVATAR_MAX_BYTES, AVATAR_ORPHAN_HOURS; reads the two YAML files
  cli.ts, bot-commands.ts           bots trash | bots restore <slug> (temporary, M5b removes)
  compose.ts, timed-jobs.ts         wire the bots service, the avatar store, the purge job's new parts
scripts/gen-case-folding.ts         CaseFolding.txt → core/bots/case-folding.ts (P3)
seed/                               Guide, BA and Designer bots, in that order (seed/README.md)
seed/skills/using-the-app/SKILL.md  what the app is and how to use it, for Guide (decision 12; owner reviews the text)
Makefile                            seed → skills import, then `cli bots seed` (idempotent)
frontend/src/features/skills/       §0a: skill-page.tsx (no upgrade_bot_ids), skill-dialogs.tsx (bots in
                                    Deprecate and Delete), skill-bots-tab.tsx (real rows, UI-7.5a)
.dependency-cruiser.cjs             sharp: http/uploads only; ai, @ai-sdk/*: adapters/model only
```

Every write goes through one service call in one `uow.run` with its event. The order inside `POST /bots`: parse → key lookup (same hash → the first bot, other hash → 409) → catalog and key → effort → skills and the clone exception → tool settings → guard → limits → name key → slug → insert with `create_key`. The unique indexes are the final checks (409 `name_taken`; a slug race retries the pick once).

### 4a. Avatar file contract (plan review, finding 3)

**The lock.** "The write lock" is the database write lock: `uow.run` queues every write transaction and opens it with `BEGIN IMMEDIATE`. Every step that reads or changes the avatar folder in a way that matters runs inside a `uow.run`, so the upload, the refresh, a bot save and the cleanup never interleave. Slow work (reading the request, `sharp` decode and re-encode, hashing, writing the bytes) happens **before** the lock.

**The port** (`core/ports/avatar-files.ts`, decision 1). The adapter knows files, never bot rows:

| Method | Does |
| --- | --- |
| `stage(bytes) → stagedName` | writes `avatars/.staged-<uuid>.webp` and fsyncs it; outside the lock |
| `publish(stagedName, id, at)` | if `<id>.webp` exists: set its time to `at`, delete the staged file; else `rename` the staged file to `<id>.webp` (atomic on one file system, so no reader ever sees a half file) and set its time to `at`; fsync the folder |
| `exists(id)`, `touch(id, at)` | for the save |
| `list() → {name, kind: avatar \| staged, time}[]` | for the cleanup |
| `remove(name)` | deletes; a missing file is not an error |

The service decides what is used: `bots` rows that name the file (live, Trash, tombstone), read inside the same transaction.

**Each path:**

| Path | Before the lock | Inside `uow.run` (write lock) |
| --- | --- | --- |
| `POST /avatars` | size limits, magic bytes, `sharp` re-encode, SHA-256, `stage` | `publish(staged, id, now)` (new file, or refresh of the same content) |
| Bot save that sets `avatar_id` (POST, PATCH) | nothing | `exists(id)` else 422 `avatar_id`; write the row |
| Bot save that drops the last row naming a file | nothing | write the row; then, when no row names the old file any more, `touch(old, now)` |
| Cleanup (purge job) | nothing | `list()`; for each avatar file: not named by any row **and** its time (read again now) older than `now − AVATAR_ORPHAN_HOURS` → `remove`. Each staged file older than the grace period → `remove` (a crash leftover) |

**Failures.** SQLite rollback does not undo a file step, so every file step is safe to leave behind:

| Failure | What is left | Why it is safe |
| --- | --- | --- |
| Crash or error after `stage`, before `publish` | a staged file | no row names it; the cleanup removes it after the grace period |
| `publish` fails (rename or time) | the staged file; no `<id>.webp` or the old one unchanged | the request gets 500; nothing in the database named it |
| The upload transaction fails after `publish` | a published, unused file | the same state as an upload that no bot used: the cleanup removes it after the grace period |
| `touch` fails in a save | the save rolls back (500) | the row is unchanged, so the old file is still used |
| The save rolls back after `touch` | a file with a newer time | it only waits longer before the cleanup |
| `remove` fails in the cleanup | the file | logged; the next pass tries again |

A file is never deleted while a row names it, because the check and the delete are in one locked transaction, and a save that names a file checks `exists` in its own locked transaction.

## 5. Tests

- **Rules (Vitest):** name key (every pair in the brief, Turkish İ, final sigma, ligatures, U+0085 and U+FEFF at the ends and inside, the key of a key equals the key for every code point); slug ("Thiết kế" → `thiet-ke`, emoji → `bot`, "New" → `new-2`, a long name with a suffix ≤ 40, `-` never at the cut); clone name (30 characters → ≤ 32, never inside a grapheme, "(copy 2)"); effective tool settings (each step 1–6, a tool added later, a model that lost a tool, not multimodal, `later` / `locked` stored `true` reads off); body check (`tool_not_available`, `tool_job_conflict`, `needs`); header order (pinned, recent, created, both directions); health lines; catalog parse (bad YAML, unknown tool id, effort not in list, default not in efforts).
- **Effort mapping:** one test per catalog effort value for Anthropic, and NULL → no option.
- **Bots service:** create with defaults; idempotency (same key and body → first bot, also after a pinned skill was deprecated, the model lost its key, the bot went to Trash; another body → 409); PATCH with `model_id` / `effort` → 422, row unchanged (invariant 1); the clone exception (live source with the same version passes; source in Trash, another version, or no `cloned_from_bot_id` → 422 `skill_deprecated`); a pin to a skill in Trash → 422 `pins[i]`; a lower `bot_persona_max` keeps a longer persona and a rename still saves; only the fields sent are checked; delete unpins and closes the gap; restore leaves it unpinned; purge makes the tombstone (closed column list) and deletes `bot_skills`.
- **Pins:** `PUT /bots/{id}/skills/{skill}` with stale `expected` → 409 with `current`; Always load never sends an old version; DELETE of a missing pin → 204 and no event; `PUT /bots/pins` with a deleted bot, a repeat, or a stale `expected_bot_ids` → 409 `bot_list_changed`, positions unchanged; pins do not raise `row_version`. Invariant 3 at the database level.
- **Skills with bots:** saving v2 moves no pin (invariant 4); `POST /skills/{id}/bots` ticked moves only the ticked, in one transaction, stale expected → 409 and nothing moves; deprecate removes the ticked; trash removes every pin and stores `trashed_bot_ids` (invariant 19); restore suggests only live bots (invariant 21); real `bots_using` / `bots_outdated` / upgrade candidates; `bot.updated` per moved bot.
- **Avatars:** SVG, GIF, text renamed `.png` → 422; PNG → WebP by hash; same content twice → same id and refreshed time; file over `AVATAR_MAX_BYTES` → 413; request over limit + 64 KB → 413; > 25 Mpx refused before decode; metadata stripped; a save naming a missing file → 422 `avatar_id`; cleanup keeps any file named by a live, Trash or tombstone row, deletes an unused one past `AVATAR_ORPHAN_HOURS`, and the save that drops the last use refreshes the time.
- **Races (`architecture.md` §11):** two PATCHes with one `row_version`; two creates with one name (and one name key); two pin changes from two tabs; "server committed, response lost" for `POST /bots`.
- **Avatar races and failures (§4a):** cleanup against a save that names the file (the save wins → kept; the cleanup wins → the save gets 422 `avatar_id`, never a row naming a deleted file); cleanup against an upload of the same content (either order ends with the file present and a fresh time); `publish` fails → 500, no `<id>.webp`, the staged file is removed by a later cleanup; the transaction fails after `publish` → the file stays unused and goes after the grace period; `touch` fails → the save rolls back; a staged leftover older than the grace period is removed, a younger one is kept. The fake port injects each failure; the contract suite runs the same cases on the real file adapter in a temp folder (atomic publish: a reader never sees a partial file).
- **Settings:** each new key's range, the three cross-field checks → 422 with the key, `settings.updated`.
- **API:** every error code of §4 with its `field`; the guard on name, description and persona (POST and PATCH); `GET /bots` in M2 shape (counts 0, `last_activity_at` null, status idle); 422 `bot_deleted` and 410 `bot_purged`; the generated client uploads an avatar `File` against the real app (as M1 P6).
- **CLI and seed:** `bots trash` / `bots restore`; `make seed` twice → one Guide, one BA and one Designer, the second run reports them; Guide has `using-the-app` with Always load and the first available model in catalog order; with no available model the seed prints "Set a key to seed the bots".
- **Frontend (M2b, M2c):** Vitest for the create form (effort selector only when the model has efforts; step validity; the retry snapshot keeps key and body; a change after a known outcome takes a new key), the colour row (default unused swatch, Random in range), the crop output, the header order freeze. Playwright with both fake models: create skill → create bot → clone with the other model (M2b); upgrade flow J4 (M2c); reload keeps `/bots/{slug}?tab=` and `/bots/new?from=`; CSP watch on every new page; the 12–15 bot header check.

## 6. UI design (approval before UI code)

The design is the agreed round 9 set (`bots-page.md`, `create-bot-page.md`, `bot-page.md`, `bot-avatar.md`, `pin.md`, `bot-status.md`, `bot-card.md`, `top-header.md` §3) plus the spec gap answers (#56). M2 builds it as written; previews in `design/previews/command-dark/` (`bots-grid*`, `create-bot*`, `clone-bot`, `bot-page*`, `bot-avatar-change`, `header-pins`, `pin`). Layouts:

```text
M2b  /bots                                   M2b  /bots/new  (and ?from={bot id})
┌ Bots                         + Create ┐     ← Back  New bot  [1 Basics]─[2 Persona]─[3 Skills]─[4 Model]
│ 🔍 Search bots                        │     ┌ step form ──────────────────┐ ┌ preview card ─┐
│ PINNED                                │     │ Name ........... 12 / 32    │ │ band, avatar  │
│ [card][card]                          │     │ Description .... 3 lines    │ │ name, desc    │
│ OTHERS            [⏱ Recent][📅 Created]│   │ Style [Flat][Upload image]  │ │ Basics  ✓ Edit│
│ [card][card][card][card]              │     │ ●●●●●●●●●● | [🎨 Custom][⤮ Random]│ Persona …     │
└───────────────────────────────────────┘     └─────────────────────────────┘ └───────────────┘
 card: band · 72 px avatar · name · model+effort · 2-line description · skills ↑n · 0 projects · 0 conversations · health line · "Idle · no activity yet"

M2c  /bots/{slug}?tab=profile|skills|model|activity|usage
┌ list 300 ───────┐┌ band ─────────────────────────────────────────────┐
│ ← Back  + Create││ (avatar 116)  BA  ba  [Not saved]               ⋯ │
│ PINNED / OTHERS ││ 🔒 model · effort        Idle · no activity yet   │
│                 ││ Profile · Skills 4 ↑1 · Model · Activity · Usage  │
│                 ││ tab content … save bar (Profile, Model)           │
└─────────────────┘└───────────────────────────────────────────────────┘
```

**M2-only states** (from the brief and #56; nothing new): Message and Add here hidden (⋯ menu, page top, bot card); Memory tab hidden; Activity "BA is in no conversations yet."; Usage empty state (§9.6); counts 0, status "Idle · no activity yet"; Jelly and Pixel cards not shown; the model row with no key has no "Add a key" link; the 12–15 bot header check after the build decides the "+N" list.

**New UI parts** (`components/ui/`): Popover (Custom colour card), Slider (crop zoom, history share), Switch (Always load, tools), Stepper, colour row, crop card, drag list. Library or own component per P4–P6. Base UI parts only where P6 shows no injected style.

**Effort menu labels** (decision 4): Minimal, Low, Medium, High, Extra high, Max; each model shows only its own levels, with its default preselected.

**Build notes from the probes** (go into `frontend-conventions.md` §5 in M2b): `blob:` images are blocked, use `data:` URLs; `react-colorful`, `@dnd-kit/react` and default `react-easy-crop` inject styles; in dnd-kit, move items only in `onDragEnd`. New `watchCsp` cases cover a drag, the crop card and the colour popover.

## 7. New dependencies (need approval)

| Package | Version (date) | Where | Why | Notes |
| --- | --- | --- | --- | --- |
| `ai` | 7.0.143 (2026-10-16) | backend, `adapters/model/` only | effort mapping now, the agent in M3 | no install scripts; pulls `@ai-sdk/gateway`, `@vercel/oidc` (unused) |
| `@ai-sdk/anthropic` | 4.0.82 (2026-10-16) | backend, `adapters/model/` only | the Anthropic provider | the newest (4.0.94) is under two weeks old |
| `@ai-sdk/google` | 4.0.99 (2026-10-16) | backend, `adapters/model/` only | the Gemini provider (P8) | shares `ai`'s provider packages; no install scripts |
| `sharp` | 0.35.5 (2026-09-27) | backend, `adapters/http/uploads/` only | avatar check and re-encode | Apache-2.0; **bundles libvips, LGPL-3.0-or-later** (dynamic, prebuilt; fine for a local app, noted for the record); no install script |
| `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` | 6.3.1, 10.0.0, 3.2.2 | frontend | drag to pin and reorder (P5) | MIT; ~17 kB gzip |

Not added: a case-folding library (P3: a generated table instead), `react-colorful`, `react-easy-crop` (P6: own components). `dependency-cruiser` keeps `sharp` in `http/uploads/` and `ai`, `@ai-sdk/*` in `adapters/model/`.

## 8. Risks

- **Unicode upgrade:** the name key uses Node's NFKC and our table. A test fails when `process.versions.unicode` differs from the table's version. The PR that moves Node regenerates the table and adds a migration that recomputes `name_key`; if two live keys would then collide, the migration stops and names them (very unlikely, but never silent).
- **`@dnd-kit` stable line** has had no release since 2024-12. It works on React 19 today; if it breaks, the fallback is native drag plus our own keyboard reorder (which we build anyway).
- **SDK silently changes efforts** (`xhigh`/`max` → `high` when thinking is off) with only a warning: M3's adapter must log warnings and never turn thinking off. Recorded here so M3 does not learn it again.
- **Catalog prices:** `price_override_per_mtok` cannot hold Haiku 5.5's tiered input price or the two cache-write prices; Gemini prices double on set dates (Argon 2026-12-01, 3.8 Flash 2027-01-01), so a fixed override goes stale; search grounding is priced per request. Whether `genai-prices` knows these models is unverified. Not used in M2 (no runs); a follow-up for M3 (usage) and M7.
- **Avatar bytes after a `sharp` upgrade** may differ for the same input; the only effect is a new file instead of reuse.
- **Size:** three PRs, each with the full gate. M2a is the largest (about M1a's size).

## 9. Decisions (plan review, 2026-11-01)

| # | Decision |
| --- | --- |
| 1 | **Avatar store:** the narrow port, a fake and a contract suite (§4a). The service decides whether a file is used; the adapter only lists files and their times. `architecture.md` §2 changes in M2a |
| 2 | **Split:** M2a / M2b / M2c, with the Skills page changes in M2a (§0a) and the PR dependencies in §0 |
| 3 | **Fable 5.1:** left out for now; its price and data retention rule match the current docs |
| 4 | **Effort:** all five levels, each model's default preselected, driven by the catalog (no list in the frontend) |
| 5 | **Name key:** both fixes; one Unicode white space definition (`\p{White_Space}`) for trim and collapse; tests for U+0085, U+FEFF and repeated normalisation. `domain-model.md` §2 changes in M2a |
| 6 | **CHECKs:** both added (§3); service checks stay for useful errors; the API refuses Jelly and Pixel in M2 |
| 7 | **Dependencies:** accepted in principle. Backend packages in M2a, the `@dnd-kit` packages in M2b. License notes kept (libvips LGPL); the exact lockfile is checked in each implementation review |

| 8 | **Gemini in M2** (owner, 2026-11-01): Google joins Anthropic so the first bots can use Gemini; OpenAI and DeepSeek later, each as its own PR |

| 9 | **Gemini models:** all three of §2 (3.8 Flash everyday, 4 Argon strongest and paid only, 3.5 Flash-Lite cheapest) |
| 10 | **Google tool ids:** `google_search`, `url_context`, `google_code_execution`, each with the same `job` as its Anthropic twin (`web_search`, `web_fetch`, `code_execution`); `file_search` and `google_maps` left out until a milestone needs them |
| 11 | **Catalog order:** `google:gemini-3.8-flash` first, then the Anthropic models (Opus 5.5, Sonnet 5.5, Haiku 5.5), then Gemini 4 Argon and 3.5 Flash-Lite. The seed bots take the first available model |

| 12 | **Guide seed bot** (owner, 2026-11-01): `make seed` creates **Guide** first, then BA and Designer. Guide's persona: a friendly guide that answers "how do I…?" in short steps and suggests the next step. Its knowledge is the seed skill `using-the-app` (Always load): what the app is; bots, skills, projects, Library, memory, Trash; how to create a bot, assign a skill and start a conversation; tips. It knows only what the skill says: not the screen, not the owner's data. It can chat from M3. The builder drafts the persona and the skill; the owner reviews both in the M2a PR. The M2 brief and `seed/README.md` change in M2a |
| 13 | **BA and Designer stay** as seed bots, after Guide |
| 14 | **The guide stays current** (owner): a slice that changes something the owner can see updates `seed/skills/using-the-app/SKILL.md` in the same PR. M2a adds this line to `AGENTS.md` §9 (definition of done) and [implementation workflow](../workflows/implementation.md#self-check) |
| 15 | **First-run "Add Guide" offer** in the app (no `make seed` needed): parked for the M3 spec gap pass; a follow-up row in `status.md` |

**Data use (owner should know):** on the Gemini API **free tier**, Google may use prompts and replies to improve its products, and people may read them; the paid tier does not. Since 2026-10-26, new paid projects **store requests by default**; turn it off in AI Studio (Logs and Datasets → Settings). Use a key restricted to the Gemini API. The app cannot check the tier: it is a property of the key's project.
