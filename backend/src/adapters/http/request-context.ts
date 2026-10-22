import { randomUUID } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import type { Logger } from "pino";
import type { HttpEnv } from "./context";

/**
 * Gives each request an id (returned in `X-Request-Id` and in error bodies, security.md §2.10)
 * and a child logger, and logs one line when the response is ready. The query string is not
 * logged: it can carry user text.
 */
export function requestContext(input: { logger: Logger }): MiddlewareHandler<HttpEnv> {
  return async (c, next) => {
    const requestId = randomUUID();
    const log = input.logger.child({ request_id: requestId });
    c.set("requestId", requestId);
    c.set("log", log);
    const started = performance.now();
    await next();
    c.header("X-Request-Id", requestId);
    log.info(
      {
        event: "http.request",
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        ms: Math.round(performance.now() - started),
      },
      "request",
    );
  };
}
