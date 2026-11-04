import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";

// Each `pnpm e2e` and `pnpm e2e:serve` gets a fresh data folder. A folder that this process made
// goes when the process ends, after the servers have stopped; a folder it was given stays
// (testing.md §3).

const REPO = resolve(import.meta.dirname, "..", "..");
const HELPER = join(REPO, "scripts/lib/e2e-data-dir.ts");
const PREFIX = "cty1ng-e2e-";

let folder = "";

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), "cty1ng-data-dir-"));
});

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
});

// Runs the helper in a process of its own, with this folder as the system temp folder.
function runChild(options: { given?: string; exitCode?: number }) {
  const script = `
    import { existsSync, writeFileSync } from "node:fs";
    import { join } from "node:path";
    import { e2eDataDir } from ${JSON.stringify(HELPER)};
    const first = e2eDataDir();
    if (!existsSync(first)) throw new Error("no folder while the process runs");
    if (e2eDataDir() !== first) throw new Error("a second call made another folder");
    if (process.env.E2E_DATA_DIR !== first) throw new Error("workers would not get the folder");
    writeFileSync(join(first, "database"), "data");
    console.log(first);
    process.exit(${String(options.exitCode ?? 0)});
  `;
  const env: NodeJS.ProcessEnv = { ...process.env, TMPDIR: folder };
  if (options.given === undefined) Reflect.deleteProperty(env, "E2E_DATA_DIR");
  else env.E2E_DATA_DIR = options.given;
  const run = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    encoding: "utf8",
    env,
  });
  return { code: run.status, path: run.stdout.trim(), error: run.stderr };
}

function freePort(): Promise<number> {
  return new Promise((done) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        done(typeof address === "object" && address !== null ? address.port : 0);
      });
    });
  });
}

function madeFolders(): string[] {
  return readdirSync(folder).filter((name) => name.startsWith(PREFIX));
}

it("removes a folder it made when the process ends", () => {
  const run = runChild({});
  expect(run.path.startsWith(join(folder, PREFIX))).toBe(true);
  expect(run.code).toBe(0);
  expect(madeFolders()).toEqual([]);
});

it("also removes it after a failed run, and keeps the run's exit code", () => {
  const run = runChild({ exitCode: 3 });
  expect(run.code).toBe(3);
  expect(madeFolders()).toEqual([]);
});

it("keeps a folder it was given: workers and other owners still use it", () => {
  const given = mkdtempSync(join(folder, "given-"));
  const run = runChild({ given });
  expect(run.path).toBe(given);
  expect(run.code).toBe(0);
  expect(existsSync(join(given, "database"))).toBe(true);
});

it(
  "a real Playwright run has the folder during the test and removes it",
  { timeout: 60_000 },
  async () => {
    const port = await freePort();
    const run = spawnSync(
      join(REPO, "node_modules/.bin/playwright"),
      ["test", "-c", join(REPO, "scripts/fixtures/e2e-fresh-run/playwright.config.ts")],
      {
        cwd: REPO,
        encoding: "utf8",
        env: {
          ...process.env,
          TMPDIR: folder,
          FIXTURE_OUTPUT: folder,
          FIXTURE_PORT: String(port),
          E2E_DATA_DIR: undefined,
        },
      },
    );
    expect(run.stdout).toContain("1 passed");
    expect(run.status).toBe(0);
    // The worker reused the main process's folder, and it existed during the test.
    const seen = readFileSync(join(folder, "data-dir-in-test"), "utf8");
    expect(seen.startsWith(join(folder, PREFIX))).toBe(true);
    expect(madeFolders()).toEqual([]);
  },
);
