import { join, resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { e2eDataDir } from "../scripts/lib/e2e-data-dir.ts";
import { SERVE_MARKER_PATH, serveIsRunning } from "../scripts/lib/e2e-serve-marker.ts";
import { serverReadyCheck } from "../scripts/lib/e2e-server-ready.ts";

// End-to-end tests (testing.md §3). They run against the production build that the backend
// serves, so the real CSP applies (M0c plan, decision B). APP_ENV=test cannot run with
// NODE_ENV=production (architecture.md §8), so the app runs as APP_ENV=prod with the fake
// model; tests that need test-only routes are API tests in backend/test/. A second backend in
// APP_ENV=dev serves the OpenAPI docs page.
const REPO = resolve(import.meta.dirname, "..");
export const APP_PORT = 8100;
export const DEV_API_PORT = 8101;

// Fake mode never depends on the developer's keys (testing.md §2): every `*_API_KEY` leaves the
// environment before any server starts, so the real catalog entries are always unavailable,
// whatever the shell holds. Playwright and `pnpm e2e:serve` both give the servers
// `process.env` plus `env` below, so a key removed here reaches neither.
for (const key of Object.keys(process.env)) {
  if (key.endsWith("_API_KEY")) Reflect.deleteProperty(process.env, key);
}

// One fresh data folder per run, removed when the run ends. Workers load this file again; they
// reuse the folder of the main process through the environment.
const dataDir = e2eDataDir();

// Locally, `pnpm e2e:serve` keeps the servers running between runs; CI always starts fresh ones.
// Any other server on the ports is not ours, and the tests would write into it: a fresh local run
// waits for the "listening" lines of its own servers, and a server that cannot get its port stops
// the run (testing.md §3).
const inCi = process.env.CI !== undefined;
const reuse = !inCi && serveIsRunning(SERVE_MARKER_PATH);

const backend = (port: number, env: Record<string, string>) => ({
  command: "node src/app/main.ts",
  cwd: join(REPO, "backend"),
  ...serverReadyCheck({ port, ownLine: !inCi && !reuse }),
  reuseExistingServer: reuse,
  timeout: 60_000,
  env: {
    PORT: String(port),
    DATA_DIR: join(dataDir, String(port)),
    FAKE_MODEL: "1",
    LOG_LEVEL: inCi ? "warn" : "info",
    ...env,
  },
});

export default defineConfig({
  testDir: "test/e2e",
  fullyParallel: true,
  forbidOnly: process.env.CI !== undefined,
  retries: process.env.CI === undefined ? 0 : 1,
  reporter: process.env.CI === undefined ? "list" : [["list"], ["html", { open: "never" }]],
  // Laptop screens only (owner, 2026-10-30).
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    baseURL: `http://127.0.0.1:${String(APP_PORT)}`,
    trace: "retain-on-failure",
  },
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
  webServer: [
    {
      ...backend(APP_PORT, { NODE_ENV: "production", APP_ENV: "prod" }),
      // Build first, so the tests always see the current frontend.
      command: "pnpm --filter @cty1ng/frontend build && node src/app/main.ts",
    },
    backend(DEV_API_PORT, { APP_ENV: "dev" }),
  ],
});
