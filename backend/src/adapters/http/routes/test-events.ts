import { createRoute, z } from "@hono/zod-openapi";
import { TestPingData } from "@cty1ng/shared/events";
import { createRouter } from "../router.ts";

// POST /api/_test/events: mounted only when APP_ENV=test, and hidden from the OpenAPI schema
// (realtime-events.md §4, `test.ping`).

const route = createRoute({
  method: "post",
  path: "/_test/events",
  hide: true,
  request: { body: { content: { "application/json": { schema: TestPingData } }, required: true } },
  responses: {
    201: {
      description: "The event was appended",
      content: { "application/json": { schema: z.object({ seq: z.number().int() }) } },
    },
  },
});

export function testEventRoutes(testPing: (note: string) => Promise<number>) {
  return createRouter().openapi(route, async (c) => {
    const seq = await testPing(c.req.valid("json").note);
    return c.json({ seq }, 201);
  });
}
