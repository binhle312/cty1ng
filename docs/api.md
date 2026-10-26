# HTTP API

This document owns the endpoint list, shapes and error codes. The OpenAPI schema
(`/api/openapi.json`) is generated from the Hono routes' Zod schemas (`@hono/zod-openapi`) and is the machine-readable contract; the
frontend client is generated from it (`pnpm gen:api`). CI fails if the generated client is out
of date. When this document and the OpenAPI schema disagree, raise it.

## 1. Conventions

- Base path `/api`. JSON in and out (`multipart/form-data` for uploads).
- Ids are TypeIDs (D36): `<prefix>_<26 base32 chars>`, for example `bot_01jb8x6p0afqz8r2m3k5t7v9wx`.
  A malformed id or a wrong prefix returns 422 `invalid_id`. Timestamps are ISO-8601 UTC.
- Request schemas forbid unknown fields (Zod `.strict()`) so typos and forbidden fields
  (like `model_id` on bot update) fail loudly with 422.
- Lists are cursor-paginated where they can grow: `?before_seq=` / `?limit=` (max 100).
- Create returns `201` with the created object. Delete/deprecate returns `204` or the updated
  object. Actions return the affected object.
- All mutating requests must pass the origin check (`security.md`).

### Errors

One shape for every error:

```json
{"error": {"code": "mention_not_member", "message": "Designer is not in this conversation.", "field": "mentions[0]"}}
```

| HTTP | Codes |
| --- | --- |
| 400 | `invalid_skill_file`, `invalid_import`, `bad_request` |
| 403 | `not_author`, `origin_rejected` |
| 404 | `not_found` |
| 410 | `bot_purged` (the bot was purged from Trash; only its tombstone remains, D50) |
| 409 | `name_taken`, `slug_taken`, `stale_write` (the row changed since it was read; reload), `run_in_progress` (e.g. edit while running), `already_member`, `handoff_not_pending`, `run_not_queued`, `draft_not_pending`, `draft_stale`, `bot_list_changed`, `idempotency_key_reused` (same `Idempotency-Key` with a different body) |
| 413 | `too_large` |
| 422 | `validation_error`, `invalid_id`, `mention_not_member`, `bot_unavailable`, `bot_deleted`, `skill_deprecated`, `version_mismatch`, `effort_not_supported`, `model_not_available`, `sensitive_data`, `tool_job_conflict`, `tool_not_available` (the model has no such tool) |
| 429 | `rate_limited` (runs per hour), `daily_cap_reached`, `provider_cap_reached` (D42) |

## 2. Skills

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| GET | `/skills?include_deprecated=false` | | list with `latest_version`, `bots_using`, `bots_outdated`; newest `updated_at` first; skills in Trash are never listed |
| POST | `/skills` | `{slug, name, description, body_md, cloned_from_skill_version_id?}` | creates v1, author = owner; also the Create of a clone (§3.3 of `domain-model.md`) |
| GET | `/skills/{id}` | | includes latest version body |
| PATCH | `/skills/{id}` | `{name, row_version}` | metadata only; author only |
| POST | `/skills/{id}/versions` | `{base_version, description, body_md, changelog?, upgrade_bot_ids: []}` | author only; creates N+1; moves listed pins |
| GET | `/skills/{id}/versions` | | list, newest first |
| GET | `/skills/{id}/versions/{version}` | | one version (used by provenance chips) |
| GET | `/skills/{id}/diff?from=2&to=5` | | unified diff of bodies and descriptions |
| POST | `/skills/{id}/versions/{version}/restore` | `{changelog?}` | creates N+1 with that content |
| GET | `/skills/{id}/upgrade-candidates` | | author's bots pinned to older versions (for the save dialog) |
| POST | `/skills/{id}/deprecate` | `{remove_bot_ids: []}` | author only; removes the listed pins in the same transaction |
| POST | `/skills/{id}/undeprecate` | | author only |
| POST | `/skills/{id}/trash` | `{row_version}` | author only; deprecated skills only (409 `not_deprecated`); removes every pin, returns the bots it removed (D49) |
| POST | `/skills/{id}/restore` | | author only; out of Trash, still deprecated; returns `suggested_bot_ids` (bots not deleted) |
| DELETE | `/skills/{id}` | | permanent delete of a skill in Trash ("Delete now"; M5b Trash page) |
| POST | `/skills/import/preview` | zip upload | returns per-skill `new / changed (diff) / unchanged / invalid / conflict` and a `preview_id` |
| POST | `/skills/import/apply` | `{preview_id, slugs: []}` | applies the previewed changes of the ticked slugs only; 409 if anything changed since |
| GET | `/skills/export?ids=` | | zip of the latest versions of the picked skills, named `<n>-skills-<UTC timestamp, ISO basic>.zip` |

