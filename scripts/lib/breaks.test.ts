import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyEdits,
  cell,
  type BreakList,
  changedLines,
  claimsFor,
  coverageProblems,
  diffArgs,
  diffEnv,
  framesOf,
  isTestFile,
  firstTscError,
  lineOf,
  linkProblems,
  listsFile,
  nameMatches,
  newErrorLines,
  projectsOf,
  playwrightOutcomes,
  reportRow,
  testCalls,
  tscProblem,
  verdict,
  verdictText,
  vitestOutcomes,
} from "./breaks.ts";

const TEST = "app/a.test.ts";
const CODE = "app/a.ts";
const files: Record<string, string> = {
  [TEST]: 'it("adds", () => {\n  const x = add(1, 2);\n  expect(x).toBe(3);\n});\n',
  [CODE]: "export const add = (a, b) => a + b;\n",
};
const read = (path: string) => files[path] ?? null;
const AT = { file: TEST, line: 3 };

function list(more: Partial<BreakList["claims"][number]> = {}): BreakList {
  return {
    claims: [
      {
        id: "C1",
        claim: "add adds",
        test: { kind: "vitest", file: TEST, name: "adds" },
        assertion: "expect(x).toBe(3);",
        breaks: [{ id: "C1-a", file: CODE, edits: [{ find: "a + b", replace: "a - b" }] }],
        ...more,
      },
    ],
    exempt: [],
  };
}

describe("lineOf and applyEdits", () => {
  it("finds a text that occurs once, and refuses one that is missing or repeated", () => {
    expect(lineOf(files[TEST] ?? "", "expect(x)")).toBe(3);
    expect(lineOf("a\nb", "c")).toBe("not found");
    expect(lineOf("a a", "a")).toBe("found more than once");
  });

  it("applies each edit once, and names an edit that does not match", () => {
    expect(applyEdits("a + b", [{ find: "+", replace: "-" }])).toEqual({ text: "a - b" });
    expect(applyEdits("a + b", [{ find: "*", replace: "-" }])).toEqual({
      problem: "edit not found: *",
    });
  });
});

describe("linkProblems", () => {
  it("accepts a list where each claim links a test, an assertion and a break", () => {
    expect(linkProblems(list(), read)).toEqual([]);
  });

  it("refuses each missing link", () => {
    expect(linkProblems(list({ breaks: [] }), read)).toEqual(["C1: no break"]);
    expect(linkProblems(list({ assertion: "toBe(4)" }), read)).toEqual([
      "C1: the assertion is not found",
    ]);
    expect(
      linkProblems(list({ test: { kind: "vitest", file: "x.test.ts", name: "adds" } }), read),
    ).toEqual(["C1: no test file x.test.ts"]);
    expect(
      linkProblems(
        list({ breaks: [{ id: "C1-a", file: CODE, edits: [{ find: "a * b", replace: "" }] }] }),
        read,
      ),
    ).toEqual(["C1-a: edit not found: a * b"]);
  });

  it("refuses a break of the test itself and an id used twice", () => {
    expect(
      linkProblems(
        list({
          breaks: [{ id: "C1", file: TEST, edits: [{ find: "toBe(3)", replace: "toBe(4)" }] }],
        }),
        read,
      ),
    ).toEqual([
      "C1: the id is used twice",
      "C1: a break changes the code, not a test or a test helper",
    ]);
  });

  it("refuses a break of a test helper, and an assertion outside the named test", () => {
    const helper = "backend/test/helpers.ts";
    const withHelper = (path: string) => (path === helper ? "export const x = 1;\n" : read(path));
    expect(
      linkProblems(
        list({ breaks: [{ id: "C1-a", file: helper, edits: [{ find: "1", replace: "2" }] }] }),
        withHelper,
      ),
    ).toEqual(["C1-a: a break changes the code, not a test or a test helper"]);
    expect(
      linkProblems(list({ test: { kind: "vitest", file: TEST, name: "other" } }), read),
    ).toEqual(["C1: the assertion is not inside the named test"]);
  });
});

