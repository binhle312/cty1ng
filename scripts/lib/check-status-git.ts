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
