import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../../src/app/config.ts";
import { tempDir } from "../helpers.ts";

// security.md §2.6: no output of an owner command holds the value of a `*_API_KEY` variable
// (audit 2026-11-05, P3 "Security"). Each command runs in its own process, as the owner runs
// it, so the test reads what the terminal gets: stdout and stderr, also when a command fails.

// Built at run time (testing.md §3, "Fake secrets").
const SENTINEL = ["sk", "test", "SENTINEL", "cli", "7c1e09ab53d2"].join("-");
const BACKEND = resolve(import.meta.dirname, "../..");
const SEED_BOTS = resolve(BACKEND, "../seed/bots.yaml");
const SEED_SKILLS = resolve(BACKEND, "../seed/skills");

const dirs: ReturnType<typeof tempDir>[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) dir.remove();
});

describe("API keys in the output of the CLI", () => {
  it(
    "never appear, for a command that ends well and for one that fails",
    { timeout: 120_000 },
    () => {
      const dir = tempDir("cli-secrets");
      dirs.push(dir);
      const env = {
        PATH: process.env.PATH ?? "",
        DATA_DIR: join(dir.path, "data"),
        FAKE_MODEL: "1",
        OPENAI_API_KEY: SENTINEL,
        ANTHROPIC_API_KEY: `${SENTINEL}-2`,
      };
      // The environment gives the commands a secret: without this, the scan proves nothing.
      expect(loadConfig(env).secrets).toContain(SENTINEL);

      const skills = join(dir.path, "skills");
      mkdirSync(join(skills, "notes"), { recursive: true });
      writeFileSync(
        join(skills, "notes", "SKILL.md"),
        "---\nname: notes\ndescription: Use it.\n---\n\n## Steps\n\n1. Do it.",
      );

      const outputs: { command: string; status: number | null; text: string }[] = [];
      const run = (args: string[], more: NodeJS.ProcessEnv = {}) => {
        const result = spawnSync(process.execPath, ["src/app/cli.ts", ...args], {
          cwd: BACKEND,
          env: { ...env, ...more },
          encoding: "utf8",
        });
        outputs.push({
          command: args.join(" "),
          status: result.status,
          text: `${result.stdout}${result.stderr}`,
        });
      };
      run(["db", "migrate"]);
      run(["skills", "import", skills, "--apply"]);
      run(["skills", "export", join(dir.path, "out")]);
      run(["skills", "trash"]);
      run(["skills", "restore", "no-such-skill"]);
      // The example bots need the seed skills.
      run(["skills", "import", SEED_SKILLS, "--apply"]);
      run(["bots", "seed", SEED_BOTS]);
      run(["bots", "trash"]);
      run(["bots", "restore", "no-such-bot"]);
      run(["ids", "decode", "not-an-id"]);
      run(["no-such-command"]);
      // Two failures before a command starts its work: a folder that is not there, and a bad
      // setting.
      run(["skills", "import", join(dir.path, "no-such-folder")]);
      run(["bots", "trash"], { PORT: "not-a-port" });

      // Each command got to its end or to its failure: a command that did not start scans nothing.
      expect(
        outputs.map(({ command, status }) => [command.split(" ").slice(0, 2).join(" "), status]),
      ).toEqual([
        ["db migrate", 0],
        ["skills import", 0],
        ["skills export", 0],
        ["skills trash", 0],
        ["skills restore", 1],
        ["skills import", 0],
        ["bots seed", 0],
        ["bots trash", 0],
        ["bots restore", 1],
        ["ids decode", 1],
        ["no-such-command", 2],
        ["skills import", 1],
        ["bots trash", 1],
      ]);
      for (const { text } of outputs) expect(text.length).toBeGreaterThan(0);
      for (const { command, text } of outputs) expect(text, command).not.toContain("SENTINEL");
    },
  );
});