describe("verdict", () => {
  const failed = (line: number, file = `/tmp/copy/${TEST}`) => ({
    status: "failed" as const,
    timedOut: false,
    frames: [
      { file: "/tmp/copy/node_modules/x.js", line: 9 },
      { file, line },
    ],
    message: "AssertionError: expected 4 to be 3",
  });

  it("counts only a failure of the named test at the assertion line", () => {
    expect(verdict([failed(3)], AT)).toEqual({
      kind: "caught",
      at: `${TEST}:3`,
      message: "AssertionError: expected 4 to be 3",
    });
  });

  it("calls a pass a survivor", () => {
    expect(verdict([{ status: "passed", timedOut: false, frames: [], message: "" }], AT)).toEqual({
      kind: "survived",
    });
  });

  it("does not count an error that the broken code throws on the assertion line", () => {
    const thrown = {
      ...failed(3),
      frames: [
        { file: "/tmp/copy/app/a.ts", line: 1 },
        { file: `/tmp/copy/${TEST}`, line: 3 },
      ],
    };
    expect(verdict([thrown], AT)).toMatchObject({ kind: "invalid" });
  });

  it("does not count a failure at another line, outside the test file, or a timeout", () => {
    expect(verdict([failed(2)], AT)).toMatchObject({ kind: "invalid" });
    expect(verdict([failed(3, "/tmp/copy/app/other.ts")], AT)).toMatchObject({
      kind: "invalid",
    });
    expect(verdict([{ ...failed(3), timedOut: true }], AT)).toEqual({
      kind: "invalid",
      reason: "the test timed out",
    });
  });

  it("does not count a run with no result (a load or server failure), or two tests", () => {
    expect(verdict([], AT)).toEqual({ kind: "invalid", reason: "no result for the test" });
    expect(verdict([failed(3), failed(3)], AT)).toMatchObject({ kind: "invalid" });
  });
});

describe("the reports", () => {
  it("reads the stack places of a Vitest failure, innermost first", () => {
    expect(
      framesOf("Error: x\n    at f (/tmp/c/app/a.ts:4:7)\n    at /tmp/c/app/a.test.ts:3:13"),
    ).toEqual([
      { file: "/tmp/c/app/a.ts", line: 4 },
      { file: "/tmp/c/app/a.test.ts", line: 3 },
    ]);
  });

  it("reads places only from the stack lines, not from the error text above them", () => {
    expect(
      framesOf(
        "Error: parse at /tmp/c/app/a.tsx:238:70\n 238 | x\n    at /tmp/c/app/a.test.ts:5:3",
      ),
    ).toEqual([{ file: "/tmp/c/app/a.test.ts", line: 5 }]);
  });

  it("removes the colour codes from a failure message", () => {
    const escape = String.fromCharCode(27);
    const report = {
      testResults: [
        {
          assertionResults: [
            {
              title: "t",
              status: "failed",
              failureMessages: [
                `${escape}[31mAssertionError${escape}[39m: x\n    at /a.test.ts:1:1`,
              ],
            },
          ],
        },
      ],
    };
    expect(vitestOutcomes(report, "t")[0]?.message).toBe("AssertionError: x");
  });

  it("reads the named test from a Vitest JSON report, with a test timeout", () => {
    const report = {
      testResults: [
        {
          assertionResults: [
            {
              title: "adds",
              status: "failed",
              failureMessages: ["Error: Test timed out in 20000ms."],
            },
            { title: "other", status: "passed", failureMessages: [] },
          ],
        },
      ],
    };
    expect(vitestOutcomes(report, "adds")).toEqual([
      {
        status: "failed",
        timedOut: true,
        frames: [],
        message: "Error: Test timed out in 20000ms.",
      },
    ]);
    expect(vitestOutcomes({ testResults: [] }, "adds")).toEqual([]);
  });

  it("reads the named test from nested Playwright suites, and tells a test timeout from a failed wait", () => {
    const spec = (status: string) => ({
      title: "scrolls",
      tests: [
        {
          results: [
            {
              status,
              errors: [
                { message: "Error: expect(received)", location: { file: "/c/e.spec.ts", line: 7 } },
              ],
            },
          ],
        },
      ],
    });
    const report = (status: string) => ({ suites: [{ suites: [{ specs: [spec(status)] }] }] });
    expect(playwrightOutcomes(report("failed"), "scrolls")).toEqual([
      {
        status: "failed",
        timedOut: false,
        frames: [{ file: "/c/e.spec.ts", line: 7 }],
        message: "Error: expect(received)",
      },
    ]);
    expect(playwrightOutcomes(report("timedOut"), "scrolls")[0]?.timedOut).toBe(true);
    expect(
      playwrightOutcomes({ suites: [], errors: [{ message: "webServer failed" }] }, "scrolls"),
    ).toEqual([]);
  });
});

