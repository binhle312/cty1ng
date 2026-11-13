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

function start() {
  return spawnSync(process.execPath, [MAIN], {
    env: { PATH: process.env.PATH, DATA_DIR: dir.path, PORT: String(port) },
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
