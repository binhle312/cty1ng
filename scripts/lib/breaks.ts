import { posix } from "node:path";
import ts from "typescript";
import { z } from "zod";

// The break list of a PR (testing.md §5, "Break lists"): each claim names its test, the text of
// the assertion that must fail, and the breaks that must make that assertion fail. Pure
// functions only; scripts/check-breaks.ts runs the tests.

const Edit = z.object({ find: z.string().min(1), replace: z.string() }).strict();
const Break = z
  .object({ id: z.string().min(1), file: z.string().min(1), edits: z.array(Edit).min(1) })
  .strict();
const Claim = z
  .object({
    id: z.string().min(1),
    claim: z.string().min(1),
    test: z
      .object({
        kind: z.enum(["vitest", "e2e"]),
        file: z.string().min(1),
        name: z.string().min(1),
      })
      .strict(),
    // A text that occurs once in the test file: its line is where the failure must be. No line
    // numbers, so an edit above it does not make the list wrong.
    assertion: z.string().min(1),
    breaks: z.array(Break),
  })
  .strict();
// A test that the PR adds or changes, but that needs no break list (testing.md §5): for example
// a test written first, with its red run in the PR.
const Exempt = z
  .object({ file: z.string().min(1), name: z.string().min(1), reason: z.string().min(1) })
  .strict();
export const BreakList = z
  .object({ claims: z.array(Claim), exempt: z.array(Exempt).default([]) })
  .strict();
export type BreakList = z.infer<typeof BreakList>;
export type Claim = z.infer<typeof Claim>;
export type Break = z.infer<typeof Break>;

// A test call in a test file: its name as written (with `%s` for `it.each`, and for each `${…}`
// of a template) and its lines.
export interface TestCall {
  name: string;
  // How the name is written. "text": a string or a template; the test report gives it as the
  // name of the test. "expression": another expression, such as a variable; `name` is then its
  // text as written. No test report gives that text, so no claim can name such a test.
  nameKind: "text" | "expression";
  start: number;
  end: number;
  // The columns (from 0) where the call starts on the line `start` and ends on the line `end`.
  // Two test calls can be on one line, so the lines alone do not say which call has a place.
  startColumn: number;
  endColumn: number;
}

const TEST_FUNCTIONS = new Set(["it", "test"]);
const MODIFIERS = new Set(["only", "skip", "concurrent", "fails", "fixme", "slow", "each"]);

// A test call with the first line of each `describe` group around it.
interface GroupedCall extends TestCall {
  groups: string[];
}

function isTestFunction(node: ts.Expression): boolean {
  if (ts.isIdentifier(node)) return TEST_FUNCTIONS.has(node.text);
  if (ts.isPropertyAccessExpression(node))
    return MODIFIERS.has(node.name.text) && isTestFunction(node.expression);
  if (ts.isCallExpression(node)) return isTestFunction(node.expression);
  // `it.each` with a template table.
  if (ts.isTaggedTemplateExpression(node)) return isTestFunction(node.tag);
  return false;
}

// Whether an argument as written can be a function. A string, a template, a number, an object
// and an array are plain values. The reader cannot say what another expression gives, such as
// the name of a function, so that one can be a function.
function canBeFunction(arg: ts.Expression): boolean {
  const plainValue =
    ts.isStringLiteralLike(arg) ||
    ts.isTemplateExpression(arg) ||
    ts.isNumericLiteral(arg) ||
    ts.isObjectLiteralExpression(arg) ||
    ts.isArrayLiteralExpression(arg);
  return !plainValue;
}

