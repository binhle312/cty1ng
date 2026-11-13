import {
  chmodSync,
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  type Stats,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { makeCopy } from "./breaks-copy.ts";
import { type GitFolder, gitFolder, removeFolders, tempFolder } from "./breaks-git-folder.ts";

// The copy that the break runner tests (DQ-263). It must be the same as the checkout with each
// git setting: the runner reads the new text of each test file from it.
afterEach(removeFolders);

// The copy of a git folder. `git` takes the place of the git of the folder in a unit test.
function copyOf(folder: GitFolder, git: (args: string[]) => Buffer = folder.raw) {
  const copy = tempFolder();
  return { copy, ...makeCopy({ repo: folder.path, copy, git }) };
}

// A path below a file gives an error that is not "no entry": that path is absent too.
function statOf(path: string): Stats | null {
  try {
    return lstatSync(path);
  } catch {
    return null;
  }
}

// The type, the execute bit and the content of a path.
function entry(root: string, path: string): string {
  const stat = statOf(join(root, path));
  if (stat === null) return "absent";
  if (stat.isSymbolicLink()) return `link ${readlinkSync(join(root, path))}`;
  if (!stat.isFile()) return "no file";
  const type = (stat.mode & 0o100) === 0 ? "file" : "file with the execute bit";
  return `${type} ${readFileSync(join(root, path)).toString("base64")}`;
}

function filesUnder(root: string, under = ""): string[] {
  return readdirSync(join(root, under), { withFileTypes: true }).flatMap((item) => {
    const path = under === "" ? item.name : `${under}/${item.name}`;
    return item.isDirectory() ? filesUnder(root, path) : [path];
  });
}

// Each path where the copy is not the same as the checkout. The paths are each file that git
// tracks, each new file that git does not ignore, and each file of the copy.
function differences(folder: GitFolder, copy: string): string[] {
  const listed = folder
    .git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"])
    .split("\0")
    .filter((path) => path !== "");
  return [...new Set([...listed, ...filesUnder(copy)])]
    .sort()
    .filter((path) => entry(folder.path, path) !== entry(copy, path))
    .map((path) => `${path}: ${entry(folder.path, path)} / ${entry(copy, path)}`.slice(0, 120));
}

const rows = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, at) => `line ${String(from + at)}\n`).join("");

// A git folder with a committed file `a.test.ts` and other files.
function committed(more: Record<string, string | Buffer> = {}): GitFolder {
  const folder = gitFolder();
  folder.write("a.test.ts", "old\n");
  for (const [file, content] of Object.entries(more)) folder.write(file, content);
  folder.commit();
  return folder;
}

// A git folder with a local change of each type.
function withLocalChanges(): GitFolder {
  const folder = committed({
    ".gitattributes": "*.test.ts diff=more\nplain.test.ts -diff\n",
    "staged.test.ts": rows(1, 9),
    "a b.test.ts": rows(1, 9),
    "data.test.ts": Buffer.from([1, 0, 2, 10]),
    "plain.test.ts": rows(1, 9),
    "run.sh": "#!/bin/sh\n",
    "gone.test.ts": rows(1, 3),
    "old-name.test.ts": rows(1, 9),
    "same.test.ts": rows(1, 9),
  });
  folder.write("a.test.ts", "new\n");
  folder.write("staged.test.ts", rows(2, 9));
  folder.git(["add", "staged.test.ts"]);
  folder.write("a b.test.ts", `${rows(1, 4)}five\n${rows(6, 9)}`);
  folder.write("data.test.ts", Buffer.from([9, 0, 8, 10]));
  folder.write("plain.test.ts", `${rows(1, 9)}line 10\n`);
  chmodSync(join(folder.path, "run.sh"), 0o755);
  rmSync(join(folder.path, "gone.test.ts"));
  folder.git(["mv", "old-name.test.ts", "new-name.test.ts"]);
  folder.write("new-name.test.ts", `${rows(1, 1)}two\n${rows(3, 9)}`);
  folder.write("staged-new.test.ts", "n\n");
  folder.git(["add", "staged-new.test.ts"]);
  folder.write("new/deep/fresh.test.ts", "n\n");
  return folder;
}

