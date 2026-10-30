import type { Health } from "../../core/health/health.service.ts";
import type { Logger } from "pino";
import { notFound, onError } from "./errors.ts";
import {
  accessLog,
  corsForAllowedOrigins,
  hostCheck,
  maxBody,
  originCheck,
  requestId,
  securityHeaders,
} from "./middleware.ts";
import { createRouter } from "./router.ts";
import { healthRoutes } from "./routes/health.ts";
import { streamRoutes, type OpenStream } from "./routes/stream.ts";
import { testEventRoutes } from "./routes/test-events.ts";

export interface HttpDeps {
  log: Logger;
  allowedHosts: readonly string[];
  allowedOrigins: readonly string[];
  health: () => Promise<Health>;
  openStream: OpenStream;
  // Only when APP_ENV=test.
  testPing: ((note: string) => Promise<number>) | null;
}

// The Hono app. Middleware order is the request path of the M0b plan §4.
export function createHttpApp(deps: HttpDeps) {
  const app = createRouter();

  app.use(requestId(deps.log));
  app.use(accessLog());
  app.use(hostCheck(deps.allowedHosts));
  app.use(originCheck(deps.allowedOrigins));
  app.use(securityHeaders());
  app.use(corsForAllowedOrigins(deps.allowedOrigins));
  app.use(maxBody());
  app.onError(onError);
  app.notFound(notFound);

  const api = createRouter()
    .route("/", healthRoutes(deps.health))
    .route("/", streamRoutes(deps.openStream));
  if (deps.testPing !== null) api.route("/", testEventRoutes(deps.testPing));
  app.route("/api", api);

  app.doc31("/api/openapi.json", {
    openapi: "3.1.0",
    info: { title: "cty1ng", version: "0.0.0" },
  });
  return app;
}
