# M2: Bots

Checkpoint: **plan** (schema, uploads).

## Goal

The owner can create, edit, clone and delete bots; choose a model and effort from the catalog
once; upload avatars; assign skills pinned to versions, upgrade and downgrade them, and toggle
always-load. All bots appear in the header with tooltips.

## Read first

`docs/domain-model.md` §2, §3.2, §4, §12 invariants 1, 3, 4, 6, 12; `docs/decisions/` D6,
D7, D12, D16, D19; `docs/api.md` §3, §4; `docs/requirements/app-shell.md` (UI-2.1–2.3, 2.6–2.10),
`docs/requirements/bots.md`, `docs/requirements/skill-hub.md` (UI-7.4); `docs/security.md` §2.4 (avatars), §2.6.

## In scope

- `config/models.yaml`, `core/catalog/` (loader, availability) and the effort mapping per
  provider in `adapters/model/ai-sdk/`.
  Check current model ids and effort parameters in the providers' documentation and record
  what you checked in the PR.
- Tables `bots`, `bot_skills`; slug generation (D19); one-line `description` (D18).
- Endpoints `api.md` §3–4, plus `upgrade-candidates` and `upgrade_bot_ids` from §2.
- Avatar upload pipeline with re-encoding; generated default avatar (initials + colour from
  the slug).
- Pages: bots list, create (including clone mode), detail (skills table, upgrade diff,
  always-load, avatar change, unavailable banner).
- Header bar with tooltips and unavailable badges (dragging into a conversation comes in M4);
  pinned zone with drag to pin, unpin and reorder; header order (pinned, then Recent activity or
  Created) with deferred reordering (UI-2.1, UI-2.9, UI-2.10).
- Bots page pins and sort buttons (UI-4.5), `PUT /bots/pins`, settings `bot_order` and
  `bot_order_direction`; health (UI-4.6), search (UI-4.7), empty state (UI-4.8).
- Create page with four steps, preview card, Tools list and `Idempotency-Key` (UI-5.1–5.8);
  `config/tools.yaml` (`domain-model.md` §4.1) and `bots.tool_settings`. Provider tool switches
  stay "later milestone" (D53, D55).
- Agreed designs: `docs/design/components/bots-page.md`, `create-bot-page.md`, `pin.md`,
  `bot-status.md`, `dashed-slot.md`, `time-format.md`, and the round 9 changes in
  `top-header.md` and `bot-card.md`.
- Skill save dialog now lists real upgrade candidates (UI-7.4).
- Events `bot.created|updated|deleted`, `bots.reordered`.
- `make seed` also creates BA and Designer bots pinned to the seeded skills, with
  `working-principles` pinned to both with "Always load" (D16).

## Out of scope

Conversations, drag-to-add (M4).

## Acceptance criteria

- UI-2.1, 2.2, 2.3, 2.6–2.10; UI-4.1–4.8; UI-5.1–5.8; UI-6.1–6.6 (6.7 and 6.8 show empty
  states until M3); UI-7.4.
- Invariants 1, 3, 4, 6, 12.
- PATCH with `model_id` or `effort` → 422, row unchanged.
- Effort not in the model's list → 422 `effort_not_supported`.
- Removing a model from `models.yaml` (or unsetting its key) makes the bot unavailable with the
  right reason; "Clone with another model" opens a prefilled form.
- Saving skill v2 with BA unchecked leaves BA on v1; checked moves only BA.
- SVG avatar rejected; PNG re-encoded to WebP, stored by hash.
- `PUT /bots/pins` naming a deleted bot or the same bot twice → 409 `bot_list_changed`,
  positions unchanged.
- `POST /bots` sent twice with the same `Idempotency-Key` creates one bot.
- `tool_settings` with two tools of the same job on → 422 `tool_job_conflict`.
- Header in Recent activity: activity events while the pointer is in the header move no
  avatar; the next click outside applies the new order once.

## Tests

Service and API tests for the above, including the races in `architecture.md` §11 (two bot
PATCHes with the same `row_version`, two creates with the same name); catalog tests per provider effort mapping; Vitest for the
create form (effort selector appears only when supported); Playwright: create skill → create
bot with it → clone with a different model → upgrade flow from J4.

## Needs human review

The UI design in the plan (layout, components, states), approved before UI code is written
(`docs/workflow.md` §2; sketches in `docs/design/` are not specs).

Migration (including `bots.pinned_position`, `avatar_style`, `avatar_colour`, `tool_settings`, `create_key`, `purged_at`, and removing `write_paths`); avatar upload code; catalog contents.

## Open questions

None.
