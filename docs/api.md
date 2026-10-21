# HTTP API

This document owns the endpoint list, shapes and error codes. The OpenAPI schema
(`/api/openapi.json`) is generated from the Hono routes' Zod schemas (`@hono/zod-openapi`) and is the machine-readable contract; the
frontend client is generated from it (`pnpm gen:api`). CI fails if the generated client is out
of date. When this document and the OpenAPI schema disagree, raise it.

## 1. Conventions

- Base path `/api`. JSON in and out (`multipart/form-data` for uploads).
- Ids are UUIDv7 strings (D22). Timestamps are ISO-8601 UTC.
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
| 409 | `name_taken`, `slug_taken`, `run_in_progress` (e.g. edit while running), `already_member`, `handoff_not_pending`, `run_not_queued` |
| 413 | `too_large` |
| 422 | `validation_error`, `mention_not_member`, `bot_unavailable`, `bot_deleted`, `skill_deprecated`, `version_mismatch`, `effort_not_supported`, `model_not_available` |
| 429 | `rate_limited` (runs per hour), `daily_cap_reached` |

## 2. Skills

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| GET | `/skills?include_deprecated=false` | | list with `latest_version`, `bots_using`, `bots_outdated` |
| POST | `/skills` | `{slug, name, description, body_md}` | creates v1, author = owner |
| GET | `/skills/{id}` | | includes latest version body |
| PATCH | `/skills/{id}` | `{name}` | metadata only; author only |
| POST | `/skills/{id}/versions` | `{description, body_md, changelog?, upgrade_bot_ids: []}` | author only; creates N+1; moves listed pins |
| GET | `/skills/{id}/versions` | | list, newest first |
| GET | `/skills/{id}/versions/{version}` | | one version (used by provenance chips) |
| GET | `/skills/{id}/diff?from=2&to=5` | | unified diff of bodies and descriptions |
| POST | `/skills/{id}/versions/{version}/restore` | `{changelog?}` | creates N+1 with that content |
| GET | `/skills/{id}/upgrade-candidates` | | author's bots pinned to older versions (for the save dialog) |
| POST | `/skills/{id}/clone` | `{slug?, version?}` | new skill owned by caller |
| POST | `/skills/{id}/deprecate` · `/undeprecate` | | author only |
| POST | `/skills/import/preview` | zip upload | returns per-skill `new / changed (diff) / unchanged / invalid / conflict` and a `preview_id` |
| POST | `/skills/import/apply` | `{preview_id}` | applies exactly the previewed changes; 409 if anything changed since |
| GET | `/skills/export` | | zip of latest versions |

The CLI (`app skills import <folder>` / `export <folder>`) calls the same services directly.

