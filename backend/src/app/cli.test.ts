import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tempDir } from "../../test/helpers.ts";

// The `skills` and `bots` commands end a failure that the owner can correct with one line and
// no stack trace, as `db migrate` does: a path that is not there, or a bad setting. The command
// runs in its own process, so the test reads what the terminal gets.
const BACKEND = resolve(import.meta.dirname, "../..");
// Much longer than a command needs; it only stops a child that hangs.
const CHILD_LIMIT_MS = 30_000;

let dir: ReturnType<typeof tempDir>;
beforeEach(() => {
  dir = tempDir("cli");
});
afterEach(() => {
  dir.remove();
});

function cli(args: string[], env: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, ["src/app/cli.ts", ...args], {
    cwd: BACKEND,
    env: { PATH: process.env.PATH, DATA_DIR: join(dir.path, "data"), ...env },
    encoding: "utf8",
    timeout: CHILD_LIMIT_MS,
  });
}

describe("a failure of a CLI command that the owner can correct", () => {
  it.each([
    {
      name: "skills import, a folder that is not there",
      args: ["skills", "import"],
      path: "no-such-folder",
    },
    {
      name: "bots seed, a file that is not there",
      args: ["bots", "seed"],
      path: "no-such-file.yaml",
    },
    { name: "skills trash, a bad setting", args: ["skills", "trash"], env: { PORT: "not-a-port" } },
    { name: "bots trash, a bad setting", args: ["bots", "trash"], env: { PORT: "not-a-port" } },
  ])("$name: prints one line and no stack trace", ({ args, path, env }) => {
    const run = cli(path === undefined ? args : [...args, join(dir.path, path)], env);
    expect(run.error?.message ?? null, "the child could not run or hit the time limit").toBeNull();
    expect(run.status).toBe(1);
    expect(run.stderr.trimEnd().split("\n"), run.stderr).toHaveLength(1);
    expect(run.stderr).toContain(path ?? "PORT");
    expect(run.stdout).toBe("");
  });
});

// A setting or a path can hold a line break. The line still is one line: each control
// character is printed in its escaped form (one-line.ts). The same holds for `db migrate` and
// `ids decode`, which print their own failure line.
const UUID = "0190c8a0-0000-7000-8000-000000000000";
describe("a line break in a failure line of a CLI command", () => {
  it.each([
    {
      name: "skills import, a path",
      args: ["skills", "import"],
      path: "no\nfolder",
      part: "no\\nfolder'",
    },
    {
      name: "bots trash, HOST",
      args: ["bots", "trash"],
      env: { HOST: "127.0.0.1\nevil" },
      part: "HOST=127.0.0.1\\nevil is not a loopback address",
    },
    {
      name: "skills trash, ALLOWED_ORIGINS",
      args: ["skills", "trash"],
      env: { ALLOWED_ORIGINS: "http://a\nb" },
      part: "ALLOWED_ORIGINS: http://a\\nb is not an origin",
    },
    {
      name: "db migrate, HOST",
      args: ["db", "migrate"],
      env: { HOST: "127.0.0.1\nevil" },
      part: "Migration failed: HOST=127.0.0.1\\nevil is not a loopback address",
    },
    {
      name: "ids decode, a prefix",
      args: ["ids", "decode", UUID, "bo\nt"],
      part: 'Invalid prefix "bo\\nt"',
    },
  ])("$name: prints one line, with the line break escaped", ({ args, path, env, part }) => {
    const run = cli(path === undefined ? args : [...args, join(dir.path, path)], env);
    expect(run.error?.message ?? null, "the child could not run or hit the time limit").toBeNull();
    expect(run.status).toBe(1);
    expect(run.stderr.trimEnd().split("\n"), run.stderr).toHaveLength(1);
    expect(run.stderr).toContain(part);
  });
});

// A failure of another kind keeps its stack trace, because it can be a defect: the command lets
// it go up, and Node prints the trace. A seed file with wrong content is such a failure today.
describe("a failure of a CLI command of another kind", () => {
  it("keeps its stack trace", () => {
    const file = join(dir.path, "bots.yaml");
    writeFileSync(file, "bots: 1\n");
    const run = cli(["bots", "seed", file]);
    expect(run.error?.message ?? null, "the child could not run or hit the time limit").toBeNull();
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("\n    at ");
  });
});

// A failed run that also leaves the foreign keys off throws the read-back error, with the first
// error as its cause (migrate.ts). The real case needs a ROLLBACK that throws, so this test runs
// the command in this process with a database module that throws such a chain (DQ-315).
describe("db migrate, a failure with a cause", () => {
  const argv = process.argv;
  afterEach(() => {
    process.argv = argv;
    process.exitCode = undefined;
    vi.restoreAllMocks();
    vi.doUnmock("./database.ts");
    vi.resetModules();
  });

  it("prints the first error too, on one line", async () => {
    const first = new Error("The migrations leave 1 broken foreign key reference");
    vi.doMock("./database.ts", () => ({
      openDatabase: () => {
        throw new Error("foreign_keys is 0 after the migrations, not 1", { cause: first });
      },
    }));
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    process.argv = [argv[0] ?? "node", "cli.ts", "db", "migrate"];
    await import("./cli.ts");
    expect(process.exitCode).toBe(1);
    expect(stderr.mock.calls.map(([text]) => String(text))).toEqual([
      "Migration failed: foreign_keys is 0 after the migrations, not 1; cause: The migrations leave 1 broken foreign key reference\n",
    ]);
  });
});
