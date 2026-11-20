// The file facts of merge:check from local git (option A): a temporary origin and clone, with the
// real git runner. All data is synthetic.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type GitRun, blobReader, readDiff } from "./merge-check-diff.ts";

let root = "";
let work = "";
let clone = "";
const ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "t",
  GIT_AUTHOR_EMAIL: "t@example.invalid",
  GIT_COMMITTER_NAME: "t",
  GIT_COMMITTER_EMAIL: "t@example.invalid",
  GIT_NO_REPLACE_OBJECTS: "1",
};
const gitIn = (dir: string, ...args: string[]): string =>
  execFileSync("git", args, { cwd: dir, env: ENV, encoding: "utf8" }).trim();
const w = (...args: string[]) => gitIn(work, ...args);
// The runner of the CLI: bytes out, in the clone.
const runner: GitRun = (args) => {
  const result = spawnSync("git", args, { cwd: clone, env: ENV });
  return { status: result.status ?? 1, stdout: result.stdout };
};
function commit(files: Record<string, string>, message: string): string {
  for (const [path, text] of Object.entries(files)) {
    execFileSync("mkdir", ["-p", join(work, path, "..")]);
    writeFileSync(join(work, path), text);
  }
  w("add", "-A");
  w("commit", "-q", "-m", message);
  return w("rev-parse", "HEAD");
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "merge-diff-"));
  work = join(root, "work");
  clone = join(root, "clone");
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", join(root, "origin.git")]);
  execFileSync("git", ["clone", "-q", join(root, "origin.git"), work], { env: ENV });
  commit(
    {
      "docs/a.md": "a\n",
      "docs/old.md": "old\n",
      "tool.sh": "echo\n",
      "backend/package.json": '{"name":"b","dependencies":{"x":"1"}}\n',
    },
    "base",
  );
  w("push", "-q", "origin", "HEAD:main");
  execFileSync("git", ["clone", "-q", join(root, "origin.git"), clone], { env: ENV });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const baseTip = (): string => w("rev-parse", "origin/main");
function pushPr(head: string): void {
  w("push", "-q", "-f", "origin", `${head}:refs/pull/1/head`);
}

