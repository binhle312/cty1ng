// The file facts of `pnpm merge:check` (option A): local git at the two commit ids of the snapshot.
// Git objects do not change, so each fact belongs to those ids. One merge base, `--no-renames` (a
// rename is a delete and an add), the texts from the blob ids of the diff, and raw bytes with a
// fatal UTF-8 decode that keeps a BOM. The caller passes the git runner; it must run git with the
// environment of `gitEnvironment` and give stdout as bytes.
//
// Plan delta r1 (owner, 2026-11-20, order 133): a path is kept as bytes and is supported only when
// each byte is printable ASCII (0x21-0x7E); classify stops the chief for any other path. A memory
// text that is not UTF-8 is unsupported text (exit 1); any other text that is not UTF-8 means
// "cannot check" (exit 2).
import { type DiffStatus, type PrFile, inMemory, needsText } from "./merge-check.ts";

export type GitRun = (args: readonly string[]) => { status: number; stdout: Buffer };
export type DiffRead = { ok: true; files: PrFile[] } | { ok: false; reason: string };

const SHA = /^[0-9a-f]{40}$/;
const ZERO = "0".repeat(40);
const UTF8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const STATUSES: readonly DiffStatus[] = ["A", "M", "D", "T"];
const isStatus = (value: string): value is DiffStatus =>
  STATUSES.some((status) => status === value);

class Failed extends Error {}

function decode(bytes: Buffer, what: string): string {
  try {
    return UTF8.decode(bytes);
  } catch {
    throw new Failed(`${what} is not UTF-8`);
  }
}

// Each byte outside 0x21-0x7E as "\\xhh", so a path cannot change a line of the output.
function escaped(bytes: Buffer): string {
  return Array.from(bytes)
    .map((byte) =>
      byte >= 0x21 && byte <= 0x7e
        ? String.fromCharCode(byte)
        : `\\x${byte.toString(16).padStart(2, "0")}`,
    )
    .join("");
}
const isPrintable = (bytes: Buffer): boolean =>
  bytes.length > 0 && bytes.every((byte) => byte >= 0x21 && byte <= 0x7e);

type RawEntry = {
  path: string;
  supported: boolean;
  status: DiffStatus;
  oldMode: string;
  newMode: string;
  oldBlob: string;
  newBlob: string;
};

// `git diff --raw -z --no-abbrev`: ":<old mode> <new mode> <old blob> <new blob> <status>" NUL
// "<path>" NUL, for each path.
function parseRaw(bytes: Buffer): RawEntry[] {
  const parts: Buffer[] = [];
  let start = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    if (bytes[i] === 0) {
      parts.push(bytes.subarray(start, i));
      start = i + 1;
    }
  }
  if (start !== bytes.length) throw new Failed("git gave a diff that does not end in NUL");
  if (parts.length % 2 !== 0) throw new Failed("git gave a diff with a path missing");
  const entries: RawEntry[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const meta = decode(parts[i] ?? Buffer.alloc(0), "a diff line");
    const bytes = parts[i + 1] ?? Buffer.alloc(0);
    const path = escaped(bytes);
    const match = /^:(\d{6}) (\d{6}) ([0-9a-f]{40}) ([0-9a-f]{40}) ([A-Z])$/.exec(meta);
    if (match === null) throw new Failed(`git gave an unexpected diff line for ${path}`);
    const [, oldMode = "", newMode = "", oldBlob = "", newBlob = "", status = ""] = match;
    if (!isStatus(status)) throw new Failed(`git gave the status ${status} for ${path}`);
    entries.push({
      path,
      supported: isPrintable(bytes),
      status,
      oldMode,
      newMode,
      oldBlob,
      newBlob,
    });
  }
  return entries;
}

export function readDiff(input: { head: string; baseTip: string }, git: GitRun): DiffRead {
  const { head, baseTip } = input;
  const run = (args: string[], what: string): Buffer => {
    const result = git(args);
    if (result.status !== 0) throw new Failed(`git could not ${what}`);
    return result.stdout;
  };
  try {
    if (!SHA.test(head) || !SHA.test(baseTip)) throw new Failed("the snapshot has a bad commit id");
    // Fetch by exact id: the facts are for the commits of the snapshot, not for a moving ref.
    run(["fetch", "--quiet", "--no-tags", "origin", head, baseTip], "fetch the commits of the PR");
    const bases = decode(
      run(["merge-base", "--all", baseTip, head], "find the merge base"),
      "a merge base",
    )
      .split("\n")
      .filter((line) => line !== "");
    if (bases.length !== 1 || !SHA.test(bases[0] ?? "")) {
      throw new Failed(`the PR has ${String(bases.length)} merge bases, not one`);
    }
    const base = bases[0] ?? "";
    // A setting cannot hide a gitlink or limit the diff to a folder (plan delta r1 §3).
    const diff = [
      "diff",
      "--no-renames",
      "--no-ext-diff",
      "--no-textconv",
      "--ignore-submodules=none",
      "--no-relative",
      "--raw",
      "-z",
      "--no-abbrev",
    ];
    const entries = parseRaw(run([...diff, base, head], "read the diff of the PR"));
    const onMain = new Set(
      parseRaw(run([...diff, base, baseTip], "read the changes of main")).map(
        (entry) => entry.path,
      ),
    );
    // A blob that is not UTF-8 gives null for a memory file (unsupported text), else it fails.
    const text = (blob: string, path: string): string | null | undefined => {
      if (blob === ZERO) return undefined;
      const bytes = run(["cat-file", "blob", blob], `read ${path}`);
      if (!inMemory(path)) return decode(bytes, `the text of ${path}`);
      try {
        return UTF8.decode(bytes);
      } catch {
        return null;
      }
    };
    const files = entries.map((entry): PrFile => {
      const file: PrFile = {
        path: entry.path,
        supported: entry.supported,
        status: entry.status,
        oldMode: entry.oldMode,
        newMode: entry.newMode,
        liveChanged: onMain.has(entry.path),
      };
      if (!needsText(entry.path)) return file;
      const baseText = text(entry.oldBlob, entry.path);
      const headText = text(entry.newBlob, entry.path);
      const unsupported = baseText === null || headText === null;
      return {
        ...file,
        baseText: baseText ?? undefined,
        headText: headText ?? undefined,
        ...(unsupported ? { textUnsupported: true } : {}),
      };
    });
    return { ok: true, files };
  } catch (error) {
    if (error instanceof Failed) return { ok: false, reason: error.message };
    throw error;
  }
}
