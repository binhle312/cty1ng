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

// A test call in a test file: its name as written (with `%s` for `it.each`) and its lines.
export interface TestCall {
  name: string;
  start: number;
  end: number;
}

const TEST_FUNCTIONS = new Set(["it", "test"]);
const MODIFIERS = new Set(["only", "skip", "concurrent", "fails", "fixme", "slow", "each"]);

// The test calls of a Vitest or Playwright file: `it(...)`, `test(...)`, `it.each(rows)(...)`
// and the modifiers such as `test.skip(...)`. A `describe` is not a test.
export function testCalls(text: string, path: string): TestCall[] {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const line = (position: number) => source.getLineAndCharacterOfPosition(position).line + 1;
  const isTestFunction = (node: ts.Expression): boolean => {
    if (ts.isIdentifier(node)) return TEST_FUNCTIONS.has(node.text);
    if (ts.isPropertyAccessExpression(node))
      return MODIFIERS.has(node.name.text) && isTestFunction(node.expression);
    if (ts.isCallExpression(node)) return isTestFunction(node.expression);
    return false;
  };
  const calls: TestCall[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && isTestFunction(node.expression)) {
      const [first] = node.arguments;
      if (first !== undefined && ts.isStringLiteralLike(first)) {
        calls.push({
          name: first.text,
          start: line(node.getStart(source)),
          end: line(node.getEnd()),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return calls;
}

// Whether a test name as the report gives it comes from a name as written: `it.each` fills
// `%s`, `%d` and the like.
export function nameMatches(written: string, reported: string): boolean {
  const parts = written.split(/%[sdifjo#%]/);
  const pattern = parts.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".+");
  return new RegExp(`^${pattern}$`).test(reported);
}

// The arguments of the `git diff` whose text `changedLines` reads. Each option is fixed against a
// git setting that changes the text (DQ-161): the prefixes, colours, an external diff tool, a
// text filter, quoted names, copies, lines around a hunk, and the form of a submodule line.
export function diffArgs(base: string): string[] {
  return [
    "-c",
    "core.quotePath=false",
    "diff",
    "--unified=0",
    "--inter-hunk-context=0",
    "--no-color",
    "--no-ext-diff",
    "--no-textconv",
    // Renames as git finds them with no setting, and no copies: a copy has no hunk.
    "--find-renames",
    "--diff-algorithm=myers",
    "--submodule=short",
    "--src-prefix=a/",
    "--dst-prefix=b/",
    base,
  ];
}

// The environment of that `git diff`: `GIT_DIFF_OPTS` wins over `--unified=0`.
export function diffEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const rest = { ...env };
  Reflect.deleteProperty(rest, "GIT_DIFF_OPTS");
  return rest;
}

// The lines that git prints for one file before its first hunk.
const FILE_HEAD =
  /^(?:diff --git |index |--- |old mode |new mode |new file mode |deleted file mode |similarity index |dissimilarity index |rename from |rename to |Binary files |GIT binary patch$)/;

// The changed lines of each file in a `git diff --unified=0` text, on the new side. A hunk that
// only removes lines marks the line where they were. A hunk says how many lines follow it, so a
// changed line that starts with `+++` or `---` is not read as a file line. A line that is no
// known line of a diff stops the read with an error: a file that this function does not see needs
// no claim, and the list would look complete (DQ-161). One known gap: a file that git shows as
// binary (`Binary files … differ`) has no hunk, so it gets no changed line and no error.
export function changedLines(diff: string): Map<string, Set<number>> {
  const files = new Map<string, Set<number>>();
  let current: Set<number> | undefined;
  // The lines of the hunk that are still to come.
  let body = 0;
  for (const row of diff.split("\n")) {
    if (body > 0 && (row.startsWith("+") || row.startsWith("-"))) {
      body -= 1;
      continue;
    }
    if (row.startsWith("\\") || row === "") continue;
    body = 0;
    const hunk = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(row);
    if (hunk !== null) {
      const removed = hunk[1] === undefined ? 1 : Number(hunk[1]);
      const start = Number(hunk[2]);
      const count = hunk[3] === undefined ? 1 : Number(hunk[3]);
      body = removed + count;
      if (current === undefined) continue;
      if (count === 0) current.add(Math.max(start, 1));
      for (let at = start; at < start + count; at += 1) current.add(at);
      continue;
    }
    if (row === "+++ /dev/null") {
      current = undefined;
      continue;
    }
    // git puts a tab after a name that has a space.
    const file = /^\+\+\+ b\/(.+?)\t?$/.exec(row);
    if (file?.[1] !== undefined) {
      current = new Set();
      files.set(file[1], current);
      continue;
    }
    if (FILE_HEAD.test(row)) continue;
    throw new Error(`cannot read this line of the diff: ${JSON.stringify(row)}`);
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

// The tests of the PR, by file: each test of a new file, and the tests on the changed lines of a
// changed file. `git` runs a git command in the checkout and gives its output; `read` gives a
// file of the tested copy, or null. `problems` are the reasons to stop the run.
export function testsOfPr(at: {
  base: string;
  newFiles: readonly string[];
  git: (args: string[]) => string;
  read: (path: string) => string | null;
}): { tests: Map<string, TestCall[]>; problems: string[] } {
  const changed = changedLines(at.git(diffArgs(at.base)));
  const tests = new Map<string, TestCall[]>();
  for (const file of [...changed.keys(), ...at.newFiles].filter((path) => TEST_NAME.test(path))) {
    const text = at.read(file);
    if (text === null) continue;
    const lines = changed.get(file);
    const calls = testCalls(text, file).filter(
      (call) => lines === undefined || [...lines].some((n) => call.start <= n && n <= call.end),
    );
    tests.set(file, calls);
  }
  return { tests, problems: [] };
}

// Text for one cell of a Markdown table: `\` first, then `|`, so that no text closes the cell.
export function cell(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

// Each test that the PR adds or changes and that no claim and no exemption names
// (testing.md §5: the list has every test of the PR). `changed` holds the test calls whose
// lines the PR touched, by file.
export function coverageProblems(
  list: BreakList,
  changed: ReadonlyMap<string, readonly TestCall[]>,
): string[] {
  const problems: string[] = [];
  for (const [file, calls] of changed) {
    for (const call of calls) {
      const claimed = list.claims.some(
        (claim) => claim.test.file === file && nameMatches(call.name, claim.test.name),
      );
      const exempt = list.exempt.some((entry) => entry.file === file && entry.name === call.name);
      if (!claimed && !exempt) {
        problems.push(`${file}:${String(call.start)}: the test "${call.name}" has no claim`);
      }
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
      const line = lineOf(test, claim.assertion);
      if (typeof line === "string") problems.push(`${claim.id}: the assertion is ${line}`);
      else {
        const inside = testCalls(test, claim.test.file).some(
          (call) =>
            nameMatches(call.name, claim.test.name) && call.start <= line && line <= call.end,
        );
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
    ...(at.only === "" ? coverageProblems(at.list, at.pr.tests) : []),
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
