# M2: Bots

Checkpoint: **plan** (schema, uploads).

## Goal

The owner can create, edit, clone and delete bots; choose a model and effort from the catalog
once; upload avatars; assign skills pinned to versions, upgrade and downgrade them, and toggle
always-load. All bots appear in the header with tooltips. The Skills page shows the real bots
that use each skill.

## Read first

`docs/domain-model.md` §2, §3.2, §3.4, §4, §10 (bot limits and their ranges), §12 invariants 1,
3, 4, 6, 12, 19; `docs/decisions/` D6, D7, D12, D16, D19 (with its 2026-11-01 amendment), D50,
D55; `docs/api.md` §2, §3, §4; `docs/requirements/app-shell.md` (UI-2.1–2.3, 2.6–2.10),
`docs/requirements/bots.md`, `docs/requirements/skill-hub.md` (UI-7.4, UI-7.5a, UI-7.6,
UI-7.6a); `docs/security.md` §2.4 (avatars), §2.6, §2.13; `docs/realtime-events.md` §4 (bot,
skill and Trash events); `docs/testing.md` §2 (fake models).

## In scope

- `config/models.yaml` with **Anthropic models only** (owner, 2026-11-01), `core/catalog/`
  (loader, availability) and the effort mapping in `adapters/model/ai-sdk/`. Check current model
  ids and effort parameters in the provider's documentation and record what you checked in the
  PR. Fake mode: `fake:scripted` and `fake:effort` next to the real entries; the test setup
  clears every `*_API_KEY` (`testing.md` §2).
- Tables `bots` (with `row_version` and `name_key`) and `bot_skills`; the slug rule and the name
  key (`domain-model.md` §2, D19); one-line `description` (D18).
- Endpoints `api.md` §3–4 and the skill endpoints that now touch pins (below).
- Concurrency (`domain-model.md` §2): `row_version` for Profile and Model saves, the expected
  pin on `PUT /bots/{id}/skills/{skill_id}`, `expected_bot_ids` on `PUT /bots/pins`. A conflict
  keeps the owner's input (`bot-page.md` §4.1, §7).
- `Idempotency-Key` on `POST /bots`, with the key lookup before every check of data that can
  change, and the Create page's retry snapshot (`domain-model.md` §2 Idempotency,
  `create-bot-page.md` E5).
- Effective tool settings: one pure function for defaults, model tools, `multimodal`, `needs`
  and one tool per job, used by GET and checked on POST and PATCH (`domain-model.md` §2).
  Internal tool switches show, start on and save; provider tools have `switch: later` and the
  MCP connector `switch: locked`: they show "later milestone" or "Needs a decision", the server
  refuses them on (422 `tool_not_available`) and reads them as off (D53, D55).
- The sensitive-data guard on the bot name, description and persona (`security.md` §2.13).
- Avatar upload pipeline: `sharp`, the file and request limits from `AVATAR_MAX_BYTES`,
  `GET /avatars/limits`, the pixel limit, re-encoding, the crop card, and the cleanup of unused
  files after `AVATAR_ORPHAN_HOURS` (`domain-model.md` §2 Avatar files). Avatar styles **Flat and
  Upload image only**: Jelly and Pixel wait for a later slice (`bot-avatar.md` §1), and the API
  refuses them. The colour row with Custom and Random; the default colour is a random swatch no
  other bot uses (`bot-avatar.md` §5, §6).
- Pages: bots list, create (with clone mode, `create-bot-page.md` §6), bot page (`bot-page.md`:
  edit layout, Profile, Skills, Model, Activity and Usage tabs, save bar, colour band,
  unavailable banner) and their URLs (`bot-page.md` §1, `create-bot-page.md` §7). The Memory tab
  is hidden until M5b. Usage shows only its empty state until M3.
- **No conversations yet:** Message (⋯ menu, bot page, bot card) and Add here (bot card) are
  hidden; the Activity tab shows "BA is in no conversations yet."; project and conversation
  counts are 0, `last_activity_at` is NULL and the status is "Idle · no activity yet". The skill
  count, "↑n" and the "Uses a deprecated skill" and "Cannot run" health lines use real data.
- Header bar with tooltips and unavailable badges (dragging into a conversation comes in M4);
  pinned zone with drag to pin, unpin and reorder; header order (pinned, then Recent activity or
  Created) with deferred reordering (UI-2.1, UI-2.9, UI-2.10).
