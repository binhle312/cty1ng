// The judgment of `pnpm merge:check <PR>` (pure): which kind of PR it is, and if the chief may
// merge it. Its input comes from one GitHub snapshot (`merge-check-snapshot.ts`), the local git
// diff at the commits of that snapshot (`merge-check-diff.ts`), and two trusted local files: the
// owner record and the private words (option A; owner, 2026-11-20, orders 128 and 130).
//
// - First, each PR: a PR that is not open cannot be checked (exit 2). No chief merge of a PR that
//   comes from a fork, has an author other than the repository owner, or is for a base other
//   than main. A path that is not printable ASCII stops the chief. No merge line while a touched
//   path changed on main after the branch split: merge main first.
// - A memory PR changes only `.agents/chief/memories/`. With no owner record or no private word
//   list it cannot be checked (exit 2). Each base and head text must have one supported form, or
//   the chief stops (plan delta r1 §2.2). The chief merges it when it only adds or changes `.md`
//   files of the path grammar of `long-term/` (not the audit files), touches no file with
//   `permission-rule` (the owner merges each one, order 130), each required CI check passed, no
//   changed file holds a private word, and each quote of each added or changed rule is in the
//   owner record (orders 108 and 109).
// - Plan delta r2 (owner, 2026-11-20, order 147): the judgment has two steps. `decideRecords`
//   decides from the records (paths, statuses, modes) and the CI facts and reads nothing; only
//   when they decide nothing does it name the texts to read. `decideContent` decides from those
//   texts. The CLI reads the texts between the two steps, before its second snapshot.
// - A mixed PR changes `.agents/chief/memories/` and other files: no chief merge (order 108).
// - A code PR: a path of the list file, or an added, deleted or retyped `package.json`, means
//   that no standing permission covers it (`AGENTS.md` §7). Else, when each required CI check
//   passed, the script prints the Not-checked items and the merge line.
import { z } from "zod";
import { PERMISSION_RULE, RULE_FIELDS, checkPrivateWords, frontmatter } from "./check-memory.ts";
import {
  CI_APP_ID,
  CI_WORKFLOW,
  DEPENDENCY_TEXT,
  MEMORY_FOLDER,
  MEMORY_PATH,
  MEMORY_PROTECTED,
  MERGE_LIST,
  PACKAGE_FIELDS,
  REQUIRED_CHECKS,
  listedItem,
} from "./merge-list.ts";
import { OWNER_RECORD, checkOwnerQuotes } from "./owner-quotes.ts";

// The status of a path in `git diff --no-renames`: a rename is a delete and an add.
export type DiffStatus = "A" | "M" | "D" | "T";

// A changed path of the PR, from the merge base to the head. `baseText` is the text at the merge
// base and `headText` at the head; the reader fills them only for paths of `needsText`.
// `liveChanged` is true when main changed this path after the merge base. `supported` is false
// for a path with a byte outside 0x21-0x7E (`path` is then an escaped form), and
// `textUnsupported` is true when a memory text is not UTF-8.
export type PrFile = {
  path: string;
  supported: boolean;
  textUnsupported?: boolean;
  status: DiffStatus;
  oldMode: string;
  newMode: string;
  // The blob ids of the raw diff (the reader reads a text by its id); tests may leave them out.
  oldBlob?: string;
  newBlob?: string;
  liveChanged: boolean;
  baseText?: string | undefined;
  headText?: string | undefined;
};

// One text that the judgment needs: a side of a file, read by its blob id. A memory text keeps a
// BOM; a manifest (`package.json`) is decoded as before plan delta r1.
export type ContentKind = "memory" | "manifest";
export type ContentRead = { path: string; side: "base" | "head"; blob: string; kind: ContentKind };
// `unsupported`: a memory text that is not UTF-8 (the chief stops). `failed`: the text cannot be
// read, or a manifest is not UTF-8 (cannot check).
export type ReadResult =
  { kind: "text"; text: string } | { kind: "unsupported" } | { kind: "failed"; reason: string };
export type Reader = (read: ContentRead) => ReadResult;
export type CheckState = "pass" | "skipped" | "pending" | "fail";
export type CiCheck =
  | {
      kind: "run";
      id: number;
      name: string;
      state: CheckState;
      appId: number;
      workflowPath: string | null;
    }
  | { kind: "status"; context: string; state: CheckState };
