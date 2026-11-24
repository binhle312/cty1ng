// Read the two committed snapshots for the PR records check. The checkout is not an input.
import { constants } from "node:buffer";
import { execFileSync } from "node:child_process";
import { ISSUE_FILES, type LedgerFile } from "./lib/records-counts.ts";
import { removedWords } from "./lib/records-removed-words.ts";

function git(args: string[], message: string): string {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      maxBuffer: constants.MAX_STRING_LENGTH,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error(message);
  }
}

function commitOf(ref: string): string {
  return git(
    ["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`],
    `cannot resolve commit ${ref}`,
  ).trim();
}

function readSnapshot(commit: string): LedgerFile[] {
  return ISSUE_FILES.map((path) => {
    const object = `${commit}:${path}`;
    return { path, text: git(["cat-file", "blob", object], `cannot read ${object}`) };
  });
}

const refs = process.argv.slice(2);
const [base, head] = refs;
if (refs.length !== 2 || !base || !head) {
  console.error("usage: pnpm records:removed-words <base> <head>");
  process.exitCode = 2;
} else {
  try {
    const baseCommit = commitOf(base);
    const headCommit = commitOf(head);
    const report = removedWords({ base: readSnapshot(baseCommit), head: readSnapshot(headCommit) });
    if (report.length > 0) process.stdout.write(`${report.join("\n")}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`records:removed-words: ${message}`);
    process.exitCode = 1;
  }
}