- Bots page pins and sort buttons (UI-4.5), `PUT /bots/pins`, settings `bot_order` and
  `bot_order_direction`; health (UI-4.6), search (UI-4.7), empty state (UI-4.8).
- Create page with four steps, preview card, Tools list and `Idempotency-Key` (UI-5.1–5.8);
  `config/tools.yaml` (`domain-model.md` §4.1) and `bots.tool_settings`.
- Bot settings and their ranges and cross-field checks in `PATCH /settings`
  (`domain-model.md` §10). A lower limit never changes a saved bot.
- **Skills integration** (the Skills page built in M1 had no bots):
  - The upgrade card (C4) and the assign card (C4b) after a save or Create use
    `POST /skills/{id}/bots` with the expected version per bot. Remove `upgrade_bot_ids` from
    `POST /skills/{id}/versions` (the route, the service and their tests): the save never moves
    a pin (`domain-model.md` §3.2).
  - The Skills page Bots tab (UI-7.5a) with real rows, "Upgrade to vN", Always load, Change
    version, Remove and "+ Add".
  - Real `bots_using` and `bots_outdated` on the list and on versions; real
    `upgrade-candidates`.
  - The deprecate dialog lists and removes the ticked bots (UI-7.6); delete to Trash removes
    every pin and stores `trashed_bot_ids` (UI-7.6a).
  - `bot.updated` for each bot whose pin a skill endpoint moves or removes; the client
    refreshes the bot list on every `skill.*` event.
- Delete to Trash (D50), and the temporary CLI `bots trash` and `bots restore <slug>` that M5b
  removes (`api.md` §2). The purge job of M1 takes bots too: the tombstone and its `bot_skills`
  delete (`domain-model.md` §2 Purge).
- Events `bot.created|updated|deleted|restored|purged`, `bots.reordered`, and `bot` in
  `trash.changed`.
- `make seed` also creates the BA and Designer bots pinned to the seeded skills, with
  `working-principles` pinned to both with "Always load" (D16). A new seed bot gets the first
  available model in catalog order with its default effort; with no available model the seed
  creates the skills only and prints "Set a key to seed the bots". A second run changes nothing:
  a bot whose name is taken (live, in Trash, any bot with that name key) is left as it is and
  reported ("BA already exists"); the seed never overwrites a bot's model, persona or pins.

## Out of scope

Conversations, Message and Add here (M3), drag-to-add (M4), the Memory tab (M5b), the Trash page
and bot restore in the app (M5b), Jelly and Pixel avatars, providers other than Anthropic, the
restore exception to invariant 6 (`restore_suggestion` and its server check, with the restore
dialog in M5b).

## Acceptance criteria

- UI-2.1, 2.2, 2.3, 2.6–2.10; UI-4.1–4.8; UI-5.1–5.8; UI-6.1–6.6 and 6.9 (6.7 and 6.8 show
  empty states until M3); UI-7.4, UI-7.5a, UI-7.6, UI-7.6a with bots.
- Invariants 1, 3, 4, 6 (with the clone exception as a server check; the restore exception is
  M5b), 12, 19.
- PATCH with `model_id` or `effort` → 422, row unchanged.
- Effort not in the model's list → 422 `effort_not_supported`.
- Removing a model from `models.yaml` makes the bot unavailable with "model removed"; Clone on
  its banner opens the prefilled form with the model field empty (CL2). Unsetting its key makes
  it unavailable with "no API key"; Clone keeps the model, shown unavailable, and Create stays
  off until another model is picked.
- Saving skill v2 moves no pin; the upgrade card with BA unticked leaves BA on v1; ticked moves
  only the ticked bots, in one transaction. An upgrade whose expected version is stale → 409
  `stale_write`, nothing moves.
- SVG avatar rejected; PNG re-encoded to WebP, stored by hash. A file over `AVATAR_MAX_BYTES`,
  or a request over that plus 64 KB, → 413 `too_large`. An image over 25 million pixels is
  refused before it is decoded. An unused file older than `AVATAR_ORPHAN_HOURS` is deleted; a
  file that any bot row names (live, Trash, tombstone) is kept; an upload of the same content
  refreshes its time, and so does the save that removes its last use, so it gets the full grace
  period after it becomes unused.
- `POST /bots` repeated with the same `Idempotency-Key` and body → the first bot, nothing new,
  also after a skill it pins was deprecated in between; same key with another body → 409
  `idempotency_key_reused`. The Create page resends its snapshot on Try again; an edit after a
  known outcome uses a new key.
