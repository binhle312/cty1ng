// The judgment of `pnpm merge:check <PR>` (pure): which kind of PR it is, and if the chief may
// merge it. The caller reads the PR from gh, the owner record and the private words.
//
// - A memory PR changes only `.agents/chief/memories/`. The chief merges it when CI is green, no changed
//   file holds a private word, and each quote of each added or changed rule file is in the owner
//   record (owner, 2026-11-19, orders 108 and 109).
// - A mixed PR changes `.agents/chief/memories/` and other files: no chief merge (order 108).
// - A code PR: a path of the list file means that no standing permission covers it
//   (`AGENTS.md` §7). Else the script prints the Not-checked items and the merge line.
import { z } from "zod";
import { checkPrivateWords } from "./check-memory.ts";
import {
  DEPENDENCY_TEXT,
  MEMORY_FOLDER,
  MERGE_LIST,
  PACKAGE_FIELDS,
  listedItem,
} from "./merge-list.ts";
import { OWNER_RECORD, checkOwnerQuotes } from "./owner-quotes.ts";

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
export type CiCheck = { name: string; state: "pass" | "pending" | "fail" };
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

export function cannotCheck(input: {
  pr: number | string;
  reason: string;
  memory: boolean;
}): MergeResult {
  const { pr, reason, memory } = input;
  const action = memory ? "Do not merge it." : "Treat it as listed: the owner merges it.";
  return { exit: 2, lines: [`Cannot check #${pr}: ${reason}. ${action}`] };
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
function packageChanged(file: PrFile): boolean {
  if (file.status !== "added" && file.baseText === undefined)
    throw new CannotCheck(`no base text for ${file.previousPath ?? file.path}`);
  if (file.status !== "removed" && file.headText === undefined)
    throw new CannotCheck(`no head text for ${file.path}`);
  const base = packageFields(file.baseText, file.previousPath ?? file.path);
  const head = packageFields(file.headText, file.path);
  return PACKAGE_FIELDS.some(
    (field) => JSON.stringify(base[field]) !== JSON.stringify(head[field]),
  );
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
  const ci =
    input.checks.length === 0
      ? ["no CI check has run"]
      : input.checks
          .filter((check) => check.state !== "pass")
          .map((check) => `the CI check ${check.name} is ${check.state}`);
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
        "Question 3: yes. The owner merges it (AGENTS.md §7): no standing permission covers it.",
      ],
    };
  }
  return {
    exit: 0,
    lines: [
      header,
      "Question 3: no by path. Read the Not-checked items, then question 4.",
      ...MERGE_LIST.filter((item) => item.notByPath !== undefined).map(
        (item) => `Not checked (${item.text}): ${item.notByPath ?? ""}`,
      ),
      `gh pr merge ${input.number} --merge --match-head-commit ${input.head}`,
    ],
  };
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
  try {
    if (memory) return memoryGate(input, header);
    if (names.some(inMemory)) {
      return {
        exit: 1,
        lines: [
          header,
          "MIXED: a memory PR changes only `.agents/chief/memories/`. Split it. No chief merge.",
        ],
      };
    }
    return codeCheck(input, header);
  } catch (error) {
    if (error instanceof CannotCheck) {
      return cannotCheck({ pr: input.number, reason: error.message, memory });
    }
    throw error;
  }
}
