// `pnpm merge:check <PR number>`: may the chief merge this PR? Exit 0 prints the one merge line;
// exit 1 means no chief merge; exit 2 means it cannot check. Run it from a clean checkout of
// origin/main: it judges with the base code only, so a PR cannot judge itself with its own list
// (R-002; owner, 2026-11-19, order 108). The base check finds a local change by mistake; it cannot
// prove that the code that runs it is the base code, because that code runs first.
//
// Option A (owner, 2026-11-20, orders 128 and 130): the trusted local files, then one GitHub
// snapshot, the base check against that snapshot's base tip, the git diff at the snapshot's
// commit ids, and a second snapshot that must be the same in each field. Plan delta r1 (order
// 133): the start check runs before snapshot 1, and the policy files are compared with the
// snapshot's base tip by blob id and executable bit. Plan delta r2 (order 147): the record step
// decides first; the CLI reads the texts that it names, then takes snapshot 2, and gives a result
// only when the two snapshots are the same.
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { SETTINGS_FILE, SHORT_TERM, readSettings } from "./lib/check-memory.ts";
import { readIfExists, readOwnerRecord } from "./lib/check-memory-local.ts";
import {
  type MergeInput,
  type MergeResult,
  type Texts,
  cannotCheck,
  decideContent,
  decideRecords,
  readTexts,
} from "./lib/merge-check.ts";
import { type GitRun, blobReader, readDiff } from "./lib/merge-check-diff.ts";
import { type Run, readSnapshot, sameSnapshot } from "./lib/merge-check-snapshot.ts";
import {
  type LocalEntry,
  type PolicyFs,
  type StartFacts,
  type TreeEntry,
  gitEnvironment,
  originRepo,
  originUrl,
  policyProblems,
  startProblems,
  walkPolicy,
} from "./lib/merge-check-start.ts";
import { OWNER_RECORD } from "./lib/owner-quotes.ts";

// The code and the values that the judgment reads: each must be the same as at the base tip.
const BASE_PATHS = ["scripts", "package.json", ".agents/chief/scripts", SETTINGS_FILE];
const LIST_FILE = ".agents/chief/scripts/lib/merge-list.ts";
const UTF8 = new TextDecoder("utf-8", { fatal: true });

// Git runs with no inherited GIT_ variable and no replace objects, and gives its output as bytes.
const gitBytes: GitRun = (args) => {
  const result = spawnSync("git", args, {
    env: gitEnvironment(process.env),
    maxBuffer: 256 * 1024 * 1024,
  });
  return { status: result.status ?? 1, stdout: result.stdout };
};
const git = (...args: string[]): { status: number; stdout: string } => {
  const result = gitBytes(args);
  try {
    return { status: result.status, stdout: UTF8.decode(result.stdout) };
  } catch {
    return { status: 1, stdout: "" };
  }
};
const gh: Run = (args) => {
  const result = spawnSync("gh", args, { maxBuffer: 64 * 1024 * 1024 });
  return { status: result.status ?? 1, stdout: result.stdout };
};

// The values of a `-z` output: each value ends with a NUL, and an empty value counts.
function splitNul(bytes: Buffer): Buffer[] {
  const values: Buffer[] = [];
  let start = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    if (bytes[i] === 0) {
      values.push(bytes.subarray(start, i));
      start = i + 1;
    }
  }
  if (start !== bytes.length) values.push(bytes.subarray(start));
  return values;
}

// The facts of the start check, read from git before snapshot 1. A failed read is undefined.
function startFacts(): StartFacts {
  const read = (...args: string[]): string | undefined => {
    const result = git(...args);
    return result.status === 0 ? result.stdout : undefined;
  };
  const grafts = read("rev-parse", "--git-path", "info/grafts")?.trim();
  // Each configured value as bytes, as written (a URL rewrite of git does not change what it
  // names); the text helper would remove a leading BOM (grill 2).
  const origin = gitBytes(["config", "--get-all", "-z", "remote.origin.url"]);
  // Git exits 1 with no output when the key has no value: that is zero URLs (A3, order 152).
  const none = origin.status === 1 && origin.stdout.length === 0;
  return {
    origin: origin.status === 0 ? splitNul(origin.stdout) : none ? [] : undefined,
    shallow: read("rev-parse", "--is-shallow-repository"),
    grafts: grafts === undefined || grafts === "" ? undefined : existsSync(resolve(grafts)),
    config: read("config", "--list", "-z", "--includes"),
  };
}

// The file system of the policy walk.
const POLICY_FS: PolicyFs = {
  lstat: (path) => {
    const stat = lstatSync(path, { throwIfNoEntry: false });
    if (stat === undefined) return undefined;
    const kind = stat.isDirectory() ? "dir" : stat.isFile() ? "file" : "other";
    return { kind, executable: (stat.mode & 0o100) !== 0 };
  },
  readdir: (path) => readdirSync(path, { encoding: "buffer" }),
};

