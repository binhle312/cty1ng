// The judgment of `pnpm merge:check <PR>` (pure): which kind of PR it is, and if the chief may
// merge it. The caller reads the PR from gh, the owner record and the private words.
//
// - First, each PR: no chief merge of a PR from a fork, by an author other than the repository
//   owner, or for a base other than main.
// - A memory PR changes only `.agents/chief/memories/`. The chief merges it when each required CI
//   check passed, no changed file holds a private word, each quote of each added or changed rule
//   file is in the owner record, no permission rule is removed, and a changed permission rule has
//   a new owner quote (owner, 2026-11-19, orders 108 and 109).
// - A mixed PR changes `.agents/chief/memories/` and other files: no chief merge (order 108).
// - A code PR: a path of the list file means that no standing permission covers it
//   (`AGENTS.md` §7). Else, when each required CI check passed, the script prints the Not-checked
//   items and the merge line.
import { z } from "zod";
import { checkPrivateWords } from "./check-memory.ts";
import {
  DEPENDENCY_TEXT,
  MEMORY_FOLDER,
  MERGE_LIST,
  PACKAGE_FIELDS,
  REQUIRED_CHECKS,
  listedItem,
} from "./merge-list.ts";
import { OWNER_RECORD, checkOwnerQuotes, ownerQuotes } from "./owner-quotes.ts";

export type FileStatus =
  "added" | "removed" | "modified" | "renamed" | "copied" | "changed" | "unchanged";

// A changed file of the PR. `baseText` is the text at the base (at `previousPath` after a rename),
// `headText` the text at the head; the reader fills them only for files of `needsText`.
export type PrFile = {
  path: string;
  previousPath: string | undefined;
  status: FileStatus;
  baseText?: string | undefined;
  headText?: string | undefined;
};
export type CiCheck = { name: string; state: "pass" | "skipped" | "pending" | "fail" };
export type MergeInput = {
  number: number;
  head: string;
  files: readonly PrFile[];
  checks: readonly CiCheck[];
  // The texts of the owner record files, or undefined when the folder is missing.
  record: readonly string[] | undefined;
  // The lines of `short-term/private-words.txt`, or undefined when the file is missing.
  privateWords: readonly string[] | undefined;
  minQuoteWords: number;
  // The base branch of the PR, if its head branch is in a fork, its author, and the login of the
  // repository owner.
  baseRef: string;
  crossRepository: boolean;
  author: string;
  expectedAuthor: string;
};
export type MergeResult = { exit: 0 | 1 | 2; lines: string[] };

// The GitHub API gives the first 3,000 files of a PR and no more.
export const MAX_FILES = 3000;

const SHORT_TERM = `${MEMORY_FOLDER}short-term/`;
const RULES = `${MEMORY_FOLDER}long-term/rules/`;
const RULE_FILE = /\/R-\d{3}-[a-z0-9-]+\.md$/;

const isPackageJson = (path: string): boolean =>
  path === "package.json" || path.endsWith("/package.json");
const inMemory = (path: string): boolean => path.startsWith(MEMORY_FOLDER);
const namesOf = (file: PrFile): string[] =>
  file.previousPath === undefined ? [file.path] : [file.path, file.previousPath];

// The files whose text the classify step reads.
export function needsText(path: string): boolean {
  return isPackageJson(path) || inMemory(path);
}

// A line of output shows each control character as an escape, so a file name cannot add a line.
export const isControl = (char: string): boolean => {
  const code = char.charCodeAt(0);
  return code < 0x20 || (code >= 0x7f && code <= 0x9f);
};
export function printable(line: string): string {
  return Array.from(line)
    .map((char) =>
      isControl(char) ? `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}` : char,
    )
    .join("");
}
const printed = (result: MergeResult): MergeResult => ({
  exit: result.exit,
  lines: result.lines.map(printable),
});

export function cannotCheck(input: {
  pr: number | string;
  reason: string;
  memory: boolean;
}): MergeResult {
  const { pr, reason, memory } = input;
  const action = memory ? "Do not merge it." : "Treat it as listed: the owner merges it.";
  return printed({ exit: 2, lines: [`Cannot check #${pr}: ${reason}. ${action}`] });
}

class CannotCheck extends Error {}

const OBJECT = z.record(z.string(), z.unknown());