describe("the tests of a PR", () => {
  const FILE = [
    'describe("group", () => {',
    '  it("one", () => {',
    "    expect(1).toBe(1);",
    "  });",
    '  it.each([["a"], ["b"]])("row %s", (row) => {',
    "    expect(row).toBeTruthy();",
    "  });",
    '  test.skip("later", () => {});',
    "});",
    "",
  ].join("\n");

  it("finds each test call with its lines, and no describe", () => {
    expect(testCalls(FILE, "x.test.ts")).toEqual([
      { name: "one", start: 2, end: 4 },
      { name: "row %s", start: 5, end: 7 },
      { name: "later", start: 8, end: 8 },
    ]);
  });

  it("matches a reported name to the name as written", () => {
    expect(nameMatches("row %s", "row a")).toBe(true);
    expect(nameMatches("row %s", "a row a")).toBe(false);
    expect(nameMatches("one (x)", "one (x)")).toBe(true);
  });

  it("reads the changed lines of a diff, also of a hunk that only removes lines", () => {
    const diff = [
      "diff --git a/x.test.ts b/x.test.ts",
      "--- a/x.test.ts",
      "+++ b/x.test.ts",
      "@@ -3 +3,2 @@",
      "@@ -9,2 +10,0 @@",
    ].join("\n");
    expect(changedLines(diff)).toEqual(new Map([["x.test.ts", new Set([3, 4, 10])]]));
  });

  it("adds no lines of a deleted file to the file before it", () => {
    const diff = [
      "diff --git a/x.test.ts b/x.test.ts",
      "--- a/x.test.ts",
      "+++ b/x.test.ts",
      "@@ -3 +3 @@",
      "-old",
      "+new",
      "diff --git a/y.test.ts b/y.test.ts",
      "deleted file mode 100644",
      "--- a/y.test.ts",
      "+++ /dev/null",
      "@@ -1,4 +0,0 @@",
      "-1",
      "-2",
      "-3",
      "-4",
    ].join("\n");
    expect(changedLines(diff)).toEqual(new Map([["x.test.ts", new Set([3])]]));
  });

  it("finds the errors that name the broken file and that the run with no break did not log", () => {
    const file = "frontend/src/a.tsx";
    const before = "stderr | a.test.tsx > t\nWarning: old at /c/frontend/src/a.tsx:3:1\n";
    const after = [
      "stderr | a.test.tsx > t",
      "Warning: old at /c/frontend/src/a.tsx:3:1",
      "Error: boom",
      "    at View (/c/frontend/src/a.tsx:9:5)",
      'Error: Failed to resolve import "./x.css" from "frontend/src/a.tsx".',
      "    at /c/frontend/src/a.test.tsx:4:2",
    ].join("\n");
    expect(newErrorLines({ before, after, file })).toEqual([
      "    at View (/c/frontend/src/a.tsx:9:5)",
      'Error: Failed to resolve import "./x.css" from "frontend/src/a.tsx".',
    ]);
  });

  it("names the TypeScript project that compiles a broken file", () => {
    const configs: Record<string, string> = {
      "backend/tsconfig.json": '{ "extends": "../tsconfig.base.json", "include": ["src"] }',
      "tsconfig.json": '{ "include": ["*.ts", "scripts/**/*.ts"] }',
    };
    const config = (path: string) => configs[path] ?? null;
    expect(projectsOf("backend/src/core/bots/bots.service.ts", config)).toEqual(["backend"]);
    expect(projectsOf("scripts/lib/breaks.ts", config)).toEqual(["."]);
  });

  it("names the configs that a package config points at, in place of that config", () => {
    // `tsc -p frontend` compiles no file of such a config, and it exits with 0.
    const text = [
      "{",
      "  // The browser code and the tests have their own config.",
      '  "files": [],',
      '  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.test.json" }],',
      "}",
    ].join("\n");
    const config = (path: string) => (path === "frontend/tsconfig.json" ? text : null);
    expect(projectsOf("frontend/src/features/bots/create-bot-page.tsx", config)).toEqual([
      "frontend/tsconfig.app.json",
      "frontend/tsconfig.test.json",
    ]);
  });

  // DQ-166: a break in `shared/` can break the compile of a package that uses it.
  it("names the projects of each package for a broken file of shared", () => {
    const configs: Record<string, string> = {
      "frontend/tsconfig.json":
        '{ "files": [], "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.test.json" }] }',
    };
    const config = (path: string) => configs[path] ?? null;
    expect(projectsOf("shared/src/ids.ts", config)).toEqual([
      "shared",
      "backend",
      "frontend/tsconfig.app.json",
      "frontend/tsconfig.test.json",
      ".",
    ]);
  });

  it("finds the broken file in the file list of tsc only at its full path", () => {
    const printed = "/c/node_modules/typescript/lib/lib.d.ts\n/c/frontend/src/a.tsx\n";
    expect(listsFile(printed, { root: "/c", file: "frontend/src/a.tsx" })).toBe(true);
    expect(listsFile(printed, { root: "/c", file: "src/a.tsx" })).toBe(false);
    expect(listsFile(printed, { root: "/c", file: "frontend/src/b.tsx" })).toBe(false);
  });

  it("takes the first error of tsc, not a listed file with the word error in its path", () => {
    const printed = [
      "/c/frontend/src/lib/error-text.ts",
      "frontend/src/a.ts(2,14): error TS2322: Type 'string' is not assignable to type 'number'.",
      "frontend/src/b.ts(1,1): error TS2304: Cannot find name 'x'.",
    ].join("\n");
    expect(firstTscError(printed)).toBe(
      "frontend/src/a.ts(2,14): error TS2322: Type 'string' is not assignable to type 'number'.",
    );
    expect(firstTscError("/c/frontend/src/lib/error-text.ts\n")).toBeNull();
  });

  it("tells a test or a test helper from the code", () => {
    expect(isTestFile("backend/test/helpers.ts")).toBe(true);
    expect(isTestFile("frontend/src/a.test.tsx")).toBe(true);
    expect(isTestFile("frontend/test/e2e/bots.spec.ts")).toBe(true);
    expect(isTestFile("backend/src/core/bots/bots.service.ts")).toBe(false);
    expect(isTestFile("test/a.ts")).toBe(true);
    expect(isTestFile("backend/src/contest/a.ts")).toBe(false);
    expect(isTestFile("backend/src/a.test.ts.bak")).toBe(false);
  });

  it("keeps a backslash and a pipe of a message inside one table cell", () => {
    expect(cell("a|b")).toBe("a\\|b");
    expect(cell("a\\|b")).toBe("a\\\\\\|b");
    expect(cell("C:\\x")).toBe("C:\\\\x");
  });

  it("names each changed test that has no claim and no exemption", () => {
    const calls = testCalls(FILE, TEST);
    const changed = new Map([[TEST, calls]]);
    const claims = list({ test: { kind: "vitest", file: TEST, name: "row a" } }).claims;
    expect(
      coverageProblems(
        { claims, exempt: [{ file: TEST, name: "later", reason: "written first" }] },
        changed,
      ),
    ).toEqual([`${TEST}:2: the test "one" has no claim`]);
  });

  it("names an exemption that matches no test that the PR adds or changes", () => {
    const changed = new Map([[TEST, testCalls(FILE, TEST)]]);
    const claims = list({ test: { kind: "vitest", file: TEST, name: "row a" } }).claims;
    expect(
      coverageProblems(
        {
          claims,
          exempt: [
            { file: TEST, name: "one", reason: "a unit test" },
            { file: TEST, name: "later", reason: "a unit test" },
            { file: TEST, name: "no such test", reason: "a typo" },
          ],
        },
        changed,
      ),
    ).toEqual([`${TEST}: the exemption "no such test" names no test that the PR adds or changes`]);
  });
});

