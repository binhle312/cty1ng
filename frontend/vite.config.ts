import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// The frontend dev server and build (architecture.md §1.2). In development Vite forwards
// `/api/*` to the backend, so the app uses the same relative URLs as the production build, which
// the backend serves itself (M0c plan, decisions A and B). `changeOrigin` sends the backend's
// own Host, which its Host check needs; the browser's Origin header is kept, and
// ALLOWED_ORIGINS lists it.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, resolve(import.meta.dirname, ".."), "PORT");
  const backend = `http://127.0.0.1:${env.PORT ?? "8000"}`;
  return {
    plugins: [react(), tailwindcss()],
    // Never 0.0.0.0 (AGENTS.md §8).
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": {
          target: backend,
          changeOrigin: true,
          // The proxy keeps the browser's side open when the backend's side closes before the
          // end of a response. The event stream would then look open with no events for ever,
          // so cut it: the browser sees the error and the app opens a new stream
          // (realtime-events.md §3, "Stream life"). A response that completed stays as it is.
          configure: (proxy) => {
            proxy.on("proxyRes", (...[proxyRes, , response]) => {
              proxyRes.on("close", () => {
                if (!proxyRes.complete) response.destroy();
              });
            });
          },
        },
      },
    },
    preview: { host: "127.0.0.1", port: 4173, strictPort: true },
    // The first-load budget is `pnpm check:bundle` (gzipped, frontend-conventions.md §4); Vite's
    // own warning counts raw bytes, so it is set above that budget.
    build: { manifest: true, target: "es2023", chunkSizeWarningLimit: 800 },
  };
});
