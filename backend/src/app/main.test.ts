import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { createServer, type Server } from "node:net";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { tempDir } from "../../test/helpers.ts";

// The real entry point with a port that another program uses. The port check comes when the
// server starts to listen: after the settings passed, the app loaded and the migrations ran.
// (The checks that refuse a start before the app loads are in test/security/startup.test.ts.)
const MAIN = resolve(import.meta.dirname, "main.ts");
// Much longer than the start needs (about a second alone); it only stops a hung child.
const CHILD_LIMIT_MS = 15_000;

let dir: ReturnType<typeof tempDir>;
let other: Server;
let port: number;
beforeEach(async () => {
  dir = tempDir("main");
  other = createServer();
  await new Promise<void>((done) => other.listen(0, "127.0.0.1", done));
  const address = other.address();
  if (address === null || typeof address === "string") throw new Error("no port");
  port = address.port;
});
afterEach(() => {
  other.close();
  dir.remove();
});

function start(env: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [MAIN], {
    env: { PATH: process.env.PATH, DATA_DIR: dir.path, PORT: String(port), ...env },
    encoding: "utf8",
    timeout: CHILD_LIMIT_MS,
  });
}

describe("a start on a port that another program uses", () => {
  it("prints one line on stderr and no stack trace", () => {
    const run = start();
    expect(run.error?.message ?? null, "the child could not run or hit the time limit").toBeNull();
    expect(run.stderr.trimEnd().split("\n"), run.stderr).toEqual([
      `cty1ng: cannot listen on 127.0.0.1:${String(port)}: another program uses the port`,
    ]);
  });

  // An open SQLite database in WAL mode leaves `app.db-wal` and `app.db-shm` beside its file.
  it("closes the database before it exits", () => {
    const run = start();
    expect(run.error?.message ?? null, "the child could not run or hit the time limit").toBeNull();
    expect(readdirSync(dir.path).filter((name) => name.startsWith("app.db"))).toEqual(["app.db"]);
  });
});

// A bad setting stops the start before the port check. A line break in it stays on one line:
// the start prints the control character in its escaped form (one-line.ts).
describe("a start with a line break in a setting", () => {
  it("prints one line, with the line break escaped", () => {
    const run = start({ HOST: "127.0.0.1\nevil" });
    expect(run.error?.message ?? null, "the child could not run or hit the time limit").toBeNull();
    expect(run.status).toBe(1);
    expect(run.stderr.trimEnd().split("\n"), run.stderr).toHaveLength(1);
    expect(run.stderr).toContain("cty1ng: HOST=127.0.0.1\\nevil is not a loopback address");
  });
});
