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
// snapshot's base tip by blob id and executable bit.
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { SETTINGS_FILE, SHORT_TERM, readSettings } from "./lib/check-memory.ts";
import { readIfExists, readOwnerRecord } from "./lib/check-memory-local.ts";
import { type MergeResult, cannotCheck, classify } from "./lib/merge-check.ts";
import { type GitRun, readDiff } from "./lib/merge-check-diff.ts";
import { type Run, readSnapshot, sameSnapshot } from "./lib/merge-check-snapshot.ts";
import {
  type LocalEntry,
  type StartFacts,
  type TreeEntry,
  gitEnvironment,
  originRepo,
  policyProblems,
  startProblems,
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
  const result = spawnSync("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { status: result.status ?? 1, stdout: result.stdout };
};

// The facts of the start check, read from git before snapshot 1. A failed read is undefined.
function startFacts(): StartFacts {
  const read = (...args: string[]): string | undefined => {
    const result = git(...args);
    return result.status === 0 ? result.stdout : undefined;
  };
  const grafts = read("rev-parse", "--git-path", "info/grafts")?.trim();
  return {
    // The configured value, as written (a URL rewrite of git does not change what it names).
    originUrl: read("config", "--get", "remote.origin.url")?.trim(),
    shallow: read("rev-parse", "--is-shallow-repository"),
    grafts: grafts === undefined || grafts === "" ? undefined : existsSync(resolve(grafts)),
    config: read("config", "--list", "-z", "--includes"),
  };
}

type LocalFile = { path: string; executable: boolean; plain: boolean };

// Each file under the policy paths here, tracked or not, from the file system. A link or another
// kind of file gets no blob id, so it never matches the base tip.
function localFiles(): LocalFile[] {
  const files: LocalFile[] = [];
  const walk = (path: string): void => {
    // A policy path that is missing here has no entry; the base tip list names it.
    const stat = lstatSync(path, { throwIfNoEntry: false });
    if (stat === undefined) return;
    if (stat.isDirectory()) {
      for (const name of readdirSync(path).sort()) walk(`${path}/${name}`);
    } else {
      files.push({ path, executable: (stat.mode & 0o100) !== 0, plain: stat.isFile() });
    }
  };
  for (const path of BASE_PATHS) walk(path);
  return files;
}

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
    tree.push({ mode: match[1] ?? "", blob: match[2] ?? "", path: match[3] ?? "" });
  }
  const files = localFiles();
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
  const repo = originRepo(facts.originUrl ?? "");
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
  const second = readSnapshot({ repo, number }, gh);
  if (!second.ok) return stop(second.reason);
  if (!sameSnapshot(snapshot, second.snapshot)) {
    return stop("the PR changed during the check (head, base, state or checks)");
  }
  return classify({
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
  });
}

const result = main(process.argv[2]);
for (const line of result.lines) console.log(line);
process.exitCode = result.exit;
