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
      // An unknown field (Zod `.strict()`) names its keys in `keys`, not in `path`. `field` is the
      // first unknown key with its full path; the message names every unknown key (api.md §1).
      const unknown = issue.code === "unrecognized_keys" ? issue.keys : undefined;
      const field = fieldPath(
        unknown === undefined ? issue.path : [...issue.path, ...unknown.slice(0, 1)],
      );
      const message =
        unknown === undefined
          ? issue.message
          : `Unknown ${unknown.length === 1 ? "field" : "fields"}: ${unknown.map(keyName).join(", ")}.`;
      throw new ApiFailure("validation_error", message, field === "" ? undefined : field);
    },
  });
}

// A key in the message of an unknown field (api.md §1): plain when it is made of letters, digits,
// `_`, `$` and `-`, else a JSON string, so a comma or a quote in a key is not read as a separator.
function keyName(key: string): string {
  return /^[A-Za-z0-9_$-]+$/.test(key) ? key : JSON.stringify(key);
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

// A route that is not a Zod route still refuses a query string (security.md §2.9), with 422
// `validation_error`, as a Zod route with `NoQuery` does. An empty `?` and an empty key (`?=1`)
// pass, as there.
export function noQueryString(): MiddlewareHandler<HttpEnv> {
  return async (c, next) => {
    const key = [...new URL(c.req.url).searchParams.keys()].find((name) => name !== "");
    if (key !== undefined) {
      throw new ApiFailure("validation_error", `Unrecognized key: "${key}"`, key);
    }
    await next();
  };
}