export type MergeInput = {
  // "owner/name" of the repository that the snapshot read.
  repo: string;
  number: number;
  state: string;
  head: string;
  files: readonly PrFile[];
  checks: readonly CiCheck[];
  // The texts of the owner record files, or undefined when the folder is missing.
  record: readonly string[] | undefined;
  // The lines of `short-term/private-words.txt`, or undefined when the file is missing.
  privateWords: readonly string[] | undefined;
  minQuoteWords: number;
  baseRef: string;
  crossRepository: boolean;
  author: string;
  expectedAuthor: string;
};
export type MergeResult = { exit: 0 | 1 | 2; lines: string[] };

const SHORT_TERM = `${MEMORY_FOLDER}short-term/`;
const RULES = `${MEMORY_FOLDER}long-term/rules/`;
const RULE_FILE = /\/R-\d{3}-[a-z0-9-]+\.md$/;
const FILE_MODE = "100644";

const isPackageJson = (path: string): boolean =>
  path === "package.json" || path.endsWith("/package.json");
export const inMemory = (path: string): boolean => path.startsWith(MEMORY_FOLDER);
const isRule = (path: string): boolean => path.startsWith(RULES) && RULE_FILE.test(path);

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

// The one merge line: the full URL of the PR that the snapshot read, and its head.
export function mergeLine(input: { repo: string; number: number; head: string }): string {
  return `gh pr merge https://github.com/${input.repo}/pull/${input.number} --merge --match-head-commit ${input.head}`;
}

class CannotCheck extends Error {}

const OBJECT = z.record(z.string(), z.unknown());

