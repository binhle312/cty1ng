import { z } from "zod";

/** Every API error code (docs/api.md §1). Add a code there first, then here. */
export const ERROR_CODES = [
  // 400
  "invalid_skill_file",
  "invalid_import",
  "bad_request",
  // 403
  "not_author",
  "origin_rejected",
  "host_rejected",
  // 404
  "not_found",
  // 409
  "name_taken",
  "slug_taken",
  "stale_write",
  "run_in_progress",
  "already_member",
  "handoff_not_pending",
  "run_not_queued",
  "draft_not_pending",
  "draft_stale",
  // 413
  "too_large",
  // 422
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
  // 429
  "rate_limited",
  "daily_cap_reached",
  // 500
  "internal_error",
] as const;

export const ErrorCode = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCode>;

/** The one error shape (docs/api.md §1 Errors). */
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
