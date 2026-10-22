import type { ApiError, ErrorCode } from "@cty1ng/shared";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { z } from "zod";
import type { HttpEnv } from "./context";

/** Builds the one error shape (api.md §1) and attaches the request id. */
export function errorResponse(
  c: Context<HttpEnv>,
  input: { status: ContentfulStatusCode; code: ErrorCode; message: string; field?: string },
): Response {
  const body: ApiError = {
    error: {
      code: input.code,
      message: input.message,
      ...(input.field === undefined ? {} : { field: input.field }),
      request_id: c.get("requestId"),
    },
  };
  return c.json(body, input.status);
}

/** 422 `validation_error` naming the first field that failed (security.md §2.9). */
export function validationErrorResponse(c: Context<HttpEnv>, error: z.ZodError): Response {
  const issue = error.issues[0];
  const field = issue === undefined ? undefined : fieldPath(issue.path, issue);
  return errorResponse(c, {
    status: 422,
    code: "validation_error",
    message: issue?.message ?? "Invalid request.",
    ...(field === undefined || field === "" ? {} : { field }),
  });
}

function fieldPath(path: readonly PropertyKey[], issue: z.core.$ZodIssue): string {
  // Unknown keys are reported on the parent object; name the key itself.
  const keys = issue.code === "unrecognized_keys" ? [...path, issue.keys[0] ?? ""] : path;
  return keys
    .map((key, index) =>
      typeof key === "number" ? `[${key}]` : `${index === 0 ? "" : "."}${String(key)}`,
    )
    .join("");
}
