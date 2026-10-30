import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import type { HttpEnv } from "../context.ts";

// The OpenAPI docs page, only when APP_ENV=dev (security.md §2.10). Swagger UI is served from
// the swagger-ui-dist package, and the page loads it with no inline script or style, so the
// CSP of security.md §2.1 stays as it is.
const swaggerDir = dirname(createRequire(import.meta.url).resolve("swagger-ui-dist/package.json"));

const PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>cty1ng API</title>
    <link rel="stylesheet" href="/api/docs/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/api/docs/swagger-ui-bundle.js"></script>
    <script src="/api/docs/init.js"></script>
  </body>
</html>
`;

const INIT = `window.ui = SwaggerUIBundle({ url: "/api/openapi.json", dom_id: "#swagger-ui" });\n`;

export function apiDocsRoutes() {
  return new Hono<HttpEnv>()
    .get("/docs", (c) => c.html(PAGE))
    .get("/docs/init.js", (c) =>
      c.body(INIT, 200, { "Content-Type": "text/javascript; charset=utf-8" }),
    )
    .get("/docs/swagger-ui.css", serveStatic({ path: join(swaggerDir, "swagger-ui.css") }))
    .get(
      "/docs/swagger-ui-bundle.js",
      serveStatic({ path: join(swaggerDir, "swagger-ui-bundle.js") }),
    );
}
