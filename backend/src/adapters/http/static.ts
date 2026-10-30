import { join } from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import type { MiddlewareHandler } from "hono";
import type { HttpEnv } from "./context.ts";

// The built frontend in a production build (architecture.md §1.2, M0c plan decision B). A file
// in `dist/` is served as it is; any other page path gets `index.html`, so a reload of
// `/bots/new` works. API paths never get the page: an unknown `/api/…` stays a JSON 404.
// serveStatic refuses `..`, `%` and backslashes in the path, so nothing outside `dist/` is
// served.
const API = /^\/api(?:\/|$)/;
// A path whose last part has a dot asks for a file. A missing file is a 404, not the page.
const FILE = /\/[^/]*\.[^/]*$/;

export function frontendFiles(distDir: string): MiddlewareHandler<HttpEnv> {
  const files = serveStatic<HttpEnv>({
    root: distDir,
    onFound: (path, c) => {
      // Vite puts a content hash in every file name under assets/, so those never change.
      const hashed = path.startsWith(join(distDir, "assets"));
      c.header("Cache-Control", hashed ? "public, max-age=31536000, immutable" : "no-cache");
    },
  });
  const page = serveStatic<HttpEnv>({
    path: join(distDir, "index.html"),
    onFound: (_path, c) => {
      c.header("Cache-Control", "no-cache");
    },
  });
  return async (c, next) => {
    if (API.test(c.req.path)) {
      await next();
      return;
    }
    // serveStatic returns its Response when it finds the file, and calls the given `next`
    // when it does not.
    const file = await files(c, () => Promise.resolve());
    if (file instanceof Response) return file;
    if (FILE.test(c.req.path)) {
      await next();
      return;
    }
    return page(c, next);
  };
}