- Clone of a bot with a 30-character name suggests a name of at most 32 characters; with
  "{name} (copy)" taken it suggests "(copy 2)".
- Clone with a model that lacks a copied provider tool → that tool is off, the info line names
  it, and a body that still turns it on → 422 `tool_not_available`.
- Clone of a bot that uses a deprecated skill keeps that pin; a `POST /bots` with the same
  deprecated pin and a source bot that is in Trash, or has another version, or no
  `cloned_from_bot_id` → 422 `skill_deprecated`.
- `avatar_colour` that is not `#RRGGBB` → 422. `avatar_style` `jelly` or `pixel` → 422. A
  Profile save with a new uploaded image is one PATCH (`avatar_style: upload`, `avatar_id`) in
  one transaction.
- `PUT /bots/pins` naming a deleted bot, the same bot twice, or with `expected_bot_ids` that is
  not the current list → 409 `bot_list_changed`, positions unchanged.
- A pin change with a stale `expected` → 409 `stale_write` with the current pin; an old Always
  load click never sends an old version.
- Two Profile saves with the same `row_version` → one wins, the other gets 409 `stale_write`,
  and the page keeps its edits.
- `tool_settings` with two tools of the same job on → 422 `tool_job_conflict`; a provider tool
  on (switch `later`) or the MCP connector on (`locked`) → 422 `tool_not_available`, and a stored
  `true` for one reads as off. A tool added to
  `tools.yaml` after a bot was saved reads as its default, but never turns on when its `needs`
  tool is off or its job is taken.
- Name key: "BÁ" and "bá", " BA " and "BA", "ＢＡ" and "ba", "ẞ", "ß" and "SS" collide (409 `name_taken`), also
  with a bot in Trash and for two creates at once. Slugs: "Thiết kế" → `thiet-ke`, an emoji
  name → `bot`, the name "New" → `new-2`, a long name with a suffix stays ≤ 40.
- A likely secret in the name, description or persona → 422 `sensitive_data`.
- A bot settings PATCH out of range, or with `bot_history_min_pct` above the default, or
  `health_failed_runs` above `health_recent_runs` → 422 with the key. A lower `bot_persona_max`
  leaves a longer persona as it is, and a rename of that bot still saves.
- Header in Recent activity: activity events while the pointer is in the header move no
  avatar; the next click outside applies the new order once.
- Header with more bots than fit: Tab to an avatar shows its name tooltip and the ‹ › buttons,
  with no pointer in the header; a swipe on touch scrolls the roster (UI-2.2, UI-2.7,
  `top-header.md` states 3 and 5).
- `make seed` twice → one BA and one Designer; the second run reports them and changes nothing.

## Tests

Service and API tests for the above, including the races in `architecture.md` §11 (two bot
PATCHes with the same `row_version`, two creates with the same name, a pin change from two
tabs, the avatar cleanup against a save); "server committed, response lost" for `POST /bots`;
catalog tests per provider effort mapping; the effective tool settings function; Vitest for the
create form (effort selector appears only when supported); Playwright with the two fake models:
create skill → create bot with it → clone with a different model → upgrade flow from J4.

## Needs human review

- The UI design in the plan (layout, components, states), approved before UI code is written
  (`docs/workflow.md` §2; sketches in `docs/design/` are not specs).
- Migration: `bots` (including `row_version`, `name_key` with its unique index,
  `pinned_position`, `avatar_style`, `avatar_colour`, `tool_settings`, `create_key`,
  `create_request_hash`, `purged_at`, and no `write_paths`) and `bot_skills`. The owner approved
  the columns in the spec (PR #20, 2026-10-24; `row_version` and `name_key` in the M2 spec gap
  pass) and still reviews the migration file.
- New dependencies: `ai`, `@ai-sdk/anthropic` and `sharp` (backend), and a case folding
  library if the plan picks one over a generated table (`domain-model.md` §2 Name key); the plan
  lists the frontend ones (for example `@dnd-kit` for drag, and any crop or colour picker
  library).
- API change: `upgrade_bot_ids` leaves `POST /skills/{id}/versions`.
- Avatar upload code; catalog contents.

## Open questions

None. The M2 spec gap pass (owner, 2026-11-01) answered 30 gaps; the answers are in the owning
documents.