The CLI (`app skills import <folder>` / `export <folder>`) calls the same services directly.

## 2a. Skill drafts (D41)

Bots create drafts with the `propose_skill` tool (`conversation-rules.md` §7); there is no
endpoint to create one.

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| GET | `/skill-drafts/{id}` | | draft with `diff` against `base_version` for an edit |
| POST | `/skill-drafts/{id}/decision` | `{action: "approve" \| "reject", row_version, slug?, name?, description?, body_md?, changelog?, pin: bool, always_load: bool}` | text fields only when the owner edited; edited text is checked by the guard again (422 `sensitive_data`, no override); 409 `draft_not_pending`, `draft_stale`, `slug_taken` |

## 3. Models

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/models` | catalog entries with `available` (key present), `efforts`, `multimodal` and `provider_tools`; never key values |
| GET | `/tools` | the tool catalog (`domain-model.md` §4.1): id, label, kind, provider, job, added, sends_data_out, web, line, off_line, needs |

## 4. Bots

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| GET | `/bots?include_deleted=false` | | each with `available`, `skills` (pins), `last_activity_at` (latest message or run, NULL if none), `pinned_position`, `counts` (`projects`, `conversations`), `status` (most urgent, `design/components/bot-status.md` §3) and `health`; returned in header order (`domain-model.md` §2) |
| PUT | `/bots/pins` | `{bot_ids: [...]}` | the whole pinned list, in order; bots not listed are unpinned. A deleted or unknown id, or a repeated id → 409 `bot_list_changed`, positions unchanged; emits `bots.reordered` |
| POST | `/bots` | `{name, description, persona_md, avatar_style, avatar_colour, avatar_id?, model_id, effort?, history_share_pct?, request_limit?, max_reply_chars?, tool_settings?, pins: [{skill_id, skill_version_id?, always_load}], cloned_from_bot_id?}` | header `Idempotency-Key` (required, a UUID from the page): a repeat with the same key returns the first result and creates nothing (safe retry, `bots.md` UI-5.6). `skill_version_id` omitted = latest; omitted Advanced values and `tool_settings` take the defaults; 422 per field with the step it belongs to (`avatar_colour` must be `#RRGGBB`); 422 `tool_job_conflict` |
| GET | `/bots/{id}` | | includes conversations it is in. A bot in Trash returns 422 `bot_deleted`; a purged bot returns 410 `bot_purged`. Old messages still show a purged bot's name and avatar through `author` (§8) |
| PATCH | `/bots/{id}` | `{row_version, name?, description?, persona_md?, avatar_style?, avatar_colour?, avatar_id?, history_share_pct?, request_limit?, max_reply_chars?, tool_settings?}` | one save of the Profile or Model tab, in one transaction (`design/components/bot-page.md` §4.1). `avatar_id` is required when `avatar_style` becomes `upload`. `model_id`/`effort` → 422 |
| DELETE | `/bots/{id}` | | soft delete; with D50 a move to Trash. Unpins the bot |
| GET | `/bots/{id}/clone-template` | | prefilled POST body for the create form, without `avatar_colour`: the page picks it (the palette is frontend only, `design/components/bot-avatar.md` §5) |
| PUT | `/bots/{id}/skills/{skill_id}` | `{skill_version_id, always_load}` | assign, upgrade, downgrade, toggle |
| DELETE | `/bots/{id}/skills/{skill_id}` | | unassign |
| POST | `/avatars` | image upload | returns `{avatar_id, url}`; re-encoded (security.md). The crop card sends the cropped image. The bot uses it only after a POST or PATCH with `avatar_id` |
| GET | `/avatars/{sha}.webp` | | served with long cache headers |

