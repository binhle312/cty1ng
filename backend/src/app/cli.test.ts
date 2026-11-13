import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
