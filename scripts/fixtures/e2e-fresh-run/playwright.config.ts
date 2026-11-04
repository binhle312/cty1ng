import { join } from "node:path";
import { defineConfig } from "@playwright/test";
import { serverReadyCheck } from "../../lib/e2e-server-ready.ts";

// A fresh local run on a free port, with the same ready check as frontend/playwright.config.ts.
const port = Number(process.env.FIXTURE_PORT);

export default defineConfig({
  testDir: import.meta.dirname,
  testMatch: "*.pw.ts",
  reporter: "line",
  outputDir: join(String(process.env.FIXTURE_OUTPUT), "results"),
  webServer: {
    command: "node server.ts",
    cwd: import.meta.dirname,
    ...serverReadyCheck({ port, ownLine: true }),
    reuseExistingServer: false,
    timeout: 20_000,
    env: { PORT: String(port) },
  },
});