## 5. Conversations

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| GET | `/conversations` | | sorted by `last_activity_at`; includes member avatars for the rail icon and `unread` |
| POST | `/conversations` | `{title?}` | a given `title` sets `title_source: "manual"` (D46) |
| GET | `/conversations/{id}` | | settings (with effective values), members, active leaf |
| PATCH | `/conversations/{id}` | `{row_version, title?, bot_chat_enabled?, bot_turn_limit?}` | `null` = inherit global. A PATCH writes only the fields in its body. Send `title` only when the owner changed it: any `title` sets `title_source: "manual"`, and the app never writes an auto title after that (D46) |
| DELETE | `/conversations/{id}` | | moves to Trash (D60): stops its runs first; its saved files stay in the Library of its place; its unsaved changes go to Trash with it; restore endpoint with the Trash page round (M5b) |
| POST | `/conversations/{id}/read` | `{seq}` | sets `last_read_seq` (never moves backwards); drives unread dots and the "New" divider |
| GET | `/conversations/{id}/messages?before_seq=&limit=` | | the **active path**, newest page first; each message has `siblings: {index, count, ids}` |
| POST | `/conversations/{id}/messages` | `{client_id, content_md, mentions: [bot_id], attachment_ids: []}` | 201; routing happens server side. A repeated `client_id` in the same conversation returns 200 with the original message and routes nothing (safe retry) |
| POST | `/conversations/{id}/messages/{message_id}/edit` | `{client_id, content_md, mentions, attachment_ids}` | creates a sibling branch; 409 `run_in_progress` |
| PUT | `/conversations/{id}/active-branch` | `{message_id}` | switch to a sibling; leaf = newest below it |
| POST | `/conversations/{id}/attachments` | multipart files | returns `attachment_ids`; saved under `attachments/<yyyy-mm-dd>-<conversation-slug>/` (D52) |
| POST | `/conversations/{id}/members` | `{bot_id}` | 409 `already_member`; posts the history card. **M3 only:** the bot becomes `active` at once with `history_from_seq = 0`, and no card is posted (the history card comes in M4) |
| POST | `/conversations/{id}/members/{bot_id}/history` | `{mode: "full" \| "from_join"}` | activates the member |
| DELETE | `/conversations/{id}/members/{bot_id}` | | removes |
| PUT | `/messages/{id}/feedback` | `{rating: "up" \| "down", note_md?}` | creates or replaces the rating of a bot message (D51); 409 `feedback_not_allowed` when it is not a complete bot message; 422 `sensitive_data` for the note |
| DELETE | `/messages/{id}/feedback` | | removes the rating (D51) |
| POST | `/conversations/{id}/stop` | | cancels queued and running runs |
| POST | `/runs/{id}/cancel` | | cancels one **queued** run (status `stopped`, no message); 409 `run_not_queued` once it has started (use Stop) |
| GET | `/conversations/{id}/files?path=` | | workspace listing (read-only) |
| GET | `/conversations/{id}/files/content?path=` | | file bytes with safe headers (security.md) |

## 6. Handoffs

| Method | Path | Body |
| --- | --- | --- |
| POST | `/handoffs/{id}/decision` | `{action: "approve" \| "request_changes" \| "reject", note?, add_target?: bool}` |

## 7. Settings, health, stream, usage and statistics

All `from`/`to` parameters are absolute ISO-8601 instants; the frontend resolves relative
expressions first (`requirements/time-range-picker.md` §Contract with the backend and the URL). `tz` is an IANA zone name; `bucket` is `5m|1h|1d|1w`.


