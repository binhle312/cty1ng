// The machine part of `pnpm check:memory --local`: the files of this computer that git does not
// share. Not pure: it reads and writes the files that the caller names.
import { closeSync, mkdirSync, openSync, readFileSync, writeSync } from "node:fs";
import { dirname } from "node:path";
import { EXCLUDE_LINES, MEMORY_DIR } from "./check-memory.ts";

// Adds the short-term lines that `path` (a `.git/info/exclude` file) does not have yet, and
// returns the full text after the change. One file handle does the read and the write, so no
// other process can change the file between the two ("a+" also creates a missing file).
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
