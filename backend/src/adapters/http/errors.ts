import { ERROR_STATUS, type ApiError, type ErrorCode } from "@cty1ng/shared/errors";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { DomainError } from "../../core/errors.ts";
import type { HttpEnv } from "./context.ts";

// A known failure: a service or a middleware throws it, and it becomes the one error shape of
// api.md §1.
export class ApiFailure extends Error {
  readonly code: ErrorCode;
  readonly field: string | undefined;
  readonly current: unknown;

  constructor(code: ErrorCode, message: string, field?: string, current?: unknown) {
    super(message);
    this.code = code;
    this.field = field;
    this.current = current;
  }
}

export function errorResponse(c: Context<HttpEnv>, failure: ApiFailure): Response {
  const body: ApiError = {
    error: {
      code: failure.code,
      message: failure.message,
      ...(failure.field === undefined ? {} : { field: failure.field }),
      ...(failure.current === undefined ? {} : { current: failure.current }),
      request_id: c.get("requestId"),
    },
  };
  return c.json(body, ERROR_STATUS[failure.code]);
}

// The generic error handler (security.md §2.10). Known failures keep their code. Anything else
// is logged in full, with the request id, and the client gets `internal_error` with no stack,
// SQL or path.
export function onError(error: Error, c: Context<HttpEnv>): Response {
  if (error instanceof ApiFailure) return errorResponse(c, error);
  if (error instanceof DomainError) {
    return errorResponse(c, new ApiFailure(error.code, error.message, error.field, error.current));
  }
  // Framework rejections (malformed JSON, a missing or wrong Content-Type): api.md §1 has one
  // code for a request that cannot be read.
  if (error instanceof HTTPException && error.status === 413) {
    return errorResponse(c, new ApiFailure("too_large", "The request body is too large."));
  }
  if (error instanceof HTTPException && error.status >= 400 && error.status < 500) {
    return errorResponse(c, new ApiFailure("bad_request", "The request is malformed."));
  }
  c.get("log").error({ err: error }, "unhandled error");
  return c.json(
    {
      error: {
        code: "internal_error",
        message: "Something went wrong. The server log has the details.",
        request_id: c.get("requestId"),
      },
    } satisfies ApiError,
    500,
  );
}

export function notFound(c: Context<HttpEnv>): Response {
  return errorResponse(c, new ApiFailure("not_found", "No such endpoint."));
}
