import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// End-to-end tests (testing.md §3). They run against the production build that the backend
// serves, so the real CSP applies (M0c plan, decision B). APP_ENV=test cannot run with
// NODE_ENV=production (architecture.md §8), so the app runs as APP_ENV=prod with the fake
// model; tests that need test-only routes are API tests in backend/test/. A second backend in
// APP_ENV=dev serves the OpenAPI docs page.
const REPO = resolve(import.meta.dirname, "..");
export const APP_PORT = 8100;
export const DEV_API_PORT = 8101;

// One fresh data folder per run. Workers load this file again; they reuse the folder of the
// main process through the environment.
process.env.E2E_DATA_DIR ??= mkdtempSync(join(tmpdir(), "cty1ng-e2e-"));
const dataDir = process.env.E2E_DATA_DIR;

const backend = (port: number, env: Record<string, string>) => ({
  command: "node src/app/main.ts",
  cwd: join(REPO, "backend"),
  url: `http://127.0.0.1:${String(port)}/api/health`,
  // Locally, `pnpm e2e:serve` keeps the servers running between runs; CI always starts fresh ones.
  reuseExistingServer: process.env.CI === undefined,
  timeout: 60_000,
  env: {
    PORT: String(port),
    DATA_DIR: join(dataDir, String(port)),
    FAKE_MODEL: "1",
    LOG_LEVEL: "warn",
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
