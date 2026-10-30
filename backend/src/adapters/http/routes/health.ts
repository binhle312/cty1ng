import { createRoute, z } from "@hono/zod-openapi";
import type { Health } from "../../../core/health/health.service.ts";
import { createRouter } from "../router.ts";

const HealthBody = z
  .object({
    db: z.enum(["ok", "error"]),
    worker: z.enum(["ok", "not_started", "error"]),
    catalog: z.object({ models: z.number().int(), available: z.number().int() }),
  })
  .openapi("Health");
const route = createRoute({
  method: "get",
  path: "/health",
  responses: {
    200: {
      description: "The database works",
      content: { "application/json": { schema: HealthBody } },
    },
    503: {
      description: "The database does not answer",
      content: { "application/json": { schema: HealthBody } },
    },
  },
});

export function healthRoutes(health: () => Promise<Health>) {
  return createRouter().openapi(route, async (c) => {
    const body = await health();
    return body.db === "ok" ? c.json(body, 200) : c.json(body, 503);
  });
}
