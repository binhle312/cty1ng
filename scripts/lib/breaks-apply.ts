// The copy step of `pnpm check:breaks` (testing.md §5, step 1): put the local changes into the
// copy of HEAD, and check that the copy has them.
import { execFileSync } from "node:child_process";
import { closeSync, constants, fstatSync, openSync, readFileSync, readlinkSync } from "node:fs";
import { dirname, join } from "node:path";

// Applies `patch` (`git diff HEAD --binary`) to the copy. The copy has no `.git`, so git looks
// for a repository in the folders above it. If it finds one (a TMPDIR inside a checkout), it reads
// the paths of the patch from that repository's root and skips them with no error. The ceiling
// stops that search at the copy; GIT_DIR and GIT_WORK_TREE (set in a git hook) name a repository
// directly, so they go. Git splits the ceiling at each `:`, so a path with `:` has no ceiling;
// `changesMissing` stops that run.
export function applyPatch(copy: string, patch: Buffer): void {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_CEILING_DIRECTORIES: dirname(copy) };
  Reflect.deleteProperty(env, "GIT_DIR");
  Reflect.deleteProperty(env, "GIT_WORK_TREE");
  execFileSync("git", ["apply", "--whitespace=nowarn"], { cwd: copy, env, input: patch });
}

type State =
  | { kind: "absent" | "other" }
  | { kind: "link"; target: string }
  | { kind: "file"; executable: boolean; content: Buffer };

// What is at `path`. The file is opened one time and read through that open file, so a file that
// changes between the check and the read cannot give another file's content. `O_NOFOLLOW`: a link
// is an error, and its target is read with `readlinkSync`. `O_NONBLOCK`: the open of a pipe does
// not wait.
function state(path: string): State {
  let file: number;
  try {
    file = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") return { kind: "absent" };
    if (code === "ELOOP") return { kind: "link", target: readlinkSync(path) };
    throw error;
  }
  try {
    const stats = fstatSync(file);
    // A folder, a pipe or a device: not a file that a change can give.
    if (!stats.isFile()) return { kind: "other" };
    return { kind: "file", executable: (stats.mode & 0o111) !== 0, content: readFileSync(file) };
  } finally {
    closeSync(file);
  }
}

function same(a: State, b: State): boolean {
  if (a.kind === "link" && b.kind === "link") return a.target === b.target;
  if (a.kind === "file" && b.kind === "file")
    return a.executable === b.executable && a.content.equals(b.content);
  return a.kind === b.kind && a.kind !== "link" && a.kind !== "file";
}

// The files of `files` (paths from the root) that differ between the checkout `repo` and the copy.
export function changesMissing(options: { repo: string; copy: string; files: string[] }): string[] {
  const { repo, copy, files } = options;
  return files.filter((file) => !same(state(join(repo, file)), state(join(copy, file))));
}