## 3. Models

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/models` | catalog entries with `available` (key present) and `efforts`; never key values |

## 4. Bots

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| GET | `/bots?include_deleted=false` | | each with `available`, `skills` (pins) |
| POST | `/bots` | `{name, persona_md, model_id, effort?, write_paths?, request_limit?, max_reply_chars?, pins: [{skill_id, skill_version_id?, always_load}], avatar_id?, cloned_from_bot_id?}` | `skill_version_id` omitted = latest |
| GET | `/bots/{id}` | | includes conversations it is in |
| PATCH | `/bots/{id}` | `{name?, persona_md?, write_paths?, request_limit?, max_reply_chars?}` | `model_id`/`effort` → 422 |
| DELETE | `/bots/{id}` | | soft delete |
| GET | `/bots/{id}/clone-template` | | prefilled POST body for the create form |
| PUT | `/bots/{id}/skills/{skill_id}` | `{skill_version_id, always_load}` | assign, upgrade, downgrade, toggle |
| DELETE | `/bots/{id}/skills/{skill_id}` | | unassign |
| POST | `/avatars` | image upload | returns `{avatar_id, url}`; re-encoded (security.md) |
| PUT | `/bots/{id}/avatar` | `{avatar_id}` or `{avatar_id: null}` for default | |
| GET | `/avatars/{sha}.webp` | | served with long cache headers |

## 5. Conversations

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| GET | `/conversations` | | sorted by `last_activity_at`; includes member avatars for the rail icon and `unread` |
| POST | `/conversations` | `{title?}` | |
| GET | `/conversations/{id}` | | settings (with effective values), members, active leaf |
| PATCH | `/conversations/{id}` | `{title?, icon_preset?, bot_chat_enabled?, bot_turn_limit?}` | `null` = inherit global |
| DELETE | `/conversations/{id}` | | soft delete, workspace to trash |
| POST | `/conversations/{id}/read` | `{seq}` | sets `last_read_seq` (never moves backwards); drives unread dots and the "New" divider |
| GET | `/conversations/{id}/messages?before_seq=&limit=` | | the **active path**, newest page first; each message has `siblings: {index, count, ids}` |
| POST | `/conversations/{id}/messages` | `{client_id, content_md, mentions: [bot_id], attachment_ids: []}` | 201; routing happens server side. A repeated `client_id` in the same conversation returns 200 with the original message and routes nothing (safe retry) |
| POST | `/conversations/{id}/messages/{message_id}/edit` | `{client_id, content_md, mentions, attachment_ids}` | creates a sibling branch; 409 `run_in_progress` |
| PUT | `/conversations/{id}/active-branch` | `{message_id}` | switch to a sibling; leaf = newest below it |
| POST | `/conversations/{id}/attachments` | multipart files | returns `attachment_ids`; saved under `inbox/` |
| POST | `/conversations/{id}/members` | `{bot_id}` | 409 `already_member`; posts the history card |
| POST | `/conversations/{id}/members/{bot_id}/history` | `{mode: "full" \| "from_join"}` | activates the member |
| DELETE | `/conversations/{id}/members/{bot_id}` | | removes |
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
| GET / PATCH | `/settings` | `{bot_chat_enabled, bot_turn_limit, runs_per_hour, daily_cap_usd, timezone}`; GET adds `today_spend_usd` |
| GET | `/usage?group_by=bot\|conversation\|provider\|day&from=&to=` | tokens and estimated cost (D21) |
| GET | `/stats/summary?from=&to=&tz=&conversation_id=` | tiles with previous-period comparison (D24) |
| GET | `/stats/models?from=&to=&tz=&bucket=&conversation_id=&metric=cost\|tokens\|requests` | series per model per bucket + table |
| GET | `/stats/bots?from=&to=&conversation_id=&metric=runs\|cost\|tokens\|active_time` | ranking + table |
| GET | `/stats/skills?from=&to=&conversation_id=` | ranking, table, never-loaded pins |
| GET | `/stats/{section}.csv?…` | CSV export of a section's table |
| GET | `/health` | `{db: ok, worker: ok, catalog: {models, available}}` |
| GET | `/stream` | SSE (`realtime-events.md`) |

## 8. Key schemas (abridged)

```ts
Message {
  id, conversation_id, seq, parent_message_id, author_type: "human"|"bot"|"system",
  author: { id, name, avatar_url, deleted: boolean } | null,
  kind: "text"|"history_choice"|"handoff"|"notice",
  content_md, mentions: BotRef[], attachments: Attachment[],
  status: "streaming"|"complete"|"failed"|"stopped",
  skills_used: { skill_id, slug, version, mode: "always"|"loaded" }[],   // D15
  usage: { input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, estimated_cost_usd | null } | null,  // D21
  siblings: { index, count, ids } | null,
  card: HistoryChoiceCard | HandoffCard | null,
  created_at
}

Bot {
  id, slug, name, description, persona_md, avatar_url, model_id, model_label, effort,
  available: boolean, unavailable_reason: "model_removed"|"no_api_key"|null,
  write_paths, request_limit, max_reply_chars,
  pins: { skill_id, slug, name, version, latest_version, always_load, deprecated }[],
  deleted: boolean, cloned_from_bot_id, created_at
}

Skill {
  id, slug, name, author_id, is_author: boolean,
  latest_version: { version, description, changelog, created_at },
  bots_using: number, bots_outdated: number, deprecated: boolean, cloned_from: {...}|null
}
```
