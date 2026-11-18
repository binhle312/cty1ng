import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// `pnpm check:breaks:static` in a small git repository (testing.md §5): the CI job of a PR runs
// it on the list of the PR, against the base branch.
const script = resolve(import.meta.dirname, "check-breaks-static.ts");
const LIST = "scripts/breaks/pr-1.json";
const TEST_ADDS = 'it("adds", () => {\n  const x = add(1, 2);\n  expect(x).toBe(3);\n});\n';
let repo = "";

// A git that reads no config of this machine, with a synthetic author.
const env = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "test",
  GIT_AUTHOR_EMAIL: "test@example.invalid",
  GIT_COMMITTER_NAME: "test",
  GIT_COMMITTER_EMAIL: "test@example.invalid",
};
const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: repo, env, encoding: "utf8" }).trim();

function write(path: string, text: string): void {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), text);
}

function list(more: { assertion?: string; replace?: string; exempt?: unknown[] } = {}): string {
  return JSON.stringify({
    claims: [
      {
        id: "C1",
        claim: "add adds",
        test: { kind: "vitest", file: "app/a.test.ts", name: "adds" },
        assertion: more.assertion ?? "expect(x).toBe(3);",
        breaks: [
          {
            id: "C1-a",
            file: "app/a.ts",
            edits: [{ find: "a + b", replace: more.replace ?? "a - b" }],
          },
        ],
      },
    ],
    exempt: more.exempt ?? [],
  });
}

function check(...args: string[]) {
  return spawnSync(process.execPath, [script, ...args], { cwd: repo, env, encoding: "utf8" });
}

let base = "";
beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "check-breaks-static-"));
  git("init", "--quiet", "--initial-branch=main");
  write(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: { strict: true, noEmit: true, target: "ES2022", types: [] },
      include: ["app/a.ts"],
    }),
  );
  write("app/a.ts", "export const add = (a: number, b: number): number => a + b;\n");
  write("app/a.test.ts", "");
  git("add", ".");
  git("commit", "--quiet", "-m", "base");
  base = git("rev-parse", "HEAD");
  // The PR adds the test "adds".
  write("app/a.test.ts", TEST_ADDS);
});
afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe("check:breaks:static", () => {
  it("passes a PR with no list, and says that the list is missing", () => {
    const run = check(LIST, "--base", base);
    expect(run.stdout).toContain(`no break list ${LIST}`);
    expect(run.status).toBe(0);
  });

  it("passes a list whose claims link, cover the PR's tests and compile", () => {
    write(LIST, list());
    const run = check(LIST, "--base", base);
    expect(run.stdout).toContain("0 problems");
    expect(run.status).toBe(0);
  });

  it("fails a list whose assertion the test file has two times (DQ-517)", () => {
    write(
      "app/a.test.ts",
      `${TEST_ADDS}it("adds once more", () => {\n  const x = 3;\n  expect(x).toBe(3);\n});\n`,
    );
    write(LIST, list({ exempt: [{ file: "app/a.test.ts", name: "adds once more", reason: "x" }] }));
    const run = check(LIST, "--base", base);
    expect(run.stderr).toContain("C1: the assertion is found more than once");
    expect(run.status).toBe(1);
  });

  it("fails a list that has no claim for a new test file that git does not track yet", () => {
    write("app/b.test.ts", 'it("subtracts", () => {\n  expect(1 - 1).toBe(0);\n});\n');
    write(LIST, list());
    const run = check(LIST, "--base", base);
    expect(run.stderr).toContain('app/b.test.ts:1: the test "subtracts" has no claim');
    expect(run.status).toBe(1);
  });

  it("finds the tests of the PR from the base that `--base` names", () => {
    write("app/a.test.ts", `${TEST_ADDS}it("doubles", () => {\n  expect(2 * 2).toBe(4);\n});\n`);
    write(LIST, list());
    git("add", ".");
    git("commit", "--quiet", "-m", "the PR");
    expect(check(LIST, "--base", "HEAD").status).toBe(0);
    const run = check(LIST, "--base", base);
    expect(run.stderr).toContain('app/a.test.ts:5: the test "doubles" has no claim');
    expect(run.status).toBe(1);
  });

  it("fails a list with a break that does not compile", () => {
    write(LIST, list({ replace: "a.size" }));
    const run = check(LIST, "--base", base);
    expect(run.stderr).toMatch(/C1-a: the break does not compile: app\/a\.ts:1 TS2339 /);
    expect(run.status).toBe(1);
  });

  it("fails a list that is not valid JSON", () => {
    write(LIST, "{ claims: ");
    const run = check(LIST, "--base", base);
    expect(run.stderr).toContain(`${LIST}: not a valid break list`);
    expect(run.status).toBe(1);
  });
});