describe("the copy is the same as the checkout", () => {
  it("with no local change", () => {
    const folder = committed({ "sub/b.ts": "b\n" });
    const made = copyOf(folder);
    expect(differences(folder, made.copy)).toEqual([]);
    expect(made).toMatchObject({ local: "none", newFiles: [] });
  });

  it("with a changed file that is not staged", () => {
    const folder = committed();
    folder.write("a.test.ts", "new\n");
    const { copy } = copyOf(folder);
    expect(differences(folder, copy)).toEqual([]);
    expect(readFileSync(join(copy, "a.test.ts"), "utf8")).toBe("new\n");
  });

  it("with a changed file that is staged", () => {
    const folder = committed();
    folder.write("a.test.ts", "new\n");
    folder.git(["add", "-A"]);
    const { copy } = copyOf(folder);
    expect(differences(folder, copy)).toEqual([]);
    expect(readFileSync(join(copy, "a.test.ts"), "utf8")).toBe("new\n");
  });

  it("with a deleted file", () => {
    const folder = committed({ "gone.test.ts": "g\n" });
    rmSync(join(folder.path, "gone.test.ts"));
    const { copy } = copyOf(folder);
    expect(differences(folder, copy)).toEqual([]);
    expect(existsSync(join(copy, "gone.test.ts"))).toBe(false);
  });

  it("with a file that only has a new mode", () => {
    const folder = committed({ "run.sh": "#!/bin/sh\n" });
    chmodSync(join(folder.path, "run.sh"), 0o755);
    const { copy } = copyOf(folder);
    expect(differences(folder, copy)).toEqual([]);
    expect(entry(copy, "run.sh")).toMatch(/^file with the execute bit /);
  });

  it("with a changed binary file", () => {
    const folder = committed({ "data.test.ts": Buffer.from([1, 0, 2, 10]) });
    folder.write("data.test.ts", Buffer.from([9, 0, 8, 10]));
    const { copy } = copyOf(folder);
    expect(differences(folder, copy)).toEqual([]);
    expect([...readFileSync(join(copy, "data.test.ts"))]).toEqual([9, 0, 8, 10]);
  });

  it("with a renamed file", () => {
    const folder = committed({ "old-name.test.ts": rows(1, 9) });
    folder.git(["mv", "old-name.test.ts", "new-name.test.ts"]);
    folder.write("new-name.test.ts", `${rows(1, 1)}two\n${rows(3, 9)}`);
    const { copy } = copyOf(folder);
    expect(differences(folder, copy)).toEqual([]);
    expect(filesUnder(copy).sort()).toEqual(["a.test.ts", "new-name.test.ts"]);
  });

  it("with a new file that git does not track, in a new folder", () => {
    const folder = committed();
    folder.write("new/deep/fresh.test.ts", "n\n");
    const made = copyOf(folder);
    expect(differences(folder, made.copy)).toEqual([]);
    expect(made.newFiles).toEqual(["new/deep/fresh.test.ts"]);
    expect(readFileSync(join(made.copy, "new/deep/fresh.test.ts"), "utf8")).toBe("n\n");
  });

  // DQ-300: with no `-z`, git quotes such a name, and the runner looked for the quoted text.
  it("with a new file that has a name that git quotes (né.test.ts), and lists it as a new file", () => {
    const folder = committed();
    folder.write("né.test.ts", "n\n");
    const made = copyOf(folder);
    expect(differences(folder, made.copy)).toEqual([]);
    expect(made.newFiles).toEqual(["né.test.ts"]);
  });

  it("with a file that becomes a link", () => {
    const folder = committed({ "target.ts": "t\n" });
    rmSync(join(folder.path, "a.test.ts"));
    symlinkSync("target.ts", join(folder.path, "a.test.ts"));
    const { copy } = copyOf(folder);
    expect(differences(folder, copy)).toEqual([]);
    expect(entry(copy, "a.test.ts")).toBe("link target.ts");
  });

  it("with a link that becomes a file", () => {
    const folder = gitFolder();
    folder.write("target.ts", "t\n");
    symlinkSync("target.ts", join(folder.path, "a.test.ts"));
    folder.commit();
    rmSync(join(folder.path, "a.test.ts"));
    folder.write("a.test.ts", "now a file\n");
    const { copy } = copyOf(folder);
    expect(differences(folder, copy)).toEqual([]);
    expect(entry(copy, "target.ts")).toMatch(/^file /);
    expect(readFileSync(join(copy, "a.test.ts"), "utf8")).toBe("now a file\n");
  });

  // The list of the copy is against HEAD. A list against the base of the PR does not name this
  // file, and the copy then keeps the text of HEAD.
  it("with a local change that gives a file the base text again", () => {
    const folder = committed();
    folder.write("a.test.ts", "second\n");
    folder.commit();
    folder.write("a.test.ts", "old\n");
    const { copy } = copyOf(folder);
    expect(differences(folder, copy)).toEqual([]);
    expect(readFileSync(join(copy, "a.test.ts"), "utf8")).toBe("old\n");
  });

  it.each(["staged", "not staged"])("with a file that becomes a folder (%s)", (state) => {
    const folder = committed();
    rmSync(join(folder.path, "a.test.ts"));
    folder.write("a.test.ts/in.test.ts", "in\n");
    if (state === "staged") folder.git(["add", "-A"]);
    const { copy } = copyOf(folder);
    expect(differences(folder, copy)).toEqual([]);
    expect(readFileSync(join(copy, "a.test.ts/in.test.ts"), "utf8")).toBe("in\n");
  });

  // git lists the new file before the deleted file of the folder.
  it.each(["staged", "not staged"])("with a folder that becomes a file (%s)", (state) => {
    const folder = committed({ "d.test.ts/in.test.ts": "in\n", "d.test.ts/deep/x.ts": "x\n" });
    rmSync(join(folder.path, "d.test.ts"), { recursive: true });
    folder.write("d.test.ts", "now a file\n");
    if (state === "staged") folder.git(["add", "-A"]);
    const { copy } = copyOf(folder);
    expect(differences(folder, copy)).toEqual([]);
    expect(readFileSync(join(copy, "d.test.ts"), "utf8")).toBe("now a file\n");
  });

  // git gives no status `U` for this state: it compares a commit with the files on disk.
  it("in a merge that is not complete", () => {
    const folder = committed({ "keep.ts": "k\n" });
    folder.git(["checkout", "--quiet", "-b", "side"]);
    folder.write("a.test.ts", "side\n");
    folder.commit();
    folder.git(["checkout", "--quiet", "-"]);
    folder.write("a.test.ts", "main\n");
    folder.commit();
    expect(folder.fails(["merge", "side"])).toBe(true);
    const { copy } = copyOf(folder);
    expect(differences(folder, copy)).toEqual([]);
    expect(readFileSync(join(copy, "a.test.ts"), "utf8")).toContain("<<<<<<<");
  });

  it("with a new folder that is a git repository of its own: it is not copied", () => {
    const folder = committed();
    folder.write("inner/i.test.ts", "i\n");
    folder.git(["init", "--quiet"], "inner");
    const made = copyOf(folder);
    expect(made.newFiles).toEqual([]);
    expect(existsSync(join(made.copy, "inner"))).toBe(false);
  });
});

