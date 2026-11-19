// `pnpm merge:check <PR number>`: may the chief merge this PR? Exit 0 prints the one merge line;
// exit 1 means no chief merge (a listed path, a mixed PR, or a memory PR that fails its gate);
// exit 2 means it cannot check. Run it from a clean checkout of origin/main: it judges with the
// base code only, so a PR cannot judge itself with its own list (R-002; owner, 2026-11-19, order
// 108). The base check finds a local change by mistake; it cannot prove that the code that runs
// it is the base code, because that code runs first.
import { spawnSync } from "node:child_process";
import { SETTINGS_FILE, SHORT_TERM, readSettings } from "./lib/check-memory.ts";
import { readIfExists, readOwnerRecord } from "./lib/check-memory-local.ts";
import { type MergeResult, cannotCheck, classify } from "./lib/merge-check.ts";
import { type Run, readPr } from "./lib/merge-check-gh.ts";
import { OWNER_RECORD } from "./lib/owner-quotes.ts";

// The code and the values that the judgment reads: each must be the same as on origin/main.
const BASE_PATHS = ["scripts", "package.json", ".agents/chief/scripts", SETTINGS_FILE];
const LIST_FILE = ".agents/chief/scripts/lib/merge-list.ts";

const run = (command: string, args: readonly string[]): { status: number; stdout: string } => {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { status: result.status ?? 1, stdout: result.stdout };
};
const git = (...args: string[]) => run("git", args);
const gh: Run = (args) => run("gh", args);

// The base check: a reason to stop, or undefined.
function baseProblem(): string | undefined {
  if (git("fetch", "--quiet", "origin", "main").status !== 0) return "git fetch origin main failed";
  if (git("cat-file", "-e", `origin/main:${LIST_FILE}`).status !== 0) {
    return "the base (origin/main) has no list file. Run merge:check from a checkout of main";
  }
  const differs = git("diff", "--quiet", "origin/main", "--", ...BASE_PATHS).status !== 0;
  const untracked = git("ls-files", "--others", "--exclude-standard", "--", ...BASE_PATHS);
  if (untracked.status !== 0) return "git could not list the untracked files";
  if (differs || untracked.stdout.trim() !== "") {
    return "the merge-check code here differs from origin/main. Run merge:check from a checkout of main";
  }
  return undefined;
}

function main(arg: string | undefined): MergeResult {
  if (arg === undefined || !/^[1-9]\d*$/.test(arg)) {
    return cannotCheck({ pr: arg ?? "", reason: "the argument is not a PR number", memory: false });
  }
  const number = Number(arg);
  const problem = baseProblem();
  if (problem !== undefined) return cannotCheck({ pr: number, reason: problem, memory: false });
  const minWords = readSettings(readIfExists(SETTINGS_FILE)).limits.get("quote_min_words");
  if (minWords === undefined)
    return cannotCheck({ pr: number, reason: "no setting quote_min_words", memory: false });
  const owner = gh(["repo", "view", "--json", "owner", "--jq", ".owner.login"]);
  const expectedAuthor = owner.stdout.trim();
  if (owner.status !== 0 || expectedAuthor === "") {
    return cannotCheck({
      pr: number,
      reason: "gh could not read the repository owner",
      memory: false,
    });
  }
  const pr = readPr(number, gh);
  if (!pr.ok) return cannotCheck({ pr: number, reason: pr.reason, memory: pr.memory });
  let record: readonly string[] | undefined;
  let words: string | undefined;
  try {
    record = readOwnerRecord(OWNER_RECORD);
    words = readIfExists(`${SHORT_TERM}/private-words.txt`);
  } catch {
    return cannotCheck({
      pr: number,
      reason: "the owner record or the private word list cannot be read",
      memory: true,
    });
  }
  return classify({
    number,
    head: pr.head,
    files: pr.files,
    checks: pr.checks,
    record,
    privateWords: words?.split("\n").filter((line) => line.trim() !== ""),
    minQuoteWords: minWords,
    baseRef: pr.baseRef,
    crossRepository: pr.crossRepository,
    author: pr.author,
    expectedAuthor,
  });
}

const result = main(process.argv[2]);
for (const line of result.lines) console.log(line);
process.exitCode = result.exit;
