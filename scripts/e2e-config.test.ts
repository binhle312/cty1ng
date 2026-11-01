import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";

// The end-to-end servers never see the developer's keys (testing.md §2).

const dataDir = mkdtempSync(join(tmpdir(), "cty1ng-e2e-config-"));
const savedDataDir = process.env.E2E_DATA_DIR;
afterEach(() => {
  delete process.env.SHELL_TEST_API_KEY;
  if (savedDataDir === undefined) delete process.env.E2E_DATA_DIR;
  rmSync(dataDir, { recursive: true, force: true });
});

it("the e2e servers start with no *_API_KEY, whatever the shell holds", async () => {
  process.env.SHELL_TEST_API_KEY = "sk-from-the-shell";
  // The config makes a data folder when none is given; give it a temporary one.
  process.env.E2E_DATA_DIR ??= dataDir;
  const { default: config } = await import("../frontend/playwright.config.ts");
  // What Playwright and `pnpm e2e:serve` give each server: process.env, then the server's env.
  for (const server of [config.webServer ?? []].flat()) {
    const env = { ...process.env, ...server.env };
    expect(Object.keys(env).filter((key) => key.endsWith("_API_KEY"))).toEqual([]);
  }
});