describe("the stops of the copy", () => {
  // The `git` of the folder, but with `list` as the answer to the command of the file list.
  const withList =
    (folder: GitFolder, list: string) =>
    (args: string[]): Buffer =>
      args.includes("--name-status") ? Buffer.from(list) : folder.raw(args);

  it("stops at the status U, names the file, and makes no copy", () => {
    const folder = committed();
    const copy = tempFolder();
    const git = withList(folder, "M\0keep.ts\0U\0a.test.ts\0");
    expect(() => makeCopy({ repo: folder.path, copy, git })).toThrow(
      'cannot make the copy: a.test.ts: git gives the status "U", which the runner does not know. Report this as a defect of the runner',
    );
    expect(readdirSync(copy)).toEqual([]);
  });

  it("stops at a listed path that is no plain file and no link", () => {
    const folder = committed({ "sub/b.ts": "b\n" });
    expect(() => copyOf(folder, withList(folder, "M\0sub\0"))).toThrow(
      "cannot make the copy: sub is no plain file and no link",
    );
  });
});

describe("git settings and the copy", () => {
  // Owner, 2026-11-13 (D5): one test with an external diff tool holds the copy.
  it("has a local change when an external diff tool is set", () => {
    const folder = committed();
    // A local change that is not committed, and a tool that prints nothing.
    folder.write("a.test.ts", "new\n");
    folder.git(["config", "diff.external", "true"]);
    folder.env.GIT_EXTERNAL_DIFF = "true";
    const { copy } = copyOf(folder);
    expect(readFileSync(join(copy, "a.test.ts"), "utf8")).toBe("new\n");
  });

  const textFilter = "sh -c 'echo more; cat \"$0\"'";
  it.each<[string, { config?: [string, string][]; env?: [string, string]; clean?: boolean }]>([
    ["no setting", {}],
    ["diff.external=true", { config: [["diff.external", "true"]] }],
    ["diff.noprefix=true", { config: [["diff.noprefix", "true"]] }],
    ["color.diff=always", { config: [["color.diff", "always"]] }],
    ["color.ui=always", { config: [["color.ui", "always"]] }],
    ["diff.mnemonicPrefix=true", { config: [["diff.mnemonicPrefix", "true"]] }],
    ["core.quotePath=true", { config: [["core.quotePath", "true"]] }],
    ["diff.renames=copies", { config: [["diff.renames", "copies"]] }],
    ["diff.interHunkContext=5", { config: [["diff.interHunkContext", "5"]] }],
    ["a text filter", { config: [["diff.more.textconv", textFilter]] }],
    ["GIT_EXTERNAL_DIFF=true", { env: ["GIT_EXTERNAL_DIFF", "true"] }],
    ["GIT_DIFF_OPTS=--unified=3", { env: ["GIT_DIFF_OPTS", "--unified=3"] }],
    [
      "diff.external=true and no local change",
      { config: [["diff.external", "true"]], clean: true },
    ],
    [
      "diff.noprefix=true and no local change",
      { config: [["diff.noprefix", "true"]], clean: true },
    ],
    ["diff.context=0", { config: [["diff.context", "0"]] }],
    ["GIT_DIFF_OPTS=--unified=0", { env: ["GIT_DIFF_OPTS", "--unified=0"] }],
    ["diff.srcPrefix=one/two/", { config: [["diff.srcPrefix", "one/two/"]] }],
    ["diff.autoRefreshIndex=false", { config: [["diff.autoRefreshIndex", "false"]] }],
    ["diff.suppressBlankEmpty=true", { config: [["diff.suppressBlankEmpty", "true"]] }],
    ["diff.relative=true", { config: [["diff.relative", "true"]] }],
    [
      "diff.external=true and diff.noprefix=true",
      {
        config: [
          ["diff.external", "true"],
          ["diff.noprefix", "true"],
        ],
      },
    ],
    ["diff.orderFile", {}],
  ])("is the same as the checkout with %s", (name, setting) => {
    const folder = setting.clean === true ? committed({ "sub/b.ts": "b\n" }) : withLocalChanges();
    for (const [key, value] of setting.config ?? []) folder.git(["config", key, value]);
    if (setting.env !== undefined) folder.env[setting.env[0]] = setting.env[1];
    if (name === "diff.orderFile") {
      // Outside the folder, so that the file is no new file of the checkout.
      const order = join(tempFolder(), "order.txt");
      writeFileSync(order, "staged-new.test.ts\nnew-name.test.ts\na.test.ts\n");
      folder.git(["config", "diff.orderFile", order]);
    }
    expect(differences(folder, copyOf(folder).copy)).toEqual([]);
  });

  // With this setting, git lists the new file of the folder before the deleted file.
  it("is the same as the checkout with diff.orderFile when a file becomes a folder", () => {
    const folder = committed();
    rmSync(join(folder.path, "a.test.ts"));
    folder.write("a.test.ts/in.test.ts", "in\n");
    folder.git(["add", "-A"]);
    const order = join(tempFolder(), "order.txt");
    writeFileSync(order, "a.test.ts/*\n");
    folder.git(["config", "diff.orderFile", order]);
    const list = folder.git(["diff", "--name-status", "-z", "--no-renames", "HEAD"]);
    expect(list).toBe("A\0a.test.ts/in.test.ts\0D\0a.test.ts\0");
    expect(differences(folder, copyOf(folder).copy)).toEqual([]);
  });

  it("is the same as the checkout with line ends of Windows on disk (core.autocrlf=true)", () => {
    const folder = gitFolder();
    folder.git(["config", "core.autocrlf", "true"]);
    folder.write("changed.test.ts", "1\r\n2\r\n3\r\n");
    folder.write("same.test.ts", "1\r\n2\r\n3\r\n");
    folder.commit();
    folder.write("changed.test.ts", "1\r\ntwo\r\n3\r\n");
    const { copy } = copyOf(folder);
    expect(differences(folder, copy)).toEqual([]);
    expect(readFileSync(join(copy, "changed.test.ts"), "utf8")).toBe("1\r\ntwo\r\n3\r\n");
  });
});

