import { OpenAPIHono } from "@hono/zod-openapi";
import type { Logger } from "pino";
import type { HealthService } from "../../core/health/health.service";
import type { TestEventsService } from "../../core/events/test-events.service";
import type { HttpEnv } from "./context";
import { errorResponse, validationErrorResponse } from "./errors";
import { requestContext } from "./request-context";
import { healthRoute, streamRoute, TestPingBody } from "./routes";
import {
  corsForAllowedOrigins,
  hostCheck,
  jsonBodyLimit,
  originCheck,
  securityHeaders,
} from "./security";

export interface HttpDeps {
  port: number;
  allowedOrigins: readonly string[];
  logger: Logger;
  health: HealthService;
  /** The transport adapter's stream for one subscriber; wired by app/. */
  openStream: (input: {
    lastEventId: string | undefined;
    signal: AbortSignal;
  }) => ReadableStream<Uint8Array>;
  /** Present only when APP_ENV=test; the test route is mounted only then. */
  testEvents?: TestEventsService;
}

/**
 * The Hono app. Handlers parse input, call one service and map the result (AGENTS.md §5
 * rule 2). Middleware order matters: headers first, so every rejection carries them.
 */
export function createHttpApp(deps: HttpDeps): OpenAPIHono<HttpEnv> {
  const app = new OpenAPIHono<HttpEnv>({
    defaultHook: (result, c) => {
      if (!result.success) return validationErrorResponse(c, result.error);
      return undefined;
    },
  });

  app.use(requestContext({ logger: deps.logger }));
  app.use(securityHeaders());
  app.use(hostCheck({ port: deps.port }));
  app.use(originCheck({ port: deps.port, allowedOrigins: deps.allowedOrigins }));
  app.use(corsForAllowedOrigins({ allowedOrigins: deps.allowedOrigins }));
  app.use(jsonBodyLimit());

  app.onError((error, c) => {
    // The full error stays in the log; the client gets a code and the request id only.
    c.get("log").error({ event: "http.unhandled_error", err: error }, "unhandled error");
    return errorResponse(c, {
      status: 500,
      code: "internal_error",
      message: "Something went wrong.",
    });
  });
  app.notFound((c) => errorResponse(c, { status: 404, code: "not_found", message: "Not found." }));

  app.openapi(healthRoute, async (c) => c.json(await deps.health.check(), 200));

  app.openapi(streamRoute, (c) => {
    const body = deps.openStream({
      lastEventId: c.req.valid("header")["last-event-id"],
      signal: c.req.raw.signal,
    });
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  });

  const testEvents = deps.testEvents;
  if (testEvents !== undefined) {
    // Plain route on purpose: it stays out of the OpenAPI schema and the generated client.
    app.post("/api/_test/events", async (c) => {
      let json: unknown;
      try {
        json = await c.req.json();
      } catch {
        return errorResponse(c, { status: 400, code: "bad_request", message: "Invalid JSON." });
      }
      const body = TestPingBody.safeParse(json);
      if (!body.success) return validationErrorResponse(c, body.error);
      return c.json(await testEvents.ping(body.data.note), 201);
    });
  }

  app.doc31("/api/openapi.json", {
    openapi: "3.1.0",
    info: { title: "cty1ng API", version: "0.0.0" },
  });

  return app;
}