function packageFields(text: string | undefined, path: string): Record<string, unknown> {
  if (text === undefined) return {};
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new CannotCheck(`${path} is not JSON`);
  }
  const parsed = OBJECT.safeParse(value);
  if (!parsed.success) throw new CannotCheck(`${path} is not a JSON object`);
  return parsed.data;
}

// A `package.json` change is listed when a field of PACKAGE_FIELDS differs between base and head.
// A rename is a delete of the old name and an add of the new name: only a `package.json` side
// counts, so a manifest renamed to another name is a removed manifest.
function packageChanged(file: PrFile): boolean {
  const old = file.previousPath ?? file.path;
  if (file.status !== "added" && file.baseText === undefined)
    throw new CannotCheck(`no base text for ${old}`);
  if (file.status !== "removed" && file.headText === undefined)
    throw new CannotCheck(`no head text for ${file.path}`);
  const base = isPackageJson(old) ? packageFields(file.baseText, old) : {};
  const head = isPackageJson(file.path) ? packageFields(file.headText, file.path) : {};
  return PACKAGE_FIELDS.some(
    (field) => JSON.stringify(base[field]) !== JSON.stringify(head[field]),
  );
}

// Each required CI check must have passed, and no other check may be pending or red.
function ciProblems(checks: readonly CiCheck[]): string[] {
  const problems: string[] = [];
  for (const name of REQUIRED_CHECKS) {
    const states = checks.filter((check) => check.name === name).map((check) => check.state);
    const state = states.find((value) => value !== "pass") ?? states[0] ?? "missing";
    if (state !== "pass") problems.push(`the required CI check ${name} is ${state}`);
  }
  const required: readonly string[] = REQUIRED_CHECKS;
  for (const check of checks) {
    if (required.includes(check.name)) continue;
    if (check.state === "pending" || check.state === "fail") {
      problems.push(`the CI check ${check.name} is ${check.state}`);
    }
  }
  return problems;
}

const PERMISSION_FIELD = /^permission-rule: true$/m;

// The rule changes that need the owner: a removed permission rule, and a changed permission rule
// with no quote that is new at the head (order 109: a permission counts only with the owner's
// quoted words).
function permissionProblems(files: readonly PrFile[]): string[] {
  const problems: string[] = [];
  for (const file of files) {
    const old = file.previousPath ?? file.path;
    const isRule = [file.path, old].some((path) => path.startsWith(RULES) && RULE_FILE.test(path));
    if (!isRule) continue;
    const base = file.baseText ?? "";
    const head = file.status === "removed" ? "" : (file.headText ?? "");
    if (!PERMISSION_FIELD.test(base) && !PERMISSION_FIELD.test(head)) continue;
    if (file.status === "removed") {
      problems.push(`${old}: it removes a permission rule; only the owner removes one`);
      continue;
    }
    if (base === "" || base === head) continue;
    const baseQuotes = new Set(ownerQuotes(base));
    if (ownerQuotes(head).every((quote) => baseQuotes.has(quote))) {
      problems.push(
        `${file.path}: it changes a permission rule with no new owner quote (order 109)`,
      );
    }
  }
  return problems;
}

