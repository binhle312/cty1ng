// `pnpm merge:check <PR number>`: may the chief merge this PR? Exit 0 prints the one merge line;
// exit 1 means no chief merge; exit 2 means it cannot check. Run it from a clean checkout of
// origin/main: it judges with the base code only, so a PR cannot judge itself with its own list
// (R-002; owner, 2026-11-19, order 108). The base check finds a local change by mistake; it cannot
// prove that the code that runs it is the base code, because that code runs first.
//
// Option A (owner, 2026-11-20, orders 128 and 130): the trusted local files, then one GitHub
// snapshot, the base check against that snapshot's base tip, the git diff at the snapshot's
// commit ids, and a second snapshot that must be the same in each field.
import { spawnSync } from "node:child_process";
import { SETTINGS_FILE, SHORT_TERM, readSettings } from "./lib/check-memory.ts";
import { readIfExists, readOwnerRecord } from "./lib/check-memory-local.ts";
import { type MergeResult, cannotCheck, classify } from "./lib/merge-check.ts";
import { type GitRun, readDiff } from "./lib/merge-check-diff.ts";
import { type Repo, type Run, readSnapshot, sameSnapshot } from "./lib/merge-check-snapshot.ts";
import { OWNER_RECORD } from "./lib/owner-quotes.ts";

// The code and the values that the judgment reads: each must be the same as at the base tip.
const BASE_PATHS = ["scripts", "package.json", ".agents/chief/scripts", SETTINGS_FILE];
const LIST_FILE = ".agents/chief/scripts/lib/merge-list.ts";
const UTF8 = new TextDecoder("utf-8", { fatal: true });

// Git runs with no replace objects, and gives its output as bytes.
const gitBytes: GitRun = (args) => {
  const result = spawnSync("git", args, {
    env: { ...process.env, GIT_NO_REPLACE_OBJECTS: "1" },
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

// The GitHub repository of the `origin` remote: the one that the query reads and the merge line
// names.
function originRepo(): Repo | undefined {
  // The configured value, as written (a URL rewrite of git does not change what it names).
  const url = git("config", "--get", "remote.origin.url").stdout.trim();
  const match =
    /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?$/.exec(
      url,
    );
  if (match?.[1] === undefined || match[2] === undefined) return undefined;
  return { owner: match[1], name: match[2] };
}

// The base check against the snapshot's base tip: a reason to stop, or undefined.
function baseProblem(baseTip: string): string | undefined {
  if (git("fetch", "--quiet", "--no-tags", "origin", baseTip).status !== 0) {
    return "git could not fetch the base tip of the PR";
  }
  if (git("cat-file", "-e", `${baseTip}:${LIST_FILE}`).status !== 0) {
    return "the base tip has no list file. Run merge:check from a checkout of main";
  }
  const differs = git("diff", "--quiet", baseTip, "--", ...BASE_PATHS).status !== 0;
  const untracked = git("ls-files", "--others", "--exclude-standard", "--", ...BASE_PATHS);
  if (untracked.status !== 0) return "git could not list the untracked files";
  if (differs || untracked.stdout.trim() !== "") {
    return "the merge-check code here differs from the base tip of the PR. Run merge:check from a clean checkout of origin/main";
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
  const repo = originRepo();
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
