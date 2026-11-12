import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { tempDir } from "../helpers.ts";

// M0 AC2 and architecture.md §8: the real entry point refuses to start, with a clear message
// and a non-zero exit, before it opens the database or listens. It checks the settings before
// it loads the app, so a refused start stays small (~80 MB) and fast while the full test run
// keeps the machine busy.
const MAIN = resolve(import.meta.dirname, "../../src/app/main.ts");
const RECORDER = resolve(import.meta.dirname, "record-modules.ts");
const FAILER = resolve(import.meta.dirname, "fail-module.ts");
// Much longer than a refused start needs (under a second alone); it only stops a hung child.
const CHILD_LIMIT_MS = 15_000;

let dir: ReturnType<typeof tempDir>;
beforeEach(() => {
  dir = tempDir("startup");
});
afterEach(() => {
  dir.remove();
});

function start(env: NodeJS.ProcessEnv, nodeArgs: string[] = []) {
  return spawnSync(process.execPath, [...nodeArgs, MAIN], {
    env: { PATH: process.env.PATH, DATA_DIR: dir.path, PORT: "8799", ...env },
    encoding: "utf8",
    timeout: CHILD_LIMIT_MS,
  });
}

// A child killed by the limit has no exit code; say that, not "expected null to be 1".
function expectRefused(run: SpawnSyncReturns<string>, message: string) {
  expect(run.error?.message ?? null, "the child could not run or hit the time limit").toBeNull();
  expect(run.signal, "the child was killed").toBeNull();
  expect(run.stderr).toContain(message);
  expect(run.status).toBe(1);
}

describe("startup checks", () => {
  it.each(["0.0.0.0", "192.168.1.10", "::", "example.com"])("refuses HOST=%s", (host) => {
    expectRefused(start({ HOST: host }), `HOST=${host} is not a loopback address`);
  });

  it("refuses APP_ENV=test with NODE_ENV=production", () => {
    expectRefused(
      start({ APP_ENV: "test", NODE_ENV: "production" }),
      "APP_ENV=test cannot run with NODE_ENV=production",
    );
  });

  it("refuses an invalid value with the variable's name", () => {
    expectRefused(start({ PORT: "eighty" }), "PORT");
  });

  it("says the app could not load, with no stack, when a module fails to load", () => {
    const run = start({ FAIL_MODULE: "/src/app/compose.ts" }, ["--import", FAILER]);
    expectRefused(run, "cty1ng: the app could not load: simulated load failure");
    expect(run.stderr).toContain("Run pnpm install again");
    expect(run.stderr).not.toContain("    at ");
    expect(existsSync(join(dir.path, "app.db"))).toBe(false);
  });

  // The port check comes when the server starts to listen, after the app loaded. Without a
  // listener for that error, Node ends the process with a stack trace.
  it("refuses a port that another program uses, with one line and no stack", async () => {
    const other = createServer();
    await new Promise<void>((done) => other.listen(0, "127.0.0.1", done));
    const address = other.address();
    if (address === null || typeof address === "string") throw new Error("no port");
    try {
      const run = start({ PORT: String(address.port) });
      expectRefused(run, `cty1ng: cannot listen on 127.0.0.1:${String(address.port)}`);
      expect(run.stderr.trimEnd().split("\n"), run.stderr).toHaveLength(1);
    } finally {
      other.close();
    }
  });

  it("refuses before it loads the app, the database or the logger", () => {
    const record = join(dir.path, "modules.txt");
    const run = start({ HOST: "0.0.0.0", RECORD_MODULES: record }, ["--import", RECORDER]);
    expectRefused(run, "HOST=0.0.0.0 is not a loopback address");
    const loaded = readFileSync(record, "utf8").split("\n");
    // The recorder works: it saw the settings module.
    expect(loaded.some((url) => url.endsWith("/src/app/config.ts"))).toBe(true);
    for (const heavy of ["/src/app/compose.ts", "/src/adapters/log/pino-logger.ts"]) {
      expect(loaded.filter((url) => url.endsWith(heavy))).toEqual([]);
    }
    expect(existsSync(join(dir.path, "app.db"))).toBe(false);
  });
});
