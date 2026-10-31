import { z } from "zod";

// Error codes from the table in api.md §1 "Errors". Add a code there first, then here and in
// ERROR_STATUS (the compiler checks that both lists match).
export const ERROR_CODES = [
  "invalid_skill_file",
  "invalid_import",
  "bad_request",
  "not_author",
  "origin_rejected",
  "host_rejected",
  "not_found",
  "bot_purged",
  "name_taken",
  "slug_taken",
  "stale_write",
  "run_in_progress",
  "already_member",
  "handoff_not_pending",
  "run_not_queued",
  "draft_not_pending",
  "draft_stale",
  "bot_list_changed",
  "idempotency_key_reused",
  "place_in_trash",
  "memory_full",
  "conversation_in_project",
  "proposal_not_ready",
  "copy_not_pending",
  "save_not_waiting",
  "nothing_unsaved",
  "instructions_changed",
  "not_deprecated",
  "feedback_not_allowed",
  "preview_expired",
  "too_large",
  "validation_error",
  "invalid_id",
  "mention_not_member",
  "bot_unavailable",
  "bot_deleted",
  "skill_deprecated",
  "version_mismatch",
  "effort_not_supported",
  "model_not_available",
  "sensitive_data",
  "tool_job_conflict",
  "tool_not_available",
  "rate_limited",
  "daily_cap_reached",
  "provider_cap_reached",
  "price_unknown",
  "internal_error",
] as const;

export const ErrorCode = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCode>;

// The HTTP status of each code (api.md §1).
export const ERROR_STATUS: Readonly<
  Record<ErrorCode, 400 | 403 | 404 | 409 | 410 | 413 | 422 | 429 | 500>
> = {
  invalid_skill_file: 400,
  invalid_import: 400,
  bad_request: 400,
  not_author: 403,
  origin_rejected: 403,
  host_rejected: 403,
  not_found: 404,
  bot_purged: 410,
  name_taken: 409,
  slug_taken: 409,
  stale_write: 409,
  run_in_progress: 409,
  already_member: 409,
  handoff_not_pending: 409,
  run_not_queued: 409,
  draft_not_pending: 409,
  draft_stale: 409,
  bot_list_changed: 409,
  idempotency_key_reused: 409,
  place_in_trash: 409,
  memory_full: 409,
  conversation_in_project: 409,
  proposal_not_ready: 409,
  copy_not_pending: 409,
  save_not_waiting: 409,
  nothing_unsaved: 409,
  instructions_changed: 409,
  not_deprecated: 409,
  feedback_not_allowed: 409,
  preview_expired: 409,
  too_large: 413,
  validation_error: 422,
  invalid_id: 422,
  mention_not_member: 422,
  bot_unavailable: 422,
  bot_deleted: 422,
  skill_deprecated: 422,
  version_mismatch: 422,
  effort_not_supported: 422,
  model_not_available: 422,
  sensitive_data: 422,
  tool_job_conflict: 422,
  tool_not_available: 422,
  rate_limited: 429,
  daily_cap_reached: 429,
  provider_cap_reached: 429,
  price_unknown: 429,
  internal_error: 500,
};

// The one error shape of every response (api.md §1). `request_id` matches the `X-Request-Id`
// header and the server log (security.md §2.10).
export const ApiError = z
  .object({
    error: z
      .object({
        code: ErrorCode,
        message: z.string(),
        field: z.string().optional(),
        request_id: z.string().optional(),
      })
      .strict(),
  })
  .strict();
export type ApiError = z.infer<typeof ApiError>;