describe("readDiff", () => {
  it("reads each status, mode and text, and a rename as a delete and an add", () => {
    const tip = baseTip();
    w("checkout", "-q", "-b", "pr");
    w("mv", "docs/old.md", "docs/new.md");
    execFileSync("chmod", ["+x", join(work, "tool.sh")]);
    const head = commit(
      { "docs/a.md": "a2\n", "backend/package.json": '{"name":"b","dependencies":{"x":"2"}}\n' },
      "pr",
    );
    pushPr(head);
    const calls: string[] = [];
    const result = readDiff({ head, baseTip: tip }, (args) => {
      calls.push(args.join(" "));
      return runner(args);
    });
    if (!result.ok) throw new Error(result.reason);
    const byPath = new Map(result.files.map((file) => [file.path, file]));
    expect([...byPath.keys()].sort(), "paths").toEqual([
      "backend/package.json",
      "docs/a.md",
      "docs/new.md",
      "docs/old.md",
      "tool.sh",
    ]);
    expect(byPath.get("docs/old.md")?.status, "rename old").toBe("D");
    expect(byPath.get("docs/new.md")?.status, "rename new").toBe("A");
    expect(byPath.get("tool.sh")?.newMode, "mode").toBe("100755");
    // Plan delta r2 §2: records only. The reader reads a text later, by its blob id.
    const manifest = byPath.get("backend/package.json");
    expect(manifest, "manifest").toMatchObject({ status: "M", liveChanged: false });
    expect(manifest?.baseText, "no text from readDiff").toBeUndefined();
    expect(
      calls.filter((call) => call.startsWith("cat-file")),
      "no blob read",
    ).toEqual([]);
    const read = blobReader(runner);
    const side = (blob: string | undefined) =>
      read({ path: "backend/package.json", side: "base", blob: blob ?? "", kind: "manifest" });
    expect(side(manifest?.oldBlob), "base text by id").toEqual({
      kind: "text",
      text: '{"name":"b","dependencies":{"x":"1"}}\n',
    });
    expect(side(manifest?.newBlob), "head text by id").toEqual({
      kind: "text",
      text: '{"name":"b","dependencies":{"x":"2"}}\n',
    });
  });

  it("marks a touched path that main changed after the split, and reads the merge-base text", () => {
    const split = baseTip();
    w("checkout", "-q", "-b", "pr");
    const head = commit(
      { "backend/package.json": '{"name":"b","dependencies":{"x":"3"}}\n', "docs/a.md": "pr\n" },
      "pr",
    );
    pushPr(head);
    w("checkout", "-q", "main");
    commit(
      { "backend/package.json": '{"name":"b","dependencies":{"x":"9"}}\n', "docs/other.md": "o\n" },
      "main moves",
    );
    w("push", "-q", "origin", "HEAD:main");
    const result = readDiff({ head, baseTip: baseTip() }, runner);
    if (!result.ok) throw new Error(result.reason);
    const manifest = result.files.find((file) => file.path === "backend/package.json");
    expect(manifest?.liveChanged, "changed on main").toBe(true);
    const merged = blobReader(runner)({
      path: "backend/package.json",
      side: "base",
      blob: manifest?.oldBlob ?? "",
      kind: "manifest",
    });
    expect(merged, "merge-base text").toEqual({
      kind: "text",
      text: '{"name":"b","dependencies":{"x":"1"}}\n',
    });
    expect(result.files.find((file) => file.path === "docs/a.md")?.liveChanged, "not on main").toBe(
      false,
    );
    expect(split, "split").not.toBe(baseTip());
  });

  it("reads the snapshot head, not the head that the PR ref has now", () => {
    const tip = baseTip();
    w("checkout", "-q", "-b", "pr");
    const x = commit({ "docs/x.md": "x\n" }, "x");
    const y = commit({ "docs/y.md": "y\n" }, "y");
    pushPr(y);
    const calls: string[] = [];
    const result = readDiff({ head: x, baseTip: tip }, (args) => {
      calls.push(args.join(" "));
      return runner(args);
    });
    if (!result.ok) throw new Error(result.reason);
    expect(
      result.files.map((file) => file.path),
      "paths of x",
    ).toEqual(["docs/x.md"]);
    expect(calls[0], "fetch by id").toBe(`fetch --quiet --no-tags origin ${x} ${tip}`);
  });

  it("cannot check two merge bases, an unknown commit, or a manifest text that is not UTF-8", () => {
    const tip = baseTip();
    // Two merge bases: a criss-cross history.
    w("checkout", "-q", "-b", "a");
    const a1 = commit({ "docs/a1.md": "1\n" }, "a1");
    w("checkout", "-q", "-b", "b", tip);
    const b1 = commit({ "docs/b1.md": "1\n" }, "b1");
    w("merge", "-q", "--no-edit", a1);
    const b2 = w("rev-parse", "HEAD");
    w("checkout", "-q", "a");
    w("merge", "-q", "--no-edit", b1);
    const a2 = w("rev-parse", "HEAD");
    w("push", "-q", "origin", `${a2}:refs/heads/main`, "-f");
    pushPr(b2);
    const criss = readDiff({ head: b2, baseTip: a2 }, runner);
    expect(criss.ok ? "ok" : criss.reason, "two merge bases").toContain("merge bases");
    const unknown = readDiff({ head: "e".repeat(40), baseTip: a2 }, runner);
    expect(unknown.ok, "unknown commit").toBe(false);
    w("checkout", "-q", "-b", "bytes", a2);
    // A file name with the byte 0xff: not UTF-8 (a Buffer path keeps the bytes).
    writeFileSync(
      Buffer.concat([Buffer.from(`${work}/`), Buffer.from([0x64, 0xff, 0x2e, 0x6d, 0x64])]),
      "x\n",
    );
    w("add", "-A");
    w("commit", "-q", "-m", "bad path");
    const badPath = w("rev-parse", "HEAD");
    pushPr(badPath);
    // A path with a byte outside 0x21-0x7E is kept, marked as unsupported (plan delta r1, G4).
    const path = readDiff({ head: badPath, baseTip: a2 }, runner);
    if (!path.ok) throw new Error(path.reason);
    expect(path.files[0]?.supported, "path not UTF-8 is unsupported").toBe(false);
    expect(path.files[0]?.path, "escaped path").toBe("d\\xff.md");
    w("checkout", "-q", "-b", "bytes2", a2);
    writeFileSync(join(work, "backend/package.json"), Buffer.from([0x7b, 0xff, 0x7d]));
    w("add", "-A");
    w("commit", "-q", "-m", "bad text");
    const badText = w("rev-parse", "HEAD");
    pushPr(badText);
    const records = readDiff({ head: badText, baseTip: a2 }, runner);
    if (!records.ok) throw new Error(records.reason);
    const bad = records.files.find((file) => file.path === "backend/package.json");
    const text = blobReader(runner)({
      path: "backend/package.json",
      side: "head",
      blob: bad?.newBlob ?? "",
      kind: "manifest",
    });
    expect(text.kind === "failed" ? text.reason : text.kind, "text not UTF-8").toContain(
      "not UTF-8",
    );
  });

  // Plan delta r1 §2.1: a path is supported only when each byte is 0x21-0x7E.
  it("marks a path with a BOM, a non-ASCII letter or a space as unsupported", () => {
    const tip = baseTip();
    w("checkout", "-q", "-b", "pr");
    const names = [
      Buffer.concat([
        Buffer.from([0xef, 0xbb, 0xbf]),
        Buffer.from(".agents/chief/memories/long-term/x.md"),
      ]),
      Buffer.from("docs/caf\u00e9.md"),
      Buffer.from("docs/a b.md"),
    ];
    execFileSync("mkdir", ["-p", join(work, ".agents/chief/memories/long-term")]);
    writeFileSync(join(work, ".agents/chief/memories/long-term/note.md"), "# Note\n");
    for (const name of names) {
      const full = Buffer.concat([Buffer.from(`${work}/`), name]);
      mkdirSync(full.subarray(0, full.lastIndexOf(0x2f)), { recursive: true });
      writeFileSync(full, "x\n");
    }
    w("add", "-A");
    w("commit", "-q", "-m", "paths");
    const head = w("rev-parse", "HEAD");
    pushPr(head);
    const result = readDiff({ head, baseTip: tip }, runner);
    if (!result.ok) throw new Error(result.reason);
    const byPath = new Map(result.files.map((file) => [file.path, file]));
    const bom = byPath.get("\\xef\\xbb\\xbf.agents/chief/memories/long-term/x.md");
    expect(bom?.supported, "bom path").toBe(false);
    expect(byPath.get("docs/caf\\xc3\\xa9.md")?.supported, "letter path").toBe(false);
    expect(byPath.get("docs/a\\x20b.md")?.supported, "space path").toBe(false);
    expect(byPath.get(".agents/chief/memories/long-term/note.md")?.supported, "ascii path").toBe(
      true,
    );
  });

  // Plan delta r2 §2 and §4: the reader reads one blob by its id. A memory blob that is not UTF-8
  // is unsupported and a memory BOM stays (plan delta r1); a manifest that is not UTF-8 is a failed
  // read, and a manifest BOM is removed, as at d748524 (DQ-1047).
  it("reads a blob by id with the decoder of its kind", () => {
    const blob = (bytes: Buffer): string =>
      execFileSync("git", ["hash-object", "-w", "--stdin"], {
        cwd: clone,
        input: bytes,
        encoding: "utf8",
      }).trim();
    const read = blobReader(runner);
    const of = (bytes: Buffer, kind: "memory" | "manifest") =>
      read({ path: "x", side: "head", blob: blob(bytes), kind });
    expect(of(Buffer.from([0x23, 0x20, 0xff, 0x0a]), "memory"), "memory not UTF-8").toEqual({
      kind: "unsupported",
    });
    expect(of(Buffer.from("\ufeff# Clean\n"), "memory"), "memory BOM kept").toEqual({
      kind: "text",
      text: "\ufeff# Clean\n",
    });
    expect(of(Buffer.from('\ufeff{"name":"b"}\n'), "manifest"), "manifest BOM removed").toEqual({
      kind: "text",
      text: '{"name":"b"}\n',
    });
    expect(of(Buffer.from([0x7b, 0xff, 0x7d]), "manifest").kind, "manifest not UTF-8").toBe(
      "failed",
    );
    expect(
      read({ path: "x", side: "base", blob: "e".repeat(40), kind: "memory" }).kind,
      "unknown blob",
    ).toBe("failed");
  });

  // DQ-1046: the live-path check compares the path bytes, not the escaped form.
  it("compares the paths that main changed by their bytes", () => {
    const tip = baseTip();
    w("checkout", "-q", "-b", "pr");
    const head = commit({ "docs/a\\x20b.md": "pr\n", "docs/a.md": "pr\n" }, "pr");
    pushPr(head);
    w("checkout", "-q", "main");
    commit({ "docs/a b.md": "main\n", "docs/A.md": "main\n" }, "main moves");
    w("push", "-q", "origin", "HEAD:main");
    const result = readDiff({ head, baseTip: baseTip() }, runner);
    if (!result.ok) throw new Error(result.reason);
    const byPath = new Map(result.files.map((file) => [file.path, file.liveChanged]));
    expect(byPath.get("docs/a\\x20b.md"), "a backslash path is not the space path").toBe(false);
    expect(byPath.get("docs/a.md"), "case differs").toBe(false);
    expect(tip, "tip").not.toBe(baseTip());
  });

  // Plan delta r1 §3: a local setting cannot hide a gitlink from the raw diff.
  it("keeps a gitlink when a setting asks git to ignore submodules", () => {
    const tip = baseTip();
    w("checkout", "-q", "-b", "pr");
    writeFileSync(join(work, ".gitmodules"), '[submodule "lib"]\n\tpath = lib\n\turl = ./lib\n');
    w("add", ".gitmodules");
    w("update-index", "--add", "--cacheinfo", `160000,${tip},lib`);
    w("commit", "-q", "-m", "gitlink");
    const head = w("rev-parse", "HEAD");
    pushPr(head);
    for (const setting of ["diff.ignoreSubmodules=all", "submodule.lib.ignore=all"]) {
      const result = readDiff({ head, baseTip: tip }, (args) => runner(["-c", setting, ...args]));
      if (!result.ok) throw new Error(result.reason);
      const link = result.files.find((file) => file.path === "lib");
      expect(link?.newMode, `gitlink with ${setting}`).toBe("160000");
    }
  });
});