describe("the hash of the local changes", () => {
  it("gives a new hash when the content of a file changes, and the same hash for the same state", () => {
    const folder = committed();
    folder.write("a.test.ts", "new\n");
    const first = copyOf(folder).local;
    expect(first).toMatch(/^sha256 [0-9a-f]{16} \(0 new files\)$/);
    expect(copyOf(folder).local).toBe(first);
    folder.write("a.test.ts", "newer\n");
    expect(copyOf(folder).local).not.toBe(first);
  });

  it("gives a new hash when only the execute bit changes", () => {
    const folder = committed();
    folder.write("a.test.ts", "new\n");
    const first = copyOf(folder).local;
    chmodSync(join(folder.path, "a.test.ts"), 0o755);
    expect(copyOf(folder).local).not.toBe(first);
  });

  it("gives the same hash with diff.orderFile", () => {
    const folder = withLocalChanges();
    const first = copyOf(folder).local;
    const order = join(tempFolder(), "order.txt");
    writeFileSync(order, "staged-new.test.ts\nnew-name.test.ts\na.test.ts\n");
    folder.git(["config", "diff.orderFile", order]);
    expect(copyOf(folder).local).toBe(first);
  });

  it("does not say none for a local change when an external diff tool is set", () => {
    const folder = committed();
    folder.write("a.test.ts", "new\n");
    folder.git(["config", "diff.external", "true"]);
    folder.env.GIT_EXTERNAL_DIFF = "true";
    expect(copyOf(folder).local).toMatch(/^sha256 [0-9a-f]{16} \(0 new files\)$/);
  });

  it("counts the new files in the line", () => {
    const folder = committed();
    folder.write("n1.test.ts", "1\n");
    folder.write("new/n2.test.ts", "2\n");
    expect(copyOf(folder).local).toMatch(/^sha256 [0-9a-f]{16} \(2 new files\)$/);
  });
});
