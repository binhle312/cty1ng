import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { removeServeMarker, serveIsRunning, writeServeMarker } from "./lib/e2e-serve-marker.ts";

// `pnpm e2e` writes test data into whatever server it reuses, so it reuses only the servers of a
// `pnpm e2e:serve` of this checkout that is still running (testing.md §3).

let folder = "";
let path = "";
const saved = {
  CI: process.env.CI,
  E2E_DATA_DIR: process.env.E2E_DATA_DIR,
  E2E_SERVE_MARKER: process.env.E2E_SERVE_MARKER,
};

function restore(name: keyof typeof saved) {
  const value = saved[name];
  if (value === undefined) Reflect.deleteProperty(process.env, name);
  else process.env[name] = value;
}

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), "cty1ng-serve-marker-"));
  path = join(folder, "marker");
});

afterEach(() => {
  restore("CI");
  restore("E2E_DATA_DIR");
  restore("E2E_SERVE_MARKER");
  vi.resetModules();
  rmSync(folder, { recursive: true, force: true });
});

// A process id that was real and has ended.
function endedPid(): number {
  return spawnSync(process.execPath, ["-e", ""]).pid;
}

it("finds no serve when there is no marker", () => {
  expect(serveIsRunning(path)).toBe(false);
});

it("finds the serve of a marker while its process runs", () => {
  writeServeMarker({ path, pid: process.pid });
  expect(serveIsRunning(path)).toBe(true);
});

it("finds no serve when the process of the marker ended", () => {
  writeServeMarker({ path, pid: endedPid() });
  expect(serveIsRunning(path)).toBe(false);
});

it.each(["", "not a number", "-1", "0", "1.5", `${String(process.pid)} extra`])(
  "finds no serve in a marker that holds %j",
  (text) => {
    writeFileSync(path, text);
    expect(serveIsRunning(path)).toBe(false);
  },
);

it("finds no serve after the marker is removed, and removing it twice is fine", () => {
  writeServeMarker({ path, pid: process.pid });
  removeServeMarker(path);
  removeServeMarker(path);
  expect(serveIsRunning(path)).toBe(false);
});

async function reuseFlags(): Promise<boolean[]> {
  vi.resetModules();
  process.env.E2E_DATA_DIR = folder;
  process.env.E2E_SERVE_MARKER = path;
  const { default: config } = await import("../frontend/playwright.config.ts");
  return [config.webServer ?? []].flat().map((server) => server.reuseExistingServer === true);
}

it("reuses no server when no serve runs: anything on the ports is not ours", async () => {
  Reflect.deleteProperty(process.env, "CI");
  expect(await reuseFlags()).toEqual([false, false]);
});

it("reuses no server when the serve that wrote the marker ended", async () => {
  Reflect.deleteProperty(process.env, "CI");
  writeServeMarker({ path, pid: endedPid() });
  expect(await reuseFlags()).toEqual([false, false]);
});

it("reuses the servers while the serve of this checkout runs", async () => {
  Reflect.deleteProperty(process.env, "CI");
  writeServeMarker({ path, pid: process.pid });
  expect(await reuseFlags()).toEqual([true, true]);
});

it("reuses no server in CI, also with a marker", async () => {
  process.env.CI = "1";
  writeServeMarker({ path, pid: process.pid });
  expect(await reuseFlags()).toEqual([false, false]);
});