// The name of a test call, or null for a call that is no test. A plain string is the name. A
// template with `${…}` gives its text with `%s` in the place of each `${…}`, so that
// `nameMatches` reads it as a name of `it.each`. Another expression, such as a variable, gives
// its text as written, but only when a later argument can be a function: `test.skip(condition,
// "reason")` inside a test of Playwright and `it.each(rows)` are no tests. A spread as the first
// argument can hold the name and the function. A test that this function does not see needs no
// claim, with no message (DQ-301). So a call that it cannot read for sure is a test call: its
// test then needs an exemption, with a message (DQ-306).
function nameOf(
  call: ts.CallExpression,
  source: ts.SourceFile,
): Pick<TestCall, "name" | "nameKind"> | null {
  const [first, ...rest] = call.arguments;
  if (first === undefined) return null;
  if (ts.isStringLiteralLike(first)) return { name: first.text, nameKind: "text" };
  if (ts.isTemplateExpression(first)) {
    const parts = [first.head.text, ...first.templateSpans.map((span) => span.literal.text)];
    return { name: parts.join("%s"), nameKind: "text" };
  }
  const hasFunction = ts.isSpreadElement(first) || rest.some(canBeFunction);
  return hasFunction ? { name: first.getText(source), nameKind: "expression" } : null;
}

// Whether a call starts a group: `describe(...)`, `describe.skip(...)`, `describe.each(rows)(...)`
// and `test.describe(...)` of Playwright.
function isDescribe(node: ts.Expression): boolean {
  if (ts.isIdentifier(node)) return node.text === "describe";
  if (ts.isPropertyAccessExpression(node))
    return node.name.text === "describe" || isDescribe(node.expression);
  if (ts.isCallExpression(node)) return isDescribe(node.expression);
  if (ts.isTaggedTemplateExpression(node)) return isDescribe(node.tag);
  return false;
}

function groupedCalls(at: { text: string; path: string }): GroupedCall[] {
  const { text, path } = at;
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const rows = text.split("\n");
  const place = (position: number) => source.getLineAndCharacterOfPosition(position);
  const calls: GroupedCall[] = [];
  const visit = (node: ts.Node, groups: string[]) => {
    let inside = groups;
    if (ts.isCallExpression(node)) {
      const from = place(node.getStart(source));
      const to = place(node.getEnd());
      // The line as written, with its spaces.
      if (isDescribe(node.expression)) inside = [...groups, rows[from.line] ?? ""];
      else if (isTestFunction(node.expression)) {
        const name = nameOf(node, source);
        const lines = { start: from.line + 1, end: to.line + 1 };
        const columns = { startColumn: from.character, endColumn: to.character };
        if (name !== null) calls.push({ ...name, ...lines, ...columns, groups });
      }
    }
    ts.forEachChild(node, (child) => {
      visit(child, inside);
    });
  };
  visit(source, []);
  return calls;
}

// The test calls of a Vitest or Playwright file: `it(...)`, `test(...)`, `it.each(rows)(...)`
// and the modifiers such as `test.skip(...)`. A `describe` is not a test.
export function testCalls(text: string, path: string): TestCall[] {
  return groupedCalls({ text, path }).map((call) => ({
    name: call.name,
    nameKind: call.nameKind,
    start: call.start,
    end: call.end,
    startColumn: call.startColumn,
    endColumn: call.endColumn,
  }));
}

// The key of each test of a file: its name, the first line of each `describe` group around it,
// and its text, from the first line of the test call to its last line. A test with a key that
// the old text does not have is a new or changed test. The groups are in the key because a group
// decides if its tests run: a test that moves out of a `describe.skip` group starts to run with
// no change of its text. A line end of Windows is no change.
function testKeys(at: { text: string; path: string }): { call: TestCall; key: string }[] {
  const unix = at.text.replace(/\r\n/g, "\n");
  const rows = unix.split("\n");
  return groupedCalls({ text: unix, path: at.path }).map(({ groups, ...call }) => ({
    call,
    key: JSON.stringify([call.name, groups, rows.slice(call.start - 1, call.end).join("\n")]),
  }));
}