// The base check against the snapshot's base tip: a reason to stop, or undefined.
function baseProblem(baseTip: string): string | undefined {
  if (git("fetch", "--quiet", "--no-tags", "origin", baseTip).status !== 0) {
    return "git could not fetch the base tip of the PR";
  }
  if (git("cat-file", "-e", `${baseTip}:${LIST_FILE}`).status !== 0) {
    return "the base tip has no list file. Run merge:check from a checkout of main";
  }
  const listing = git("ls-tree", "-r", "-z", "--full-tree", baseTip, "--", ...BASE_PATHS);
  if (listing.status !== 0) return "git could not list the policy files of the base tip";
  const tree: TreeEntry[] = [];
  for (const line of listing.stdout.split("\0")) {
    if (line === "") continue;
    const match = /^(\d{6}) \w+ ([0-9a-f]{40})\t([\s\S]+)$/.exec(line);
    if (match === null) return "git gave an unexpected list of the policy files";
    if (!/^[\x21-\x7e]+$/.test(match[3] ?? "")) {
      return "a policy path of the base tip is not printable ASCII";
    }
    tree.push({ mode: match[1] ?? "", blob: match[2] ?? "", path: match[3] ?? "" });
  }
  const walked = walkPolicy(BASE_PATHS, POLICY_FS);
  if (!walked.ok) return walked.reason;
  const files = walked.files;
  const plain = files.filter((file) => file.plain);
  const hashed =
    plain.length === 0
      ? { status: 0, stdout: "" }
      : git("hash-object", "--no-filters", "--", ...plain.map((file) => file.path));
  const blobs = hashed.stdout.split("\n").filter((line) => line !== "");
  if (hashed.status !== 0 || blobs.length !== plain.length) {
    return "git could not hash the policy files here";
  }
  const byPath = new Map(plain.map((file, i) => [file.path, blobs[i] ?? ""]));
  const local: LocalEntry[] = files.map((file) => ({
    path: file.path,
    executable: file.executable,
    blob: byPath.get(file.path) ?? "not a file",
  }));
  const problems = policyProblems({ tree, local });
  if (problems.length > 0) {
    return `the merge-check code here differs from the base tip of the PR (${problems.slice(0, 3).join("; ")}). Run merge:check from a clean checkout of origin/main`;
  }
  return undefined;
}

function main(arg: string | undefined): MergeResult {
  if (arg === undefined || !/^[1-9]\d*$/.test(arg)) {
    return cannotCheck({ pr: arg ?? "", reason: "the argument is not a PR number", memory: false });
  }
  const number = Number(arg);
  const stop = (reason: string, memory = false): MergeResult =>
    cannotCheck({ pr: number, reason, memory });
  // The start check, before snapshot 1: a failed fact gives no gh call (plan delta r1 §3).
  const facts = startFacts();
  const start = startProblems(facts);
  if (start.length > 0) return stop(start.join("; "));
  const repo = originRepo(originUrl(facts.origin) ?? "");
  if (repo === undefined) return stop("the origin remote is not a GitHub repository");
  // The trusted local inputs, read one time before the snapshot.
  let record: readonly string[] | undefined;
  let words: string | undefined;
  try {
    record = readOwnerRecord(OWNER_RECORD);
    words = readIfExists(`${SHORT_TERM}/private-words.txt`);
  } catch {
    return stop("the owner record or the private word list cannot be read", true);
  }
  const first = readSnapshot({ repo, number }, gh);
  if (!first.ok) return stop(first.reason);
  const snapshot = first.snapshot;
  const problem = baseProblem(snapshot.baseTip);
  if (problem !== undefined) return stop(problem);
  const settings = git("show", `${snapshot.baseTip}:${SETTINGS_FILE}`);
  const minWords = readSettings(settings.status === 0 ? settings.stdout : undefined).limits.get(
    "quote_min_words",
  );
  if (minWords === undefined) return stop("no setting quote_min_words at the base tip");
  const diff = readDiff({ head: snapshot.head, baseTip: snapshot.baseTip }, gitBytes);
  if (!diff.ok) return stop(diff.reason);
  const input: MergeInput = {
    repo: snapshot.repo,
    number,
    state: snapshot.state,
    head: snapshot.head,
    files: diff.files,
    checks: snapshot.checks,
    record,
    privateWords: words?.split("\n").filter((line) => line.trim() !== ""),
    minQuoteWords: minWords,
    baseRef: snapshot.baseName,
    crossRepository: snapshot.fork,
    author: snapshot.author,
    expectedAuthor: snapshot.repoOwner,
  };
  // Plan delta r2 §2: the record step reads nothing; the texts that it names are read here, before
  // snapshot 2, and a result waits for the compare.
  const step = decideRecords(input);
  let texts: Texts = new Map();
  if ("reads" in step) {
    const read = readTexts(step.reads, blobReader(gitBytes));
    if (!read.ok) return stop(read.reason, step.memory);
    texts = read.texts;
  }
  // A1 (order 152): the record step knows the PR kind, so a memory PR gets "Do not merge it".
  const second = readSnapshot({ repo, number }, gh);
  if (!second.ok) return stop(second.reason, step.memory);
  if (!sameSnapshot(snapshot, second.snapshot)) {
    return stop("the PR changed during the check (head, base, state or checks)", step.memory);
  }
  return "done" in step ? step.done : decideContent(input, texts);
}

const result = main(process.argv[2]);
for (const line of result.lines) console.log(line);
process.exitCode = result.exit;
