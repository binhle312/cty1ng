// The copy step of `pnpm check:breaks` (testing.md §5, step 1): put the local changes into the
// copy of HEAD, and check that the copy has them.
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readlinkSync } from "node:fs";
import { dirname, join } from "node:path";

// Applies `patch` (`git diff HEAD --binary`) to the copy. The copy has no `.git`, so git looks
// for a repository in the folders above it. If it finds one (a TMPDIR inside a checkout), it reads
// the paths of the patch from that repository's root and skips them with no error. The ceiling
// stops that search at the copy; GIT_DIR and GIT_WORK_TREE (set in a git hook) name a repository
// directly, so they go.
export function applyPatch(copy: string, patch: Buffer): void {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_CEILING_DIRECTORIES: dirname(copy) };
  Reflect.deleteProperty(env, "GIT_DIR");
  Reflect.deleteProperty(env, "GIT_WORK_TREE");
  execFileSync("git", ["apply", "--whitespace=nowarn"], { cwd: copy, env, input: patch });
}

// What a file is, for the comparison: absent, a link and its target, or a file with its bytes and
// its executable bit.
function state(path: string): string {
  let stats;
  try {
    stats = lstatSync(path);
  } catch {
    return "absent";
  }
  if (stats.isSymbolicLink()) return `link ${readlinkSync(path)}`;
  const executable = (stats.mode & 0o111) !== 0;
  return `file ${String(executable)} ${readFileSync(path).toString("base64")}`;
}

// The files of `files` (paths from the root) that differ between the checkout `repo` and the copy.
export function changesMissing(options: { repo: string; copy: string; files: string[] }): string[] {
  const { repo, copy, files } = options;
  return files.filter((file) => state(join(repo, file)) !== state(join(copy, file)));
}
