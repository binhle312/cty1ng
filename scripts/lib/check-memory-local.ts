// The machine part of `pnpm check:memory`: the git file lists of the memory, and for `--local` the
// files of this computer that git does not share. Not pure: it runs git, and it reads and writes
// the files that the caller names.
import { execFileSync } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync, writeSync } from "node:fs";
import { dirname } from "node:path";
import { EXCLUDE_LINES, MEMORY_DIR, SHORT_TERM } from "./check-memory.ts";

// Adds the short-term lines that `path` (a `.git/info/exclude` file) does not have yet, and
// returns the full text after the change. One file handle does the read and the write, so there
// is no gap between a check and a write ("a+" also creates a missing file). It is not a lock: two
// runs at the same time can append the block twice, which does no harm.
export function addExcludeLines(path: string): string {
  mkdirSync(dirname(path), { recursive: true });
  const fd = openSync(path, "a+");
  try {
    const text = readFileSync(fd, "utf8");
    const present = new Set(text.split("\n").map((line) => line.trim()));
    const missing = EXCLUDE_LINES.filter((line) => !present.has(line));
    if (missing.length === 0) return text;
    const start = text === "" || text.endsWith("\n") ? "" : "\n";
    const block = `${start}# The chief's short-term memory (${MEMORY_DIR}/README.md)\n${missing.join("\n")}\n`;
    writeSync(fd, block);
    return text + block;
  } finally {
    closeSync(fd);
  }
}

// The text of `path`, or undefined if the file does not exist. A read with no check first: the
// file can go away between a check and the read.
export function readIfExists(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
}

// `-z`: git writes each name as it is, ended by a NUL. Without it, git quotes a name with
// non-ASCII characters, and such a file escapes every check.
const gitPaths = (repo: string, args: string[]): string[] =>
  execFileSync("git", [...args.slice(0, 1), "-z", ...args.slice(1)], {
    cwd: repo,
    encoding: "utf8",
  })
    .split("\0")
    .filter((path) => path !== "");

// Each memory file that git tracks or would track: a new file counts before `git add`, and the
// ignored short-term files never count.
export function memoryPaths(repo: string): string[] {
  return gitPaths(repo, [
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "--",
    MEMORY_DIR,
  ]);
}

// The short-term files that git tracks: only the README may be one.
export function trackedPaths(repo: string): string[] {
  return gitPaths(repo, ["ls-files", "--", SHORT_TERM]);
}