// DQ-161: the diff text depends on the git settings of the machine, and a file that the parser
// does not see needs no claim, so the list then looks complete.
describe("the diff of a PR", () => {
  const folders: string[] = [];
  afterEach(() => {
    for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
  });

  it("reads a changed line that looks like a file line as a line of its file", () => {
    const diff = [
      "diff --git a/x.test.ts b/x.test.ts",
      "index 1111111..2222222 100644",
      "--- a/x.test.ts",
      "+++ b/x.test.ts",
      "@@ -3,0 +4,2 @@",
      "+++ b/other.test.ts",
      "+++ /dev/null",
      "@@ -9 +11 @@",
      "--- a/third.test.ts",
      "+++ b/third.test.ts",
      "\\ No newline at end of file",
    ].join("\n");
    expect(changedLines(diff)).toEqual(new Map([["x.test.ts", new Set([4, 5, 11])]]));
  });

  it.each([
    ['+++ "b/a\\tb.test.ts"', "a quoted path"],
    ["+++ w/x.test.ts", "the prefix of diff.mnemonicPrefix"],
    ["+++ x.test.ts", "no prefix (diff.noprefix)"],
    [`${String.fromCharCode(27)}[1m+++ b/x.test.ts${String.fromCharCode(27)}[m`, "a colour code"],
  ])("refuses the file line %j (%s)", (line) => {
    const diff = ["diff --git a/x.test.ts b/x.test.ts", "--- a/x.test.ts", line, "@@ -3 +3 @@"];
    expect(() => changedLines(diff.join("\n"))).toThrow(/cannot read this line of the diff/);
  });

  // git puts a tab after a file name that has a space.
  it("reads a file name with a space", () => {
    const diff = [
      "diff --git a/a b.test.ts b/a b.test.ts",
      "--- a/a b.test.ts\t",
      "+++ b/a b.test.ts\t",
      "@@ -1 +1 @@",
      "-old",
      "+new",
    ].join("\n");
    expect(changedLines(diff)).toEqual(new Map([["a b.test.ts", new Set([1])]]));
  });

  // A copy has no hunk, so its file would have no changed line. The fixed options find no copy.
  it("refuses a file that the diff shows as a copy", () => {
    const diff = [
      "diff --git a/a.test.ts b/copied.test.ts",
      "similarity index 100%",
      "copy from a.test.ts",
      "copy to copied.test.ts",
    ].join("\n");
    expect(() => changedLines(diff)).toThrow(/cannot read this line of the diff/);
  });

  it("reads the same changed lines with git settings that change the diff text", () => {
    const folder = mkdtempSync(join(tmpdir(), "breaks-diff-"));
    folders.push(folder);
    const git = (args: string[], env: NodeJS.ProcessEnv = process.env) =>
      execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", ...args], {
        cwd: folder,
        encoding: "utf8",
        env,
      });
    git(["init", "--quiet"]);
    git(["config", "commit.gpgsign", "false"]);
    const lines = (from: number, to: number) =>
      Array.from({ length: to - from + 1 }, (_, i) => `line ${String(from + i)}\n`).join("");
    writeFileSync(join(folder, "a.test.ts"), lines(1, 12));
    writeFileSync(join(folder, "é.test.ts"), "1\n");
    writeFileSync(join(folder, "b c.test.ts"), "1\n");
    // A text filter that adds a line: with it, each line number of the diff is one too high.
    writeFileSync(join(folder, ".gitattributes"), "*.test.ts diff=more\n");
    git(["add", "."]);
    git(["commit", "--quiet", "-m", "first"]);
    // Two changes with 4 lines between them: one hunk if the diff joins hunks 5 lines apart.
    writeFileSync(
      join(folder, "a.test.ts"),
      `${lines(1, 1)}two\n${lines(3, 6)}seven\n${lines(8, 12)}`,
    );
    writeFileSync(join(folder, "é.test.ts"), "1\n2\n");
    writeFileSync(join(folder, "b c.test.ts"), "1\n2\n");
    // The same text as the old `a.test.ts`, which this diff changes: a copy for `diff.renames`.
    writeFileSync(join(folder, "copied.test.ts"), lines(1, 12));
    git(["add", "."]);
    for (const [key, value] of [
      ["diff.noprefix", "true"],
      ["diff.mnemonicPrefix", "true"],
      ["color.diff", "always"],
      ["color.ui", "always"],
      ["core.quotePath", "true"],
      ["diff.renames", "copies"],
      ["diff.interHunkContext", "5"],
      ["diff.external", "true"],
      ["diff.more.textconv", "sh -c 'echo more; cat \"$0\"'"],
    ] as const) {
      git(["config", key, value]);
    }
    const env = { ...process.env, GIT_DIFF_OPTS: "--unified=3", GIT_EXTERNAL_DIFF: "true" };
    expect(changedLines(git(diffArgs("HEAD"), diffEnv(env)))).toEqual(
      new Map([
        ["a.test.ts", new Set([2, 7])],
        ["b c.test.ts", new Set([2])],
        ["copied.test.ts", new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])],
        ["é.test.ts", new Set([2])],
      ]),
    );
  });
});

