import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// The copy that `pnpm check:breaks` tests (testing.md §5, "Break lists", step 1): HEAD plus the
// local changes of the checkout `repo`, in the empty folder `copy`. `git` runs a git command in
// `repo` and gives its output. `local` is the text of the report line "Local changes";
// `newFiles` are the new files that git does not ignore.
export function makeCopy(at: { repo: string; copy: string; git: (args: string[]) => Buffer }): {
  local: string;
  newFiles: string[];
} {
  const patch = at.git(["diff", "HEAD", "--binary"]);
  // Only plain files: a link, such as a linked node_modules, is not part of the change.
  const newFiles = at
    .git(["ls-files", "--others", "--exclude-standard"])
    .toString("utf8")
    .split("\n")
    .filter((file) => file !== "" && lstatSync(join(at.repo, file)).isFile());
  const hash = createHash("sha256").update(patch);
  for (const file of newFiles) hash.update(file).update(readFileSync(join(at.repo, file)));
  const local =
    patch.length === 0 && newFiles.length === 0
      ? "none"
      : `sha256 ${hash.digest("hex").slice(0, 16)} (${String(newFiles.length)} new files)`;
  execFileSync("tar", ["-x", "-C", at.copy], { input: at.git(["archive", "HEAD"]) });
  if (patch.length > 0) {
    execFileSync("git", ["apply", "--whitespace=nowarn"], { cwd: at.copy, input: patch });
  }
  for (const file of newFiles) {
    mkdirSync(join(at.copy, dirname(file)), { recursive: true });
    writeFileSync(join(at.copy, file), readFileSync(join(at.repo, file)));
  }
  return { local, newFiles };
}
