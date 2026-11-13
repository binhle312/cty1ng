import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileList, fileListArgs } from "./breaks.ts";

// The copy that `pnpm check:breaks` tests (testing.md §5, "Break lists", step 1): HEAD plus the
// local changes of the checkout `repo`, in the empty folder `copy`. `git` runs a git command in
// `repo` and gives its output. `local` is the text of the report line "Local changes";
// `newFiles` are the new files that git does not ignore.
//
// The copy reads no patch text: that text is for people, and git settings change it (DQ-263).
// git lists each tracked file that is not as in HEAD, and the copy takes each one from the disk.
// The list is against HEAD, not against the base of the PR: a local change that gives a file the
// text of the base again is not in a list against the base.
export function makeCopy(at: { repo: string; copy: string; git: (args: string[]) => Buffer }): {
  local: string;
  newFiles: string[];
} {
  const listed = fileList(at.git(fileListArgs("HEAD")).toString("utf8"));
  const unknown = listed.filter(({ status }) => !["A", "M", "T", "D"].includes(status));
  if (unknown.length > 0) {
    const rows = unknown.map(
      ({ status, path }) =>
        `cannot make the copy: ${path}: git gives the status "${status}", which the runner does not know. Report this as a defect of the runner`,
    );
    throw new Error(rows.join("\n"));
  }
  // `-z`: git prints each name as it is, with no quotes (DQ-300). Only plain files: a link, such
  // as a linked node_modules, is not part of the change.
  const newFiles = at
    .git(["ls-files", "-z", "--others", "--exclude-standard"])
    .toString("utf8")
    .split("\0")
    .filter((file) => file !== "" && lstatSync(join(at.repo, file)).isFile());

  execFileSync("tar", ["-x", "-C", at.copy], { input: at.git(["archive", "HEAD"]) });
  // First each deleted file goes, then the other files come. So the result does not depend on
  // the order of the list: git can list the new file `a` before the deleted file `a/b`.
  for (const { status, path } of listed) {
    if (status === "D") rmSync(join(at.copy, path), { force: true });
  }
  const changes = [...listed, ...newFiles.map((path) => ({ status: "?", path }))];
  // A fixed order, so that one state has one hash: `diff.orderFile` changes the order of the list.
  changes.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const hash = createHash("sha256");
  // Each part with its length, so that two states cannot give the same bytes.
  const put = (part: string | Buffer) => {
    const bytes = Buffer.from(part);
    hash.update(`${String(bytes.length)}:`).update(bytes);
  };
  for (const { status, path } of changes) {
    put(status);
    put(path);
    if (status === "D") continue;
    const taken = take({ ...at, path });
    put(taken.type);
    put(taken.content);
  }
  const local =
    changes.length === 0
      ? "none"
      : `sha256 ${hash.digest("hex").slice(0, 16)} (${String(newFiles.length)} new files)`;
  return { local, newFiles };
}

// Puts one file or link of the checkout into the copy, and gives what it put there.
function take(at: { repo: string; copy: string; path: string }): {
  type: "file" | "file with the execute bit" | "link";
  content: string | Buffer;
} {
  const from = join(at.repo, at.path);
  const to = join(at.copy, at.path);
  const stat = lstatSync(from);
  if (!stat.isSymbolicLink() && !stat.isFile()) {
    throw new Error(`cannot make the copy: ${at.path} is no plain file and no link`);
  }
  mkdirSync(dirname(to), { recursive: true });
  // The old file goes. A folder can be in its place: then the checkout has deleted each file of
  // that folder, and the folder goes too.
  rmSync(to, { recursive: true, force: true });
  if (stat.isSymbolicLink()) {
    const target = readlinkSync(from);
    symlinkSync(target, to);
    return { type: "link", content: target };
  }
  const content = readFileSync(from);
  const executable = (stat.mode & 0o100) !== 0;
  // The mode of a new file, less the umask of the process, as `tar` gives it to the other files.
  writeFileSync(to, content, { mode: executable ? 0o777 : 0o666 });
  return { type: executable ? "file with the execute bit" : "file", content };
}
