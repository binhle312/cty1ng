import { OpenAPIHono } from "@hono/zod-openapi";
import type { MiddlewareHandler } from "hono";
import type { HttpEnv } from "./context.ts";
import { ApiFailure } from "./errors.ts";

// Every router is made here, so every route validates the same way (api.md §1): an unknown
// field or a bad value gives 422 `validation_error` with the field.
export function createRouter() {
  return new OpenAPIHono<HttpEnv>({
    defaultHook: (result) => {
      if (result.success) return undefined;
      const issue = result.error.issues[0];
      if (issue === undefined)
        throw new ApiFailure("validation_error", "The request is not valid.");
      // A malformed TypeID or a wrong prefix in the path (api.md §1, D36).
      if (result.target === "param" && String(issue.path.at(-1)).endsWith("id")) {
        throw new ApiFailure("invalid_id", issue.message, fieldPath(issue.path));
      }
      // An unknown field (Zod `.strict()`) names the field in `keys`, not in `path`.
      const path = issue.code === "unrecognized_keys" ? [...issue.path, ...issue.keys] : issue.path;
      const field = fieldPath(path);
      throw new ApiFailure("validation_error", issue.message, field === "" ? undefined : field);
    },
  });
}

// The one format of `field` (api.md §1): a dot before a key of an object, `[i]` for an index of a
// list, as in `pins[0].skill_id`. The services write list items the same way (`bots[1]`).
function fieldPath(path: readonly PropertyKey[]): string {
  return path
    .map((part, index) =>
      typeof part === "number" ? `[${String(part)}]` : `${index === 0 ? "" : "."}${String(part)}`,
    )
    .join("");
}

// A route that is not a Zod route still refuses a query string (security.md §2.9), with the
// answer of a Zod route with `NoQuery`. An empty `?` passes, as there.
export function noQueryString(): MiddlewareHandler<HttpEnv> {
  return async (c, next) => {
    const key = new URL(c.req.url).searchParams.keys().next();
    if (key.done !== true) {
      throw new ApiFailure("validation_error", `Unrecognized key: "${key.value}"`, key.value);
    }
    await next();
  };
}