| Method | Path | Notes |
| --- | --- | --- |
| GET / PATCH | `/settings` | `{bot_chat_enabled, bot_turn_limit, runs_per_conversation_per_hour, daily_cap_usd, provider_caps_usd, timezone, bot_order, bot_order_direction, conversation limits, bot limits and health thresholds (`domain-model.md` §10)}`. PATCH validates each key with Zod and returns 422 for a value out of range (conversation limits: `conversation-rules.md` §9); GET adds `today_spend_usd` and `today_spend_by_provider_usd` |
| GET | `/usage?group_by=bot\|conversation\|provider\|day&from=&to=` | tokens and estimated cost (D21). With `group_by=bot`, title requests are one group with `bot_id: null` and the label "Conversation titles" (D46) |
| GET | `/stats/summary?from=&to=&tz=&conversation_id=` | tiles with previous-period comparison (D24) |
| GET | `/stats/models?from=&to=&tz=&bucket=&conversation_id=&metric=cost\|tokens\|requests` | series per model per bucket + table |
| GET | `/stats/bots?from=&to=&conversation_id=&metric=runs\|cost\|tokens\|active_time` | ranking + table |
| GET | `/stats/skills?from=&to=&conversation_id=` | ranking, table, never-loaded pins |
| GET | `/stats/{section}.csv?…` | CSV export of a section's table |
| GET | `/health` | `{db: ok, worker: ok, catalog: {models, available}}` |
| GET | `/setup` | Get started status (UI-1.7): `{has_available_model, has_skill, has_bot, has_conversation}` |
| POST | `/setup/examples` | imports the example skills and creates BA and Designer; idempotent, returns what was created and what already existed (UI-1.9) |
| GET | `/stream` | SSE (`realtime-events.md`) |

## 8. Key schemas (abridged)

```ts
Message {
  id, conversation_id, seq, parent_message_id, author_type: "human"|"bot"|"system",
  author: { id, name, avatar_url, deleted: boolean } | null,
  kind: "text"|"history_choice"|"handoff"|"skill_draft"|"notice",
  content_md, mentions: BotRef[], attachments: Attachment[],
  status: "streaming"|"complete"|"failed"|"stopped",
  skills_used: { skill_id, slug, version, mode: "always"|"loaded" }[],   // D15
  usage: { input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, estimated_cost_usd | null } | null,  // D21
  run: { model_id, model_label, effort } | null,   // read-only copy from the run that wrote a bot message (runs.model_id, runs.effort), never the bot's current settings; model_label falls back to model_id when the model is not in the catalog; null for human and system messages
  siblings: { index, count, ids } | null,
  card: HistoryChoiceCard | HandoffCard | SkillDraftCard | null,
  created_at
}

Conversation {
  id, title,
  title_source: "default"|"auto"|"manual",   // D46; auto_title_status is internal and not returned
  members, unread, row_version, …   // other fields as in §5
}

Bot {
  id, slug, name, description, persona_md, avatar_style, avatar_colour, avatar_url, model_id, model_label, effort,
  available: boolean, unavailable_reason: "model_removed"|"no_api_key"|null,
  history_share_pct, request_limit, max_reply_chars, tool_settings: { [tool_id]: boolean },
  pinned_position: number | null, last_activity_at, counts: { projects, conversations },
  status: { state, conversation_id, conversation_title, also_running: number } | null,   // bot-status.md §3
  health: { level: "cannot_run"|"needs_attention", reason } | null,                     // bots.md UI-4.6
  pins: { skill_id, slug, name, version, latest_version, always_load, deprecated }[],
  deleted: boolean, cloned_from_bot_id, created_at
}

Skill {
  id, slug, name, author_id, is_author: boolean,
  latest_version: { version, description, changelog, created_at },
  bots_using: number, bots_outdated: number, deprecated: boolean, cloned_from: {...}|null
}
```