// Whether a test name as the report gives it comes from a name as written: `it.each` fills
// `%s`, `%d` and the like.
export function nameMatches(written: string, reported: string): boolean {
  const parts = written.split(/%[sdifjo#%]/);
  const pattern = parts.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".+");
  return new RegExp(`^${pattern}$`).test(reported);
}

// The arguments of the `git diff` that lists the files that changed since `base`: one status
// letter and one name for each file, each with a NUL after it, so that git quotes no name. The
// runner reads no patch text: that text is for people, and git settings change it (DQ-161).
// `--no-renames`: a renamed file is a deleted file and a new file, so each test of the new file
// counts (DQ-262). `--no-relative`: with `diff.relative`, git lists only the files of the folder
// where it starts.
export function fileListArgs(base: string): string[] {
  return ["diff", "--name-status", "-z", "--no-renames", "--no-relative", base];
}

// A file of that list, with the status letter that git gives it.
export interface ListedFile {
  status: string;
  path: string;
}

// The files of the text of that command. A text that is no list of pairs stops the read with an
// error: a part that the reader drops is a file that needs no claim.
export function fileList(text: string): ListedFile[] {
  const parts = text.split("\0");
  const files: ListedFile[] = [];
  // The text ends with a NUL, so the last part is empty.
  let known = parts.pop() === "" && parts.length % 2 === 0;
  for (let at = 0; known && at < parts.length; at += 2) {
    const status = parts[at] ?? "";
    const path = parts[at + 1] ?? "";
    known = /^[A-Z]$/.test(status) && path !== "";
    files.push({ status, path });
  }
  if (!known) {
    throw new Error(`cannot read the file list of git: ${JSON.stringify(text.slice(0, 200))}`);
  }
  return files;
}

// The lines of the run with a break (`after`) that name the broken `file` and that the run with
// no break (`before`) did not print. Such a line comes from an error in the broken code: a throw
// while a page loads or renders, or an import that does not resolve. The page then never shows,
// and the first wait for it fails at the assertion line, so the test result alone cannot tell it
// from a real catch (testing.md §5).
export function newErrorLines(run: { before: string; after: string; file: string }): string[] {
  const name = run.file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const names = new RegExp(`(?:^|[\\s"'(/])${name}(?![\\w.-])`);
  const old = new Set(plain(run.before).split("\n"));
  return plain(run.after)
    .split("\n")
    .filter((row) => names.test(row) && !old.has(row));
}

const References = z.object({ references: z.array(z.object({ path: z.string().min(1) })).min(1) });

// The TypeScript projects that compile the package of `path`, as `tsc -p` takes them: the folder
// of a workspace package, or the root. A package config that points at other configs
// (`references`) compiles no file by itself, and `tsc -p` then exits with 0. So those configs
// take its place: the frontend has one for the browser code and one for the tests.
// `read` gives the text of a file of the repository, or null.
export function projectsOf(path: string, read: (path: string) => string | null): string[] {
  const top = path.split("/")[0] ?? "";
  // Each other package compiles the code of `shared/` that it uses, so a break there must
  // compile in each of them (DQ-166).
  if (top === "shared") {
    return ["shared", "backend", "frontend", "."].flatMap((folder) => configsOf(folder, read));
  }
  return configsOf(["backend", "frontend"].includes(top) ? top : ".", read);
}

function configsOf(folder: string, read: (path: string) => string | null): string[] {
  const file = posix.join(folder, "tsconfig.json");
  // The parser of TypeScript: a config can have comments and commas at the end.
  const parsed: unknown = ts.parseConfigFileTextToJson(file, read(file) ?? "{}").config;
  const config = References.safeParse(parsed);
  if (!config.success) return [folder];
  return config.data.references.map((reference) => posix.join(folder, reference.path));
}

// Whether the file list of `tsc --listFiles` has `file` (a path from the repository root) of
// the copy at `root`. A compile that does not read the broken file proves nothing about it.
export function listsFile(printed: string, at: { root: string; file: string }): boolean {
  const full = posix.join(at.root, at.file);
  return printed.split("\n").some((row) => row.trim() === full);
}

// The first error line of `tsc`, or null. With `--listFiles`, the output also has file paths.
export function firstTscError(printed: string): string | null {
  return printed.split("\n").find((row) => /\berror TS\d+:/.test(row)) ?? null;
}

// The first error of a `tsc` run that failed, for the report. Not escaped: `reportRow` does it.
export function tscProblem(printed: string): string {
  return (firstTscError(printed) ?? "tsc failed").slice(0, 200);
}

// A test file by its name (`a.test.tsx`, `b.spec.ts`).
const TEST_NAME = /\.(?:test|spec)\.[cm]?[jt]sx?$/;

// A file that tests read but that is not the code under test: a break must not edit it.
// That is a file in a `test/` folder, or a test file by its name.
export function isTestFile(path: string): boolean {
  return /(?:^|\/)test\//.test(path) || TEST_NAME.test(path);
}

// The tests of the new text `now` of a test file whose key the old text `before` does not have.
// Two tests with one key: each old test stands for one new test only.
export function changedTests(at: { before: string; now: string; path: string }): TestCall[] {
  const old = testKeys({ text: at.before, path: at.path }).map((test) => test.key);
  return testKeys({ text: at.now, path: at.path })
    .filter((test) => {
      const same = old.indexOf(test.key);
      if (same === -1) return true;
      old.splice(same, 1);
      return false;
    })
    .map((test) => test.call);
}

// The tests of the PR, by file, and the reasons to stop the run (testing.md §5, step 3). git
// says which files changed since `base`. Each test of a new test file counts, and each test of
// a changed test file whose key is new. `git` runs a git command in the checkout and gives its
// output; `read` gives a file of the tested copy, or null; `newFiles` are the new files that git
// does not track.
export function testsOfPr(at: {
  base: string;
  newFiles: readonly string[];
  git: (args: string[]) => string;
  read: (path: string) => string | null;
}): { tests: Map<string, TestCall[]>; problems: string[] } {
  const tests = new Map<string, TestCall[]>();
  const problems: string[] = [];
  const unread = (path: string) =>
    `${path}: the runner cannot read this test file in its copy. Make it a file that a program can read. If it is one, report this as a defect of the runner`;
  const whole = (path: string) => {
    const text = at.read(path);
    if (text === null) problems.push(unread(path));
    else tests.set(path, testCalls(text, path));
  };
  for (const { status, path } of fileList(at.git(fileListArgs(at.base)))) {
    if (!TEST_NAME.test(path) || status === "D") continue;
    if (status === "A") whole(path);
    else if (status === "M") {
      const now = at.read(path);
      const before = now === null ? null : oldText(at, path);
      if (now === null) problems.push(unread(path));
      else if (before === null) {
        problems.push(
          `${path}: the runner cannot read the old text of this test file (git cat-file blob ${at.base}:${path}). Report this as a defect of the runner`,
        );
      } else tests.set(path, changedTests({ before, now, path }));
    } else if (status === "T") {
      problems.push(
        `${path}: git gives the status "T": the file changed its type (a file became a link, or a link became a file). Keep the type that the file has in the base, or give the changed file a new name`,
      );
    } else {
      problems.push(
        `${path}: git gives the status "${status}", which the runner does not know. Report this as a defect of the runner`,
      );
    }
  }
  for (const path of at.newFiles) if (TEST_NAME.test(path)) whole(path);
  return { tests, problems };
}

// The text of a file at `base`, as git stores it, or null.
function oldText(
  at: { base: string; git: (args: string[]) => string },
  path: string,
): string | null {
  try {
    return at.git(["cat-file", "blob", `${at.base}:${path}`]);
  } catch {
    return null;
  }
}

// Text for one cell of a Markdown table: `\` first, then `|`, so that no text closes the cell.
export function cell(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

// Each test that the PR adds or changes and that no claim and no exemption names
// (testing.md §5: the list has every test of the PR). `changed` holds the tests of the PR, by
// file (`testsOfPr`); `read` gives a file of the tested copy, or null. An `exempt` entry has
// only a name: it stands for each test of its file with that name as written.
export function coverageProblems(at: {
  list: BreakList;
  changed: ReadonlyMap<string, readonly TestCall[]>;
  read: (path: string) => string | null;
}): string[] {
  const { list, changed } = at;
  const problems: string[] = [];
  // The text of each test file of the copy, read one time.
  const texts = new Map<string, string>();
  const text = (file: string) => {
    const known = texts.get(file) ?? at.read(file) ?? "";
    texts.set(file, known);
    return known;
  };
  for (const [file, calls] of changed) {
    for (const call of calls) {
      const exempt = list.exempt.some((entry) => entry.file === file && entry.name === call.name);
      if (exempt) continue;
      const at = `${file}:${String(call.start)}`;
      // A claim names a test by the name of the test report. The text of an expression is no
      // such name, also when another test has that text as its name.
      if (call.nameKind === "expression") {
        problems.push(
          `${at}: the test with the name \`${call.name}\` (an expression, not a string) has no exemption: a claim cannot name it`,
        );
        continue;
      }
      // A claim stands for one test: the test with its name that has its assertion. The name
      // alone does not say which test a claim runs: two tests can have one name, and the `%s`
      // of an `it.each` name matches the name of another test.
      const claimed = list.claims.some((claim) => {
        if (claim.test.file !== file || !nameMatches(call.name, claim.test.name)) return false;
        const place = placeOf({ text: text(file), snippet: claim.assertion });
        if (typeof place === "string") return false;
        const owner = ownerOf(testCalls(text(file), file), place);
        return owner?.start === call.start && owner.startColumn === call.startColumn;
      });
      if (!claimed) problems.push(`${at}: the test "${call.name}" has no claim`);
    }
  }
  for (const entry of list.exempt) {
    if (!(changed.get(entry.file) ?? []).some((call) => call.name === entry.name)) {
      problems.push(
        `${entry.file}: the exemption "${entry.name}" names no test that the PR adds or changes`,
      );
    }
  }
  return problems;
}

// The place of `snippet` in `text`: its line (from 1) and its column (from 0), or a problem when
// it is not there exactly once.
function placeOf(at: { text: string; snippet: string }): { line: number; column: number } | string {
  const line = lineOf(at.text, at.snippet);
  if (typeof line === "string") return line;
  const first = at.text.indexOf(at.snippet);
  return { line, column: first - (at.text.lastIndexOf("\n", first - 1) + 1) };
}

// Whether a place is inside a test call, by line and column: two calls can be on one line.
function holds(call: TestCall, place: { line: number; column: number }): boolean {
  const after =
    call.start < place.line || (call.start === place.line && call.startColumn <= place.column);
  const before =
    place.line < call.end || (place.line === call.end && place.column < call.endColumn);
  return after && before;
}

// The test call that has a place: the innermost call around it. `calls` are in the order of
// `testCalls`, where a call comes before the calls inside it.
function ownerOf(
  calls: readonly TestCall[],
  place: { line: number; column: number },
): TestCall | undefined {
  return calls.filter((call) => holds(call, place)).at(-1);
}

// The 1-based line of `snippet` in `text`, or a problem when it is not there exactly once.
export function lineOf(text: string, snippet: string): number | string {
  const first = text.indexOf(snippet);
  if (first === -1) return "not found";
  if (text.indexOf(snippet, first + 1) !== -1) return "found more than once";
  return text.slice(0, first).split("\n").length;
}

// The text of an edited file, or a problem when an edit does not match exactly once.
export function applyEdits(text: string, edits: readonly { find: string; replace: string }[]) {
  let out = text;
  for (const { find, replace } of edits) {
    const where = lineOf(out, find);
    if (typeof where === "string") return { problem: `edit ${where}: ${find.slice(0, 60)}` };
    out = out.replace(find, () => replace);
  }
  return { text: out };
}

// Every missing link of the list. `read` gives a file of the tested copy, or null.
export function linkProblems(
  list: Pick<BreakList, "claims">,
  read: (path: string) => string | null,
): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const seen = (id: string) => {
    if (ids.has(id)) problems.push(`${id}: the id is used twice`);
    ids.add(id);
  };
  for (const claim of list.claims) {
    seen(claim.id);
    if (claim.breaks.length === 0) problems.push(`${claim.id}: no break`);
    const test = read(claim.test.file);
    if (test === null) problems.push(`${claim.id}: no test file ${claim.test.file}`);
    else {
      // The run with no break also checks the name: a name with no result fails there.
      const place = placeOf({ text: test, snippet: claim.assertion });
      if (typeof place === "string") problems.push(`${claim.id}: the assertion is ${place}`);
      else {
        const owner = ownerOf(testCalls(test, claim.test.file), place);
        const inside = owner?.nameKind === "text" && nameMatches(owner.name, claim.test.name);
        if (!inside) problems.push(`${claim.id}: the assertion is not inside the named test`);
      }
    }
    for (const step of claim.breaks) {
      seen(step.id);
      if (isTestFile(step.file)) {
        problems.push(`${step.id}: a break changes the code, not a test or a test helper`);
      }
      const code = read(step.file);
      if (code === null) problems.push(`${step.id}: no file ${step.file}`);
      else {
        const edited = applyEdits(code, step.edits);
        if ("problem" in edited) problems.push(`${step.id}: ${edited.problem}`);
      }
    }
  }
  return problems;
}

// Each problem that stops a run before its first test. With `--only`, the list runs in part,
// so it cannot be complete: the check for a missing test does not run.
export function listProblems(at: {
  list: BreakList;
  only: string;
  pr: { tests: ReadonlyMap<string, readonly TestCall[]>; problems: readonly string[] };
  read: (path: string) => string | null;
}): string[] {
  const picked = claimsFor(at.list, at.only);
  return [
    ...picked.problems,
    ...at.pr.problems,
    ...linkProblems({ claims: picked.claims }, at.read),
    ...(at.only === ""
      ? coverageProblems({ list: at.list, changed: at.pr.tests, read: at.read })
      : []),
  ];
}

// One test result, reduced to what the verdict needs. `frames` are the `file:line` places of the
// failure, innermost first; `timedOut` is a timeout of the whole test, not of one assertion.
export interface TestOutcome {
  status: "passed" | "failed" | "skipped";
  timedOut: boolean;
  frames: { file: string; line: number }[];
  message: string;
}

export type Verdict =
  | { kind: "caught"; at: string; message: string }
  | { kind: "survived" }
  | { kind: "invalid"; reason: string };

// The claims that `--only` picks: each claim whose id, or the id of one of its breaks, has the
// text. An empty text picks each claim.
export function claimsFor(list: BreakList, only: string): { claims: Claim[]; problems: string[] } {
  const claims = list.claims.filter(
    (claim) => claim.id.includes(only) || claim.breaks.some((step) => step.id.includes(only)),
  );
  // A text that picks nothing runs nothing, and a run of nothing has no problem (DQ-175).
  const problems =
    claims.length === 0 && only !== ""
      ? [`--only ${JSON.stringify(only)} matches no claim id and no break id of the list`]
      : [];
  return { claims, problems };
}

// The result of one break run, as the report shows it. Not escaped: `reportRow` does it.
export function verdictText(v: Verdict): string {
  return v.kind === "caught"
    ? `caught at \`${v.at}\`: ${v.message}`
    : v.kind === "survived"
      ? "SURVIVED"
      : `INVALID: ${v.reason.slice(0, 300)}`;
}

// One row of the report table. The ids and the result are escaped here, one time (DQ-178,
// DQ-179). The command is not: the reviewer runs it as the report shows it, and an escape
// inside the backticks shows as it is. So a pipe in a command still closes its cell.
export function reportRow(row: { claim: string; run: string; command: string; result: string }) {
  return `| ${cell(row.claim)} | ${cell(row.run)} | \`${row.command}\` | ${cell(row.result)} |`;
}

// The verdict of one break run. Only a failure of the named test at the assertion line counts:
// no result (a load or server failure), a test timeout, or a failure at another line does not.
export function verdict(
  outcomes: readonly TestOutcome[],
  assertion: { file: string; line: number },
): Verdict {
  if (outcomes.length === 0) return { kind: "invalid", reason: "no result for the test" };
  if (outcomes.length > 1) return { kind: "invalid", reason: "more than one test has the name" };
  const [outcome] = outcomes;
  if (outcome === undefined) return { kind: "invalid", reason: "no result for the test" };
  if (outcome.timedOut) return { kind: "invalid", reason: "the test timed out" };
  if (outcome.status === "skipped") return { kind: "invalid", reason: "the test was skipped" };
  if (outcome.status === "passed") return { kind: "survived" };
  // The innermost place outside the libraries must be the assertion. When the broken code
  // throws, its own file comes first, and the failure is not a failed assertion.
  const frame = outcome.frames.find((place) => !place.file.includes("/node_modules/"));
  if (frame === undefined || !frame.file.endsWith(assertion.file)) {
    const where = frame === undefined ? "no place" : frame.file;
    return {
      kind: "invalid",
      reason: `the failure comes from ${where}, not from the test: ${outcome.message}`,
    };
  }
  if (frame.line !== assertion.line) {
    return {
      kind: "invalid",
      reason: `failed at line ${String(frame.line)}, not at the assertion (line ${String(assertion.line)}): ${outcome.message}`,
    };
  }
  return {
    kind: "caught",
    at: `${assertion.file}:${String(frame.line)}`,
    message: outcome.message,
  };
}

// The `file:line` places in a stack text, innermost first.
export function framesOf(stack: string): { file: string; line: number }[] {
  // Only the `at …` lines: the error text above them can hold a path too (a parse error's code
  // frame, or a message that quotes a place).
  return stack
    .split("\n")
    .filter((row) => /^\s*at /.test(row))
    .flatMap((row) => [...row.matchAll(/((?:\/|[A-Za-z]:\\)[^\s():]+):(\d+):\d+/g)].slice(-1))
    .map((match) => ({ file: match[1] ?? "", line: Number(match[2]) }));
}

// Terminal colour codes, which a test runner puts in its messages.
const COLOUR = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
export const plain = (text: string) => text.replace(COLOUR, "");

const VitestReport = z.object({
  testResults: z.array(
    z.object({
      assertionResults: z.array(
        z.object({
          title: z.string(),
          status: z.string(),
          failureMessages: z.array(z.string()).nullish(),
        }),
      ),
    }),
  ),
});

// The outcomes of the tests named `name` in a Vitest JSON report.
export function vitestOutcomes(report: unknown, name: string): TestOutcome[] {
  const parsed = VitestReport.safeParse(report);
  if (!parsed.success) return [];
  return parsed.data.testResults
    .flatMap((file) => file.assertionResults)
    .filter((test) => test.title === name)
    .map((test) => {
      const message = plain((test.failureMessages ?? []).join("\n"));
      return {
        status:
          test.status === "passed" ? "passed" : test.status === "failed" ? "failed" : "skipped",
        timedOut: /Test timed out in \d+ms/.test(message),
        frames: framesOf(message),
        message: message.split("\n")[0] ?? "",
      };
    });
}

const PlaywrightResult = z.object({
  status: z.string(),
  errors: z
    .array(
      z.object({
        message: z.string().optional(),
        location: z.object({ file: z.string(), line: z.number() }).optional(),
      }),
    )
    .optional(),
});
interface PlaywrightSuite {
  specs?: { title: string; tests: { results: z.infer<typeof PlaywrightResult>[] }[] }[] | undefined;
  suites?: PlaywrightSuite[] | undefined;
}
const PlaywrightSuite: z.ZodType<PlaywrightSuite> = z.lazy(() =>
  z.object({
    specs: z
      .array(
        z.object({
          title: z.string(),
          tests: z.array(z.object({ results: z.array(PlaywrightResult) })),
        }),
      )
      .optional(),
    suites: z.array(PlaywrightSuite).optional(),
  }),
);
const PlaywrightReport = z.object({ suites: z.array(PlaywrightSuite) });

// The outcomes of the tests named `name` in a Playwright JSON report. A test-level timeout has
// the status `timedOut`; an assertion that waits and fails (`expect.poll`) is a plain failure.
export function playwrightOutcomes(report: unknown, name: string): TestOutcome[] {
  const parsed = PlaywrightReport.safeParse(report);
  if (!parsed.success) return [];
  const outcomes: TestOutcome[] = [];
  const walk = (suite: PlaywrightSuite) => {
    for (const spec of suite.specs ?? []) {
      if (spec.title !== name) continue;
      for (const test of spec.tests) {
        const result = test.results.at(-1);
        if (result === undefined) continue;
        const errors = result.errors ?? [];
        outcomes.push({
          status:
            result.status === "passed"
              ? "passed"
              : result.status === "skipped"
                ? "skipped"
                : "failed",
          timedOut: result.status === "timedOut",
          frames: errors.flatMap((error) => (error.location === undefined ? [] : [error.location])),
          message: plain(errors[0]?.message ?? "").split("\n")[0] ?? "",
        });
      }
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const suite of parsed.data.suites) walk(suite);
  return outcomes;
}