// DQ-175: a wrong id must not look like a run with no problem.
describe("--only", () => {
  it("names a text that matches no claim and no break", () => {
    expect(claimsFor(list(), "C2")).toEqual({
      claims: [],
      problems: ['--only "C2" matches no claim id and no break id of the list'],
    });
  });

  it("picks a claim by its id, or by the id of one of its breaks", () => {
    expect(claimsFor(list(), "").claims.map((claim) => claim.id)).toEqual(["C1"]);
    expect(claimsFor(list(), "C1")).toMatchObject({ claims: [{ id: "C1" }], problems: [] });
    expect(claimsFor(list(), "1-a")).toMatchObject({ claims: [{ id: "C1" }], problems: [] });
  });
});

describe("a row of the report", () => {
  // DQ-178: the compile error was escaped two times.
  it("escapes a pipe of a compile error one time", () => {
    const reason = `the break does not compile: ${tscProblem("a.ts(1,1): error TS2322: Type 'a | b' is wrong.")}`;
    const result = verdictText({ kind: "invalid", reason });
    expect(reportRow({ claim: "C1", run: "C1-a", command: "not run", result })).toBe(
      "| C1 | C1-a | `not run` | INVALID: the break does not compile: a.ts(1,1): error TS2322: Type 'a \\| b' is wrong. |",
    );
  });

  // DQ-179: a pipe in an id closed the cell.
  it("escapes a pipe in the claim id and the break id", () => {
    const row = reportRow({ claim: "C|1", run: "C|1-a", command: "vitest", result: "passed" });
    expect(row).toBe("| C\\|1 | C\\|1-a | `vitest` | passed |");
  });

  // The reviewer runs the command from the report, so its text must be the text that ran. An
  // escape inside the backticks shows as it is: a second backslash would change a test name.
  it("keeps the command as it ran", () => {
    const command = 'vitest run x.test.ts -t "refuses \\(a\\)"';
    const row = reportRow({ claim: "C1", run: "C1-a", command, result: "passed" });
    expect(row).toBe(`| C1 | C1-a | \`${command}\` | passed |`);
  });
});
