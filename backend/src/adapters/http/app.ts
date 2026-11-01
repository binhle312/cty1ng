import type { Catalog } from "../../core/catalog/catalog.rules.ts";
import type { Health } from "../../core/health/health.service.ts";
import type { createSettingsService } from "../../core/settings/settings.service.ts";
import type { SkillImportService } from "../../core/skills/skill-import.service.ts";
import type { SkillsService } from "../../core/skills/skills.service.ts";
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
import { apiDocsRoutes } from "./routes/api-docs.ts";
import { catalogRoutes } from "./routes/catalog.ts";
import { healthRoutes } from "./routes/health.ts";
import { settingsRoutes } from "./routes/settings.ts";
import { SKILL_UPLOAD_PATHS, skillRoutes } from "./routes/skills.ts";
import { streamRoutes, type OpenStream } from "./routes/stream.ts";
import { testEventRoutes } from "./routes/test-events.ts";
import { frontendFiles } from "./static.ts";

export interface HttpDeps {
  log: Logger;
  allowedHosts: readonly string[];
  allowedOrigins: readonly string[];
  health: () => Promise<Health>;
  catalog: Catalog;
  settings: ReturnType<typeof createSettingsService>;
  skills: SkillsService;
  skillImport: SkillImportService;
  openStream: OpenStream;
  // Only when APP_ENV=test.
  testPing: ((note: string) => Promise<number>) | null;
  // The OpenAPI docs page, only when APP_ENV=dev.
  apiDocs: boolean;
  // The built frontend, only in a production build (NODE_ENV=production).
  frontendDir: string | null;
}

export const OPENAPI_INFO = { title: "cty1ng", version: "0.0.0" };

// The Hono app. Middleware order is the request path of the M0b plan §4.
export function createHttpApp(deps: HttpDeps) {
  const app = createRouter();

  app.use(requestId(deps.log));
  app.use(accessLog());
  app.use(hostCheck(deps.allowedHosts));
  app.use(originCheck(deps.allowedOrigins));
  app.use(securityHeaders());
  app.use(corsForAllowedOrigins(deps.allowedOrigins));
  // Upload routes set their own limit (security.md §2.4); every other route keeps 1 MB.
  app.use(maxBody(SKILL_UPLOAD_PATHS));
  app.onError(onError);
  app.notFound(notFound);

  const api = createRouter()
    .route("/", healthRoutes(deps.health))
    .route("/", settingsRoutes(deps.settings))
    .route("/", catalogRoutes(deps.catalog))
    .route("/", skillRoutes({ skills: deps.skills, skillImport: deps.skillImport }))
    .route("/", streamRoutes(deps.openStream));
  if (deps.testPing !== null) api.route("/", testEventRoutes(deps.testPing));
  if (deps.apiDocs) api.route("/", apiDocsRoutes());
  app.route("/api", api);

  app.doc31("/api/openapi.json", { openapi: "3.1.0", info: OPENAPI_INFO });
  if (deps.frontendDir !== null) app.use(frontendFiles(deps.frontendDir));
  return app;
}
