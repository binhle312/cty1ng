// Reads the git history for `pnpm check:status`: the first-parent line of a revision, which holds
// the merges into that branch. A shallow clone would hide merges, so it is a problem.
import { execFileSync } from "node:child_process";
import { type ChangedFile, PROMOTION_FOLDER } from "./check-status.ts";

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

// The text of a file at a revision, or undefined when the file is not in that revision.
function textAt(repo: string, spec: { rev: string; path: string }): string | undefined {
  const git = (...args: string[]): string =>
    execFileSync("git", args, { cwd: repo, encoding: "utf8" });
  if (git("ls-tree", "--name-only", "-z", spec.rev, "--", spec.path) === "") return undefined;
  return git("show", `${spec.rev}:${spec.path}`);
}

// The files of a merge, each with its text before and after the merge. Only a file in long-term
// memory needs its text: any other file makes the PR an ordinary PR.
export function mergeChanges(repo: string, sha: string): ChangedFile[] {
  return mergeFiles(repo, sha).map((path) => {
    if (!path.startsWith(PROMOTION_FOLDER)) return { path, texts: [] };
    const texts = [`${sha}^1`, sha].map((rev) => textAt(repo, { rev, path }));
    return { path, texts: texts.filter((text) => text !== undefined) };
  });
}
