import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

// A helper for the tests of the break runner: a temporary git folder with its own environment.
// No `GIT_DIR` or `GIT_INDEX_FILE` of a git hook that runs the tests, and no git settings of the
// user or the machine. With them, a git command of a test could write into another repository
// (DQ-256).

const made: string[] = [];

// An empty temporary folder. `removeFolders` removes it.
export function tempFolder(): string {
  const folder = realpathSync(mkdtempSync(join(tmpdir(), "breaks-test-")));
  made.push(folder);
  return folder;
}

// Removes each folder that `tempFolder` and `gitFolder` made. A test file calls it after each test.
export function removeFolders(): void {
  for (const folder of made.splice(0)) rmSync(folder, { recursive: true, force: true });
}

export interface GitFolder {
  path: string;
  // The environment of each git command of this folder. A test can add a variable to it.
  env: NodeJS.ProcessEnv;
  // Runs a git command in the folder, or in the subfolder `cwd`, and gives its output.
  raw: (args: string[], cwd?: string) => Buffer;
  git: (args: string[], cwd?: string) => string;
  // Whether the git command exits with an error, such as a merge with a conflict.
  fails: (args: string[]) => boolean;
  write: (file: string, content: string | Buffer) => void;
  // The text of a file, or null. It follows a link, as the reader of the runner does.
  read: (file: string) => string | null;
  // Stages each change and commits it.
  commit: () => void;
  // The new files that git does not track and does not ignore.
  newFiles: () => string[];
}

export function gitFolder(): GitFolder {
  const path = tempFolder();
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH ?? "",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
  };
  const raw = (args: string[], cwd = ".") =>
    execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], {
      cwd: join(path, cwd),
      env,
      maxBuffer: 2 ** 28,
      stdio: ["ignore", "pipe", "pipe"],
    });
  const git = (args: string[], cwd = ".") => raw(args, cwd).toString("utf8");
  git(["init", "--quiet"]);
  git(["config", "commit.gpgsign", "false"]);
  return {
    path,
    env,
    raw,
    git,
    fails: (args) => {
      try {
        raw(args);
        return false;
      } catch {
        return true;
      }
    },
    write: (file, content) => {
      mkdirSync(dirname(join(path, file)), { recursive: true });
      writeFileSync(join(path, file), content);
    },
    read: (file) => {
      try {
        return readFileSync(join(path, file), "utf8");
      } catch {
        return null;
      }
    },
    commit: () => {
      git(["add", "-A"]);
      git(["commit", "--quiet", "--allow-empty", "-m", "a commit"]);
    },
    newFiles: () =>
      git(["ls-files", "-z", "--others", "--exclude-standard"])
        .split("\0")
        .filter((file) => file !== ""),
  };
}
