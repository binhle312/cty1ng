import { createRoute, z } from "@hono/zod-openapi";
import { ApiError } from "@cty1ng/shared";

export const Health = z
  .object({
    db: z.enum(["ok", "error"]),
    worker: z.enum(["ok", "not_started"]),
    catalog: z.object({
      models: z.number().int().nonnegative(),
      available: z.number().int().nonnegative(),
    }),
  })
  .openapi("Health");

// The shared schema is plain Zod (no `.openapi()`), so it is inlined in the document.
const ErrorBody = ApiError;

export const healthRoute = createRoute({
  method: "get",
  path: "/api/health",
  operationId: "getHealth",
  summary: "Database, worker and catalog status (api.md §7)",
  responses: {
    200: { description: "Status", content: { "application/json": { schema: Health } } },
    403: {
      description: "Host or Origin rejected",
      content: { "application/json": { schema: ErrorBody } },
    },
  },
});

export const streamRoute = createRoute({
  method: "get",
  path: "/api/stream",
  operationId: "getStream",
  summary: "Server-Sent Events stream of every event (realtime-events.md §2)",
  request: {
    headers: z.object({
      "last-event-id": z.string().optional().openapi({ description: "Last seq the client saw" }),
    }),
  },
  responses: {
    200: {
      description: "An endless `text/event-stream`",
      content: { "text/event-stream": { schema: z.string() } },
    },
    403: {
      description: "Host or Origin rejected",
      content: { "application/json": { schema: ErrorBody } },
    },
  },
});

/** Body of the test-only endpoint; not part of the OpenAPI schema. */
export const TestPingBody = z.object({ note: z.string().max(200) }).strict();