function packageFields(text: string | null, path: string): Record<string, unknown> {
  if (text === null) throw new CannotCheck(`${path} is not UTF-8`);
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

const isRequiredRun = (check: CiCheck, name: string): boolean =>
  check.kind === "run" &&
  check.name === name &&
  check.appId === CI_APP_ID &&
  check.workflowPath === CI_WORKFLOW;

// Each required CI check must have passed as a run of the CI workflow of GitHub Actions, and no
// check of the snapshot, of any name or kind, may be pending or red.
function ciProblems(checks: readonly CiCheck[]): string[] {
  const problems: string[] = [];
  for (const name of REQUIRED_CHECKS) {
    const states = checks.filter((check) => isRequiredRun(check, name)).map((c) => c.state);
    const state = states.find((value) => value !== "pass") ?? states[0] ?? "missing";
    if (state !== "pass") problems.push(`the required CI check ${name} is ${state}`);
  }
  for (const check of checks) {
    if (check.state !== "pending" && check.state !== "fail") continue;
    if (REQUIRED_CHECKS.some((name) => isRequiredRun(check, name))) continue;
    const name = check.kind === "run" ? check.name : check.context;
    problems.push(`the CI check ${name} (${check.kind}) is ${check.state}`);
  }
  return problems;
}

// The one supported form of a memory text (plan delta r1 §2.2; the 48 long-term files of
// 2026-11-20 have it): letters, marks, numbers, punctuation, symbols, space, tab and line feed
// only; it opens with front matter ("---" line) or a "# " heading; the front matter has exact
// "---" lines, "key: value" lines, no repeated key and only the keys of RULE_FIELDS or
// PERMISSION_RULE; no body line starts with the permission field in any case. Each problem stops
// the chief: it does not guess what an unsupported text means.
const TEXT_CLASSES = /^[\p{L}\p{M}\p{N}\p{P}\p{S} \n\t]*$/u;
const FIELD_IN_BODY = /^\s*permission-rule\s*:/im;
const KEYS = new Set<string>([...RULE_FIELDS, PERMISSION_RULE]);
export function memoryTextProblems(text: string): string[] {
  if (!TEXT_CLASSES.test(text)) {
    return [
      "a character that is not a letter, mark, number, punctuation, symbol, space, tab or line feed",
    ];
  }
  const body = (part: string): string[] =>
    FIELD_IN_BODY.test(part) ? [`a body line starts with ${PERMISSION_RULE}`] : [];
  if (text.startsWith("# ")) return body(text);
  if (!text.startsWith("---\n")) return ['the text opens with neither a "---" line nor "# "'];
  const parsed = frontmatter(text);
  if (parsed === undefined) return ['the front matter has no exact closing "---" line'];
  const problems = parsed.bad.map(
    () => 'a front-matter line is not "key: value", or repeats a key',
  );
  for (const key of parsed.fields.keys()) {
    if (!KEYS.has(key)) problems.push(`the front-matter key ${key} is not in the list`);
  }
  return [...problems, ...body(parsed.body)];
}

// The reason why the chief merges no PR in this state, or undefined.
function originProblem(input: MergeInput): string | undefined {
  if (input.crossRepository) return "the PR comes from a fork";
  if (input.author !== input.expectedAuthor) {
    return `the PR author ${input.author} is not the repository owner`;
  }
  if (input.baseRef !== "main") return `the PR is for ${input.baseRef}, not main`;
  return undefined;
}

// A side of a memory file: the text, or null for a text that is not UTF-8 (unsupported).
type Side = { name: "base" | "head"; text: string | null };
type MemoryTexts = { file: PrFile; sides: Side[] };

// The texts of a memory PR in an unsupported form: each one stops the chief.
function textProblems(memory: readonly MemoryTexts[]): string[] {
  const problems: string[] = [];
  for (const { file, sides } of memory) {
    for (const side of sides) {
      if (side.text === null) {
        problems.push(`${file.path}: the chief stops: the ${side.name} text is not UTF-8`);
        continue;
      }
      for (const problem of memoryTextProblems(side.text)) {
        problems.push(`${file.path}: the chief stops: the ${side.name} text has ${problem}`);
      }
    }
  }
  return problems;
}

// True when a text has front matter with the `permission-rule` field (any value): the owner
// merges each such file (order 130). The text form was checked first.
function hasPermissionField(text: string): boolean {
  return frontmatter(text)?.fields.has(PERMISSION_RULE) === true;
}

// The record rules of a memory PR (no text needed): a path, a status or a mode outside the
// allowlist, and an audit file. Each one needs the owner.
function recordOwnerProblems(files: readonly PrFile[]): string[] {
  const problems: string[] = [];
  for (const file of files) {
    if (MEMORY_PROTECTED.includes(file.path)) {
      problems.push(`${file.path}: it holds the audit command or prompt; the owner merges it`);
    } else if (
      (file.status !== "A" && file.status !== "M") ||
      file.newMode !== FILE_MODE ||
      !MEMORY_PATH.test(file.path)
    ) {
      problems.push(
        `${file.path}: a memory PR may only add or change a .md file of long-term/ (status ${file.status}, mode ${file.newMode}); the owner merges it`,
      );
    }
  }
  return problems;
}

// The reads that a file needs: its base text unless it is added, its head text unless it is
// deleted.
function readsOf(file: PrFile, kind: ContentKind): ContentRead[] {
  const reads: ContentRead[] = [];
  if (file.status !== "A")
    reads.push({ path: file.path, side: "base", blob: file.oldBlob ?? "", kind });
  if (file.status !== "D")
    reads.push({ path: file.path, side: "head", blob: file.newBlob ?? "", kind });
  return reads;
}

// The result of the record step: a decisive result, or the texts that the content step needs.
export type RecordStep = { done: MergeResult } | { reads: ContentRead[]; memory: boolean };
// The texts of a record step, by `readKey`.
export type Texts = ReadonlyMap<string, ReadResult>;
export const readKey = (read: { side: string; path: string }): string =>
  `${read.side} ${read.path}`;

const isMemoryPr = (input: MergeInput): boolean =>
  input.files.length > 0 && input.files.every((file) => inMemory(file.path));
const headerOf = (input: MergeInput): string =>
  `merge:check #${input.number}, head ${input.head.slice(0, 7)}, ${input.files.length} files`;
const memoryFail = (header: string, reasons: string[]): MergeResult => ({
  exit: 1,
  lines: [header, ...reasons.map((reason) => `Memory PR: not mergeable: ${reason}`)],
});
const FREE =
  "Question 4: no by path. Read the Not-checked items. Question 5: merge only if a standing permission covers it, at the merge bar (R-002 path 2).";
const listedResult = (header: string, listed: string[]): MergeResult => ({
  exit: 1,
  lines: [
    header,
    ...listed,
    "Question 4: yes. No standing permission covers it (AGENTS.md §7): only the owner's own request (question 3, path 1) covers it.",
  ],
});

// The memory rules that need no text (plan delta r2 §2, steps 2 and 3).
function memoryRecords(input: MergeInput, header: string): RecordStep {
  // DQ-1031: the trusted local inputs first, for each memory PR.
  if ((input.record ?? []).every((text) => text.trim() === "")) {
    throw new CannotCheck(`no owner record (${OWNER_RECORD}/*.md)`);
  }
  if (input.privateWords === undefined)
    throw new CannotCheck(
      "no private word list (.agents/chief/memories/short-term/private-words.txt)",
    );
  const tracked = input.files
    .filter((file) => file.status !== "D")
    .filter((file) => file.path.startsWith(SHORT_TERM) && file.path !== `${SHORT_TERM}README.md`);
  if (tracked.length > 0) {
    return {
      done: memoryFail(
        header,
        tracked.map((file) => `${file.path} is a short-term file; git must not track it`),
      ),
    };
  }
  const owner = recordOwnerProblems(input.files);
  if (owner.length > 0) return { done: memoryFail(header, owner) };
  const ci = ciProblems(input.checks);
  if (ci.length > 0) return { done: memoryFail(header, ci) };
  return { reads: input.files.flatMap((file) => readsOf(file, "memory")), memory: true };
}

// The code rules that need no text: each listed path, an added, deleted or retyped
// `package.json`, then CI (plan delta r2 §2, steps 2 and 3).
function codeRecords(input: MergeInput, header: string): RecordStep {
  const listed: string[] = [];
  for (const file of input.files) {
    const item = listedItem(file.path);
    if (item !== undefined) listed.push(`LISTED ${file.path}: ${item.text}`);
    if (isPackageJson(file.path) && file.status !== "M") {
      listed.push(`LISTED ${file.path}: ${DEPENDENCY_TEXT}`);
    }
  }
  if (listed.length > 0) return { done: listedResult(header, listed) };
  const ci = ciProblems(input.checks);
  if (ci.length > 0) {
    return {
      done: {
        exit: 1,
        lines: [header, FREE, ...ci.map((problem) => `Not mergeable now: ${problem}`)],
      },
    };
  }
  const manifests = input.files.filter((file) => isPackageJson(file.path));
  return { reads: manifests.flatMap((file) => readsOf(file, "manifest")), memory: false };
}

// The record step of the judgment (plan delta r2 §2): each rule that needs no text, in order. It
// reads nothing; its reads list says which texts the content step needs.
export function decideRecords(input: MergeInput): RecordStep {
  const memory = isMemoryPr(input);
  const header = headerOf(input);
  const done = (result: MergeResult): RecordStep => ({ done: printed(result) });
  // DQ-1033: a PR that is not open cannot be checked.
  if (input.state !== "OPEN") {
    return { done: cannotCheck({ pr: input.number, reason: `the PR is ${input.state}`, memory }) };
  }
  const origin = originProblem(input);
  if (origin !== undefined) return done({ exit: 1, lines: [header, `No chief merge: ${origin}.`] });
  const unsupported = input.files.filter((file) => !file.supported);
  if (unsupported.length > 0) {
    return done({
      exit: 1,
      lines: [
        header,
        ...unsupported.map(
          (file) => `The chief stops: a path that is not printable ASCII: ${file.path}`,
        ),
      ],
    });
  }
  const stale = input.files.filter((file) => file.liveChanged);
  if (stale.length > 0) {
    return done({
      exit: 1,
      lines: [
        header,
        ...stale.map(
          (file) => `Merge main first: main changed ${file.path} after the branch split.`,
        ),
      ],
    });
  }
  if (!memory && input.files.some((file) => inMemory(file.path))) {
    return done({
      exit: 1,
      lines: [
        header,
        "MIXED: a memory PR changes only `.agents/chief/memories/`. Split it. No chief merge.",
      ],
    });
  }
  try {
    const step = memory ? memoryRecords(input, header) : codeRecords(input, header);
    return "done" in step ? done(step.done) : step;
  } catch (error) {
    if (error instanceof CannotCheck) {
      return { done: cannotCheck({ pr: input.number, reason: error.message, memory }) };
    }
    throw error;
  }
}

// The texts of the reads, each read one time, in order; the first failed read stops.
export function readTexts(
  reads: readonly ContentRead[],
  reader: Reader,
): { ok: true; texts: Texts } | { ok: false; reason: string } {
  const texts = new Map<string, ReadResult>();
  for (const read of reads) {
    const result = reader(read);
    if (result.kind === "failed") return { ok: false, reason: result.reason };
    texts.set(readKey(read), result);
  }
  return { ok: true, texts };
}

function textOf(texts: Texts, read: { side: string; path: string }): string | null {
  const result = texts.get(readKey(read));
  if (result === undefined || result.kind === "failed") {
    throw new CannotCheck(`no ${read.side} text for ${read.path}`);
  }
  return result.kind === "unsupported" ? null : result.text;
}

type Step = { texts: Texts; header: string };

function memoryContent(input: MergeInput, step: Step): MergeResult {
  const { texts, header } = step;
  const memory: MemoryTexts[] = input.files.map((file) => ({
    file,
    sides: readsOf(file, "memory").map((read) => ({ name: read.side, text: textOf(texts, read) })),
  }));
  const form = textProblems(memory);
  if (form.length > 0) return memoryFail(header, form);
  // The text form passed, so each side is a text here.
  const sideText = (entry: MemoryTexts, name: "base" | "head"): string | undefined => {
    const side = entry.sides.find((item) => item.name === name);
    return side === undefined || side.text === null ? undefined : side.text;
  };
  const permission = memory
    .filter((entry) =>
      entry.sides.some((side) => side.text !== null && hasPermissionField(side.text)),
    )
    .map(
      (entry) =>
        `${entry.file.path}: it adds or changes a rule with ${PERMISSION_RULE}; the owner merges each one (order 130)`,
    );
  if (permission.length > 0) return memoryFail(header, permission);
  const heads = new Map(memory.map((entry) => [entry.file.path, sideText(entry, "head") ?? ""]));
  const words = checkPrivateWords(heads, input.privateWords ?? []);
  if (words.length > 0) return memoryFail(header, words);
  const rules = memory
    .filter((entry) => isRule(entry.file.path))
    .map((entry) => ({ path: entry.file.path, text: sideText(entry, "head") ?? "" }));
  if (rules.length > 0) {
    const quotes = checkOwnerQuotes({ rules, record: input.record, minWords: input.minQuoteWords });
    // The record step read the owner record first (DQ-1031), so `quotes.noRecord` is false here.
    if (quotes.problems.length > 0) return memoryFail(header, quotes.problems);
  }
  return {
    exit: 0,
    lines: [
      header,
      "Memory PR: the chief merges it (owner, 2026-11-19, order 108).",
      "Not checked: read the whole diff for private facts.",
      mergeLine(input),
    ],
  };
}

function codeContent(input: MergeInput, step: Step): MergeResult {
  const { texts, header } = step;
  const listed: string[] = [];
  for (const file of input.files.filter((item) => isPackageJson(item.path))) {
    const base = packageFields(textOf(texts, { side: "base", path: file.path }), file.path);
    const head = packageFields(textOf(texts, { side: "head", path: file.path }), file.path);
    if (
      PACKAGE_FIELDS.some((field) => JSON.stringify(base[field]) !== JSON.stringify(head[field]))
    ) {
      listed.push(`LISTED ${file.path}: ${DEPENDENCY_TEXT}`);
    }
  }
  if (listed.length > 0) return listedResult(header, listed);
  return {
    exit: 0,
    lines: [
      header,
      FREE,
      ...MERGE_LIST.filter((item) => item.notByPath !== undefined).map(
        (item) => `Not checked (${item.text}): ${item.notByPath ?? ""}`,
      ),
      mergeLine(input),
    ],
  };
}

// The content step of the judgment (plan delta r2 §2, step 4): the rules that need the texts of
// the record step. It reads nothing.
export function decideContent(input: MergeInput, texts: Texts): MergeResult {
  const memory = isMemoryPr(input);
  const header = headerOf(input);
  try {
    return printed(
      memory ? memoryContent(input, { texts, header }) : codeContent(input, { texts, header }),
    );
  } catch (error) {
    if (error instanceof CannotCheck) {
      return cannotCheck({ pr: input.number, reason: error.message, memory });
    }
    throw error;
  }
}

// The two steps with a reader, for one read of the PR (the CLI reads between the steps, before
// its second snapshot).
export function classifyWith(input: MergeInput, reader: Reader): MergeResult {
  const step = decideRecords(input);
  if ("done" in step) return step.done;
  const read = readTexts(step.reads, reader);
  if (!read.ok) return cannotCheck({ pr: input.number, reason: read.reason, memory: step.memory });
  return decideContent(input, read.texts);
}

// The judgment with the texts in the files (`baseText`, `headText`, `textUnsupported`).
export function classify(input: MergeInput): MergeResult {
  return classifyWith(input, (read) => {
    const file = input.files.find((item) => item.path === read.path);
    const text = read.side === "base" ? file?.baseText : file?.headText;
    if (text !== undefined) return { kind: "text", text };
    if (file?.textUnsupported === true) return { kind: "unsupported" };
    return { kind: "failed", reason: `no ${read.side} text for ${read.path}` };
  });
}
