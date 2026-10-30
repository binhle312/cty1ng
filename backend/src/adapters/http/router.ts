import { OpenAPIHono } from "@hono/zod-openapi";
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
      // An unknown field (Zod `.strict()`) names the field in `keys`, not in `path`.
      const path = issue.code === "unrecognized_keys" ? [...issue.path, ...issue.keys] : issue.path;
      const field = path.map(String).join(".");
      throw new ApiFailure("validation_error", issue.message, field === "" ? undefined : field);
    },
  });
}
