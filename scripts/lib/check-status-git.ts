// Reads the git history for `pnpm check:status`: the first-parent line of a revision, which holds
// the merges into that branch. A shallow clone would hide merges, so it is a problem.
import { execFileSync } from "node:child_process";

export function readHistory(repo: string, rev: string): { log: string; problems: string[] } {
  const git = (...args: string[]): string =>
    execFileSync("git", args, { cwd: repo, encoding: "utf8" });
  if (git("rev-parse", "--is-shallow-repository").trim() !== "false") {
    return {
      log: "",
      problems: [
        "the clone is shallow, so merges can be missing: fetch the whole history (fetch-depth: 0)",
      ],
    };
  }
  return { log: git("log", "--first-parent", "--format=%H%x09%cI%x09%s", rev, "--"), problems: [] };
}

// The files that a merge commit changes against its first parent: what the PR changed. A move
// gives both of its paths (`--no-renames`), and `-z` keeps each name as it is: git quotes a name
// with non-ASCII characters otherwise.
export function mergeFiles(repo: string, sha: string): string[] {
  const args = ["diff", "--name-only", "--no-renames", "-z", `${sha}^1`, sha, "--"];
  const out = execFileSync("git", args, { cwd: repo, encoding: "utf8" });
  return out.split("\0").filter((path) => path !== "");
}
