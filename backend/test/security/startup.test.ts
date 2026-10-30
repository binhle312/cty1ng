import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { tempDir } from "../helpers.ts";

// M0 AC2 and architecture.md §8: the real entry point refuses to start, with a clear message
// and a non-zero exit, before it opens the database or listens.
const MAIN = resolve(import.meta.dirname, "../../src/app/main.ts");

let dir: ReturnType<typeof tempDir>;
beforeEach(() => {
  dir = tempDir("startup");
});
afterEach(() => {
  dir.remove();
});

function start(env: NodeJS.ProcessEnv) {
  return spawnSync(process.execPath, [MAIN], {
    env: { PATH: process.env.PATH, DATA_DIR: dir.path, PORT: "8799", ...env },
    encoding: "utf8",
    timeout: 10_000,
  });
}

describe("startup checks", () => {
  it.each(["0.0.0.0", "192.168.1.10", "::", "example.com"])("refuses HOST=%s", (host) => {
    const run = start({ HOST: host });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain(`HOST=${host} is not a loopback address`);
  });

  it("refuses APP_ENV=test with NODE_ENV=production", () => {
    const run = start({ APP_ENV: "test", NODE_ENV: "production" });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("APP_ENV=test cannot run with NODE_ENV=production");
  });

  it("refuses an invalid value with the variable's name", () => {
    const run = start({ PORT: "eighty" });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("PORT");
  });
});