function memoryGate(input: MergeInput, header: string): MergeResult {
  const fail = (reasons: string[]): MergeResult => ({
    exit: 1,
    lines: [header, ...reasons.map((reason) => `Memory PR: not mergeable: ${reason}`)],
  });
  const tracked = input.files
    .filter((file) => file.status !== "removed")
    .filter((file) => file.path.startsWith(SHORT_TERM) && file.path !== `${SHORT_TERM}README.md`);
  if (tracked.length > 0) {
    return fail(tracked.map((file) => `${file.path} is a short-term file; git must not track it`));
  }
  const heads = new Map<string, string>();
  for (const file of input.files) {
    if (file.status === "removed") continue;
    if (file.headText === undefined) throw new CannotCheck(`no head text for ${file.path}`);
    heads.set(file.path, file.headText);
  }
  // A rule file needs its base text, so the permission check can compare it.
  for (const file of input.files) {
    const old = file.previousPath ?? file.path;
    if (file.status === "added" || !(old.startsWith(RULES) && RULE_FILE.test(old))) continue;
    if (file.baseText === undefined)
      throw new CannotCheck(`no base text for ${file.previousPath ?? file.path}`);
  }
  const ci = ciProblems(input.checks);
  if (ci.length > 0) return fail(ci);
  if (input.privateWords === undefined)
    throw new CannotCheck(
      "no private word list (.agents/chief/memories/short-term/private-words.txt)",
    );
  const words = checkPrivateWords(heads, input.privateWords);
  if (words.length > 0) return fail(words);
  const rules = [...heads]
    .filter(([path]) => path.startsWith(RULES) && RULE_FILE.test(path))
    .map(([path, text]) => ({ path, text }));
  if (rules.length > 0) {
    const quotes = checkOwnerQuotes({
      rules,
      record: input.record,
      minWords: input.minQuoteWords,
    });
    if (quotes.noRecord) throw new CannotCheck(`no owner record (${OWNER_RECORD}/*.md)`);
    if (quotes.problems.length > 0) return fail(quotes.problems);
  }
  const permissions = permissionProblems(input.files);
  if (permissions.length > 0) return fail(permissions);
  return {
    exit: 0,
    lines: [
      header,
      "Memory PR: the chief merges it (owner, 2026-11-19, order 108).",
      "Not checked: read the whole diff for private facts.",
      `gh pr merge ${input.number} --merge --match-head-commit ${input.head}`,
    ],
  };
}

function codeCheck(input: MergeInput, header: string): MergeResult {
  const listed: string[] = [];
  for (const file of input.files) {
    for (const name of namesOf(file)) {
      const item = listedItem(name);
      if (item !== undefined) listed.push(`LISTED ${name}: ${item.text}`);
    }
    if (namesOf(file).some(isPackageJson) && packageChanged(file)) {
      listed.push(`LISTED ${file.path}: ${DEPENDENCY_TEXT}`);
    }
  }
  if (listed.length > 0) {
    return {
      exit: 1,
      lines: [
        header,
        ...listed,
        "Question 4: yes. No standing permission covers it (AGENTS.md §7): only the owner's own request (question 3, path 1) covers it.",
      ],
    };
  }
  const free =
    "Question 4: no by path. Read the Not-checked items. Question 5: merge only if a standing permission covers it, at the merge bar (R-002 path 2).";
  const ci = ciProblems(input.checks);
  if (ci.length > 0) {
    return {
      exit: 1,
      lines: [header, free, ...ci.map((problem) => `Not mergeable now: ${problem}`)],
    };
  }
  return {
    exit: 0,
    lines: [
      header,
      free,
      ...MERGE_LIST.filter((item) => item.notByPath !== undefined).map(
        (item) => `Not checked (${item.text}): ${item.notByPath ?? ""}`,
      ),
      `gh pr merge ${input.number} --merge --match-head-commit ${input.head}`,
    ],
  };
}

// The reason why the chief merges no PR of this origin, or undefined.
function originProblem(input: MergeInput): string | undefined {
  if (input.crossRepository) return "the PR comes from a fork";
  if (input.author !== input.expectedAuthor) {
    return `the PR author ${input.author} is not the repository owner`;
  }
  if (input.baseRef !== "main") return `the PR is for ${input.baseRef}, not main`;
  return undefined;
}

export function classify(input: MergeInput): MergeResult {
  const names = input.files.flatMap(namesOf);
  const memory = names.length > 0 && names.every(inMemory);
  if (input.files.length >= MAX_FILES) {
    return cannotCheck({
      pr: input.number,
      reason: `${input.files.length} files; the GitHub API gives 3,000 at most`,
      memory: false,
    });
  }
  const header = `merge:check #${input.number}, head ${input.head.slice(0, 7)}, ${input.files.length} files`;
  const origin = originProblem(input);
  if (origin !== undefined)
    return printed({ exit: 1, lines: [header, `No chief merge: ${origin}.`] });
  try {
    if (memory) return printed(memoryGate(input, header));
    if (names.some(inMemory)) {
      return {
        exit: 1,
        lines: [
          header,
          "MIXED: a memory PR changes only `.agents/chief/memories/`. Split it. No chief merge.",
        ],
      };
    }
    return printed(codeCheck(input, header));
  } catch (error) {
    if (error instanceof CannotCheck) {
      return cannotCheck({ pr: input.number, reason: error.message, memory });
    }
    throw error;
  }
}
