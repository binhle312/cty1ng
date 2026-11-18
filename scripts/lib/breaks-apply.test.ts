import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyPatch, changesMissing } from "./breaks-apply.ts";

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.invalid", ...args], {
    cwd,
    maxBuffer: 2 ** 30,
  });

let root: string;
let repo: string;
let copy: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "breaks-apply-"));
  // The checkout: a committed state, then local changes of three kinds.
  repo = join(root, "repo");
  mkdirSync(join(repo, "app"), { recursive: true });
  writeFileSync(join(repo, "app/code.ts"), "export const a = 1;\n");
  writeFileSync(join(repo, "gone.ts"), "export const g = 1;\n");
  writeFileSync(join(repo, "run.sh"), "echo run\n");
  git(repo, "init", "-q");
  git(repo, "add", ".");
  git(repo, "commit", "-q", "-m", "start");
  writeFileSync(join(repo, "app/code.ts"), "export const a = 2;\n");
  rmSync(join(repo, "gone.ts"));
  chmodSync(join(repo, "run.sh"), 0o755);
  // The copy of HEAD, inside another git repository (a TMPDIR inside a checkout).
  const outer = join(root, "outer");
  mkdirSync(outer);
  git(outer, "init", "-q");
  copy = join(outer, "tmp", "check-breaks-copy");
  mkdirSync(copy, { recursive: true });
  execFileSync("tar", ["-x", "-C", copy], { input: git(repo, "archive", "HEAD") });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const executable = (path: string) => (statSync(path).mode & 0o111) !== 0;

describe("applyPatch", () => {
  it("puts a tracked edit into a copy that is inside another git repository", () => {
    applyPatch(copy, git(repo, "diff", "HEAD", "--binary"));

    expect(readFileSync(join(copy, "app/code.ts"), "utf8")).toBe("export const a = 2;\n");
    expect(existsSync(join(copy, "gone.ts"))).toBe(false);
    expect(executable(join(copy, "run.sh"))).toBe(true);
  });
});

describe("changesMissing", () => {
  const files = ["app/code.ts", "gone.ts", "run.sh"];
  // Makes each local change in the copy by hand, except the change of `skip`.
  const changeCopy = (skip?: string) => {
    if (skip !== "app/code.ts") writeFileSync(join(copy, "app/code.ts"), "export const a = 2;\n");
    if (skip !== "gone.ts") rmSync(join(copy, "gone.ts"));
    if (skip !== "run.sh") chmodSync(join(copy, "run.sh"), 0o755);
  };

  it("names a changed file whose copy has the old text", () => {
    changeCopy("app/code.ts");

    expect(changesMissing({ repo, copy, files })).toEqual(["app/code.ts"]);
  });

  it("names a deleted file that the copy still has", () => {
    changeCopy("gone.ts");

    expect(changesMissing({ repo, copy, files })).toEqual(["gone.ts"]);
  });

  it("names a file whose executable bit differs", () => {
    changeCopy("run.sh");

    expect(changesMissing({ repo, copy, files })).toEqual(["run.sh"]);
  });

  it("names a new file that the copy does not have", () => {
    changeCopy();
    writeFileSync(join(repo, "app/new.ts"), "export const n = 1;\n");

    expect(changesMissing({ repo, copy, files: [...files, "app/new.ts"] })).toEqual(["app/new.ts"]);
  });

  it("names nothing when the copy has every change", () => {
    changeCopy();

    expect(changesMissing({ repo, copy, files })).toEqual([]);
  });
});
