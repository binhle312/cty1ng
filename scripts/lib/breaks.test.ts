import { chmodSync, mkdirSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type GitFolder, gitFolder, removeFolders } from "./breaks-git-folder.ts";
import {
  applyEdits,
  cell,
  BreakList,
  claimsFor,
  coverageProblems,
  framesOf,
  isTestFile,
  firstTscError,
  lineOf,
  linkProblems,
  listProblems,
  listsFile,
  nameMatches,
  newErrorLines,
  projectsOf,
  playwrightOutcomes,
  reportRow,
  testCalls,
  testsOfPr,
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

// The tests of a PR, from a git folder (DQ-161). The runner asks git which files changed, and it
// compares the tests of the old text and the new text of each changed test file.
afterEach(removeFolders);

// The tests that the runner counts, by file, and the problems that stop the run.
function prOf(folder: GitFolder, at: { base?: string; cwd?: string } = {}) {
  const pr = testsOfPr({
    base: at.base ?? "HEAD",
    newFiles: folder.newFiles(),
    git: (args) => folder.git(args, at.cwd),
    read: folder.read,
  });
  const names: Record<string, string[]> = {};
  for (const [file, calls] of pr.tests) {
    if (calls.length > 0) names[file] = calls.map((call) => call.name);
  }
  return { names, problems: pr.problems, tests: pr.tests };
}

const S = "s.test.ts";
const BASE = `import { helper } from "./helper";

const setup = () => 1;

describe("group", () => {
  beforeEach(() => {
    setup();
  });

  it("one", () => {
    expect(1).toBe(1);
  });

  it("two", () => {
    const value = 2;
    expect(value).toBe(2);
  });

  it("three", () => {
    expect(3).toBe(3);
  });

  it.each([1, 2])("row %s", (n) => {
    expect(n).toBe(n);
  });
});

describe.skip("parked", () => {
  it("four", () => {
    expect(4).toBe(4);
  });
});

describe("second", () => {
  it("one", () => {
    expect(11).toBe(11);
  });
});
`;
const ONE = `  it("one", () => {\n    expect(1).toBe(1);\n  });\n`;
const TWO = `  it("two", () => {\n    const value = 2;\n    expect(value).toBe(2);\n  });\n\n`;
const THREE = `  it("three", () => {\n    expect(3).toBe(3);\n  });\n\n`;
const FOUR = `  it("four", () => {\n    expect(4).toBe(4);\n  });\n`;
const SECOND = BASE.slice(BASE.indexOf('describe("second"'));

// The text of `BASE` with one part replaced. The part must be there one time.
function edited(at: { from: string; to: string; text?: string }): string {
  const { from, to, text = BASE } = at;
  if (text.split(from).length !== 2) throw new Error(`not one time in the text: ${from}`);
  return text.replace(from, () => to);
}

// A git folder with one committed test file.
function committed(text = BASE, file = S): GitFolder {
  const folder = gitFolder();
  folder.write(file, text);
  folder.commit();
  return folder;
}

// The names of the tests that count when the committed text `BASE` becomes `now`.
function counted(now: string): string[] {
  const folder = committed();
  folder.write(S, now);
  const pr = prOf(folder);
  expect(pr.problems).toEqual([]);
  return pr.names[S] ?? [];
}

describe("which tests count", () => {
  it("counts a test with a changed line", () => {
    expect(counted(edited({ from: "const value = 2;", to: "const value = 3;" }))).toEqual(["two"]);
  });

  it("counts a test that loses a line", () => {
    const now = edited({
      from: "    const value = 2;\n    expect(value).toBe(2);",
      to: "    expect(2).toBe(2);",
    });
    expect(counted(now)).toEqual(["two"]);
  });

  it("counts a new test", () => {
    const five = `  it("five", () => {\n    expect(5).toBe(5);\n  });\n\n`;
    expect(counted(edited({ from: THREE, to: `${THREE}${five}` }))).toEqual(["five"]);
  });

  it("counts a test of it.each that gets a new row", () => {
    expect(counted(edited({ from: "it.each([1, 2])", to: "it.each([1, 2, 3])" }))).toEqual([
      "row %s",
    ]);
  });

  it("counts a test that becomes it.skip", () => {
    expect(counted(edited({ from: 'it("three"', to: 'it.skip("three"' }))).toEqual(["three"]);
  });

  it("counts a test that gets more spaces before each line", () => {
    const more = `    it("one", () => {\n      expect(1).toBe(1);\n    });\n`;
    expect(counted(edited({ from: ONE, to: more }))).toEqual(["one"]);
  });

  it("counts no test when a test moves inside its group with the same text", () => {
    const now = edited({
      from: `${ONE}\n`,
      to: `${THREE}${ONE}\n`,
      text: edited({ from: THREE, to: "" }),
    });
    expect(counted(now)).toEqual([]);
  });

  it("counts a test that moves out of describe.skip into a group that runs", () => {
    const now = edited({ from: ONE, to: `${FOUR}\n${ONE}`, text: edited({ from: FOUR, to: "" }) });
    expect(counted(now)).toEqual(["four"]);
  });

  it("counts a test that moves into describe.skip", () => {
    const now = edited({
      from: FOUR,
      to: `${FOUR}\n${THREE.trimEnd()}\n`,
      text: edited({ from: THREE, to: "" }),
    });
    expect(counted(now)).toEqual(["three"]);
  });

  it("counts a test that moves from one group into another", () => {
    const head = 'describe("second", () => {\n';
    const now = edited({
      from: head,
      to: `${head}${THREE}`,
      text: edited({ from: THREE, to: "" }),
    });
    expect(counted(now)).toEqual(["three"]);
  });

  it("counts each test of a group when describe.skip becomes describe", () => {
    expect(counted(edited({ from: 'describe.skip("parked"', to: 'describe("parked"' }))).toEqual([
      "four",
    ]);
  });

  it("counts each test of a group that gets a new name", () => {
    const now = edited({ from: 'describe("group"', to: 'describe("group, new name"' });
    expect(counted(now)).toEqual(["one", "two", "three", "row %s"]);
  });

  it("counts each test of a group when a new describe comes around it, with more spaces", () => {
    const inner = SECOND.trimEnd()
      .split("\n")
      .map((row) => `  ${row}`)
      .join("\n");
    const now = edited({ from: SECOND, to: `describe("outer", () => {\n${inner}\n});\n` });
    expect(counted(now)).toEqual(["one"]);
  });

  it("counts each test of a group when a new describe comes around it, with the same spaces", () => {
    const now = edited({
      from: SECOND,
      to: `describe("outer", () => {\n${SECOND.trimEnd()}\n});\n`,
    });
    expect(counted(now)).toEqual(["one"]);
  });

  it("counts only the second of two tests with one name when it changes", () => {
    const folder = committed();
    folder.write(S, edited({ from: "expect(11).toBe(11);", to: "expect(12).toBe(12);" }));
    const line = BASE.slice(0, BASE.indexOf("expect(11)")).split("\n").length - 1;
    expect(prOf(folder).tests.get(S)).toEqual([{ name: "one", start: line, end: line + 2 }]);
  });

  it("gives each old test to one new test only", () => {
    // A second test with the same name, group and text comes: one of the two is new.
    expect(counted(edited({ from: THREE, to: `${THREE}${THREE}` }))).toEqual(["three"]);
  });

  it("counts no test when a test goes", () => {
    expect(counted(edited({ from: TWO, to: "" }))).toEqual([]);
  });

  it("counts no test when a helper or a beforeEach body changes", () => {
    const now = edited({ from: "    setup();", to: "    setup();\n    setup();" });
    expect(
      counted(edited({ from: "const setup = () => 1;", to: "const setup = () => 2;", text: now })),
    ).toEqual([]);
  });

  it("counts no test when a line changes and changes back", () => {
    const folder = committed();
    folder.write(S, edited({ from: "const value = 2;", to: "const value = 3;" }));
    folder.commit();
    // A local change gives the file the text of the base again.
    folder.write(S, BASE);
    expect(prOf(folder, { base: "HEAD~1" })).toMatchObject({ names: {}, problems: [] });
  });

  it("reads a describe group of Playwright", () => {
    const parked = (group: string) =>
      [
        `${group}("parked", () => {`,
        '  test("four", async () => {',
        "    expect(4).toBe(4);",
        "  });",
        '  test("five", async () => {',
        "    expect(5).toBe(5);",
        "  });",
        "});",
        "",
      ].join("\n");
    const folder = committed(parked("test.describe.skip"), "e.spec.ts");
    folder.write("e.spec.ts", parked("test.describe"));
    expect(prOf(folder).names).toEqual({ "e.spec.ts": ["four", "five"] });
  });

  // DQ-257: git shows such a file as binary, and a patch of it has no hunk.
  it("counts a changed test of a file with the attribute -diff", () => {
    const folder = committed();
    folder.write(".gitattributes", `${S} -diff\n`);
    folder.write(S, edited({ from: "const value = 2;", to: "const value = 3;" }));
    expect(prOf(folder)).toMatchObject({ names: { [S]: ["two"] }, problems: [] });
  });

  it("counts a changed test of a file with a quote in its name", () => {
    const file = 'q"s.test.ts';
    const folder = committed(BASE, file);
    folder.write(file, edited({ from: "const value = 2;", to: "const value = 3;" }));
    expect(prOf(folder)).toMatchObject({ names: { [file]: ["two"] }, problems: [] });
  });

  it("counts no test when only the mode of the file changes", () => {
    const folder = committed();
    chmodSync(join(folder.path, S), 0o755);
    expect(prOf(folder)).toMatchObject({ names: {}, problems: [] });
  });

  it("counts no test when only the time of the file changes (diff.autoRefreshIndex=false)", () => {
    const folder = committed();
    folder.git(["config", "diff.autoRefreshIndex", "false"]);
    const later = new Date(Date.now() + 9000);
    utimesSync(join(folder.path, S), later, later);
    expect(prOf(folder)).toMatchObject({ names: {}, problems: [] });
  });

  it("counts a changed test of a file with line ends of Windows on disk (core.autocrlf=true)", () => {
    const folder = committed();
    folder.git(["config", "core.autocrlf", "true"]);
    folder.write(
      S,
      edited({ from: "const value = 2;", to: "const value = 3;" }).replace(/\n/g, "\r\n"),
    );
    expect(prOf(folder)).toMatchObject({ names: { [S]: ["two"] }, problems: [] });
  });

  const PAIR =
    'it("a", () => {\n  expect(1).toBe(1);\n});\nit("b", () => {\n  expect(2).toBe(2);\n});\n';

  it.each(["staged", "not staged"])(
    "counts each test of the new files when a test file becomes a folder (%s)",
    (state) => {
      const folder = committed(BASE, "a.test.ts");
      rmSync(join(folder.path, "a.test.ts"));
      folder.write("a.test.ts/in.test.ts", PAIR);
      if (state === "staged") folder.git(["add", "-A"]);
      expect(prOf(folder)).toMatchObject({
        names: { "a.test.ts/in.test.ts": ["a", "b"] },
        problems: [],
      });
    },
  );

  it.each(["staged", "not staged"])(
    "counts each test of the new file when a folder becomes a test file (%s)",
    (state) => {
      const folder = committed(BASE, "d.test.ts/in.test.ts");
      rmSync(join(folder.path, "d.test.ts"), { recursive: true });
      folder.write("d.test.ts", PAIR);
      if (state === "staged") folder.git(["add", "-A"]);
      expect(prOf(folder)).toMatchObject({ names: { "d.test.ts": ["a", "b"] }, problems: [] });
    },
  );

  it("counts each test of the new target when a link gets a new target", () => {
    const folder = gitFolder();
    folder.write("first.ts", 'it("old", () => {\n  expect(0).toBe(0);\n});\n');
    folder.write("next.ts", PAIR);
    symlinkSync("first.ts", join(folder.path, "l.test.ts"));
    folder.commit();
    rmSync(join(folder.path, "l.test.ts"));
    symlinkSync("next.ts", join(folder.path, "l.test.ts"));
    expect(prOf(folder)).toMatchObject({ names: { "l.test.ts": ["a", "b"] }, problems: [] });
  });

  // git gives no status `U` for this state: it compares a commit with the files on disk.
  it("counts the test with the marks of a conflict in a merge that is not complete", () => {
    const folder = committed();
    folder.git(["checkout", "--quiet", "-b", "side"]);
    folder.write(S, edited({ from: "const value = 2;", to: "const value = 4;" }));
    folder.commit();
    folder.git(["checkout", "--quiet", "-"]);
    folder.write(S, edited({ from: "const value = 2;", to: "const value = 3;" }));
    folder.commit();
    expect(folder.fails(["merge", "side"])).toBe(true);
    expect(folder.read(S)).toContain("<<<<<<<");
    expect(prOf(folder)).toMatchObject({ names: { [S]: ["two"] }, problems: [] });
  });
});

// DQ-262: with rename detection, a renamed file counted only its changed lines.
describe("a renamed file", () => {
  const CASES = [
    'it("a", () => {',
    "  expect(1).toBe(1);",
    "});",
    'it("b", () => {',
    "  expect(2).toBe(2);",
    "});",
    'it("c", () => {',
    "  const x = 3;",
    "  const y = 3;",
    "  const z = 3;",
    "  expect(x + y + z).toBe(9);",
    "});",
    "",
  ].join("\n");

  it("counts each test when cases.ts becomes cases.test.ts with no changed line", () => {
    const folder = committed(CASES, "cases.ts");
    folder.git(["mv", "cases.ts", "cases.test.ts"]);
    expect(prOf(folder).names).toEqual({ "cases.test.ts": ["a", "b", "c"] });
  });

  it("counts each test when cases.ts becomes cases.test.ts with 3 changed lines", () => {
    const folder = committed(CASES, "cases.ts");
    folder.git(["mv", "cases.ts", "cases.test.ts"]);
    folder.write("cases.test.ts", CASES.replace(/= 3;/g, "= 4;").replace("toBe(9)", "toBe(12)"));
    expect(prOf(folder).names).toEqual({ "cases.test.ts": ["a", "b", "c"] });
  });

  it("counts each test when parked.test.ts.skip becomes parked.test.ts", () => {
    const folder = committed(CASES, "parked.test.ts.skip");
    folder.git(["mv", "parked.test.ts.skip", "parked.test.ts"]);
    expect(prOf(folder).names).toEqual({ "parked.test.ts": ["a", "b", "c"] });
  });
});

describe("the status of a test file", () => {
  const PAIR =
    'it("a", () => {\n  expect(1).toBe(1);\n});\nit("b", () => {\n  expect(2).toBe(2);\n});\n';

  it("counts each test of a new file", () => {
    const folder = committed();
    folder.write("n.test.ts", PAIR);
    folder.git(["add", "-A"]);
    expect(prOf(folder)).toMatchObject({ names: { "n.test.ts": ["a", "b"] }, problems: [] });
  });

  it("counts no test of a new empty file", () => {
    const folder = committed();
    folder.write("n.test.ts", "");
    folder.git(["add", "-A"]);
    expect(prOf(folder)).toMatchObject({ names: {}, problems: [] });
  });

  it("counts each test of a new file with the attribute -diff", () => {
    const folder = committed();
    folder.write(".gitattributes", "*.test.ts -diff\n");
    folder.commit();
    folder.write("n.test.ts", PAIR);
    folder.git(["add", "-A"]);
    expect(prOf(folder)).toMatchObject({ names: { "n.test.ts": ["a", "b"] }, problems: [] });
  });

  it.each(["a staged change", "a change that is not staged", "the two in one file"])(
    "counts a test with %s",
    (state) => {
      const folder = committed();
      if (state !== "a change that is not staged") {
        folder.write(S, edited({ from: "const value = 2;", to: "const value = 3;" }));
        folder.git(["add", "-A"]);
      }
      if (state !== "a staged change") {
        const staged = folder.read(S) ?? "";
        folder.write(
          S,
          edited({ from: "expect(3).toBe(3);", to: "expect(3).toBe(4 - 1);", text: staged }),
        );
      }
      const expected = { "a staged change": ["two"], "a change that is not staged": ["three"] }[
        state
      ] ?? ["two", "three"];
      expect(prOf(folder)).toMatchObject({ names: { [S]: expected }, problems: [] });
    },
  );

  it("counts no test of a deleted file, and does not stop", () => {
    const folder = committed();
    rmSync(join(folder.path, S));
    expect(prOf(folder)).toMatchObject({ names: {}, problems: [] });
  });

  it("counts each test of a new file that git does not track", () => {
    const folder = committed();
    folder.write("new/n.test.ts", PAIR);
    expect(prOf(folder)).toMatchObject({ names: { "new/n.test.ts": ["a", "b"] }, problems: [] });
  });

  it("applies no rule to a changed picture in a snapshots folder", () => {
    const picture = "frontend/test/e2e/shell.spec.ts-snapshots/a.png";
    const folder = gitFolder();
    folder.write(picture, Buffer.from([1, 0, 2, 0]));
    folder.commit();
    folder.write(picture, Buffer.from([9, 0, 8, 0]));
    expect(prOf(folder)).toMatchObject({ names: {}, problems: [] });
  });

  it("applies no rule to a status that it does not know, if the file is no test file", () => {
    const pr = testsOfPr({ base: "HEAD", newFiles: [], git: listOnly("X\0a.png\0"), read: none });
    expect([...pr.tests.values()].flat()).toEqual([]);
    expect(pr.problems).toEqual([]);
  });
});

// A `git` for a unit test: it answers only the command of the file list, with `list`.
const listOnly = (list: string) => (args: string[]) => {
  if (args.includes("--name-status")) return list;
  throw new Error(`the test has no answer for: git ${args.join(" ")}`);
};
const none = () => null;

describe("the stops", () => {
  const T =
    'git gives the status "T": the file changed its type (a file became a link, or a link became a file). Keep the type that the file has in the base, or give the changed file a new name';

  it("stops at a test file that became a link, and names the file and the action", () => {
    const folder = committed(BASE, "a.test.ts");
    folder.write("target.ts", BASE);
    folder.commit();
    rmSync(join(folder.path, "a.test.ts"));
    symlinkSync("target.ts", join(folder.path, "a.test.ts"));
    expect(prOf(folder).problems).toEqual([`a.test.ts: ${T}`]);
  });

  it("stops at a link that became a plain test file, with the same action", () => {
    const folder = gitFolder();
    folder.write("target.ts", BASE);
    symlinkSync("target.ts", join(folder.path, "a.test.ts"));
    folder.commit();
    rmSync(join(folder.path, "a.test.ts"));
    folder.write("a.test.ts", BASE);
    expect(prOf(folder).problems).toEqual([`a.test.ts: ${T}`]);
  });

  it("stops at a status that it does not know, and names the file", () => {
    const git = listOnly("X\0a.test.ts\0");
    expect(testsOfPr({ base: "HEAD", newFiles: [], git, read: none }).problems).toEqual([
      'a.test.ts: git gives the status "X", which the runner does not know. Report this as a defect of the runner',
    ]);
  });

  it("stops at a new test file that it cannot read", () => {
    const folder = committed();
    // A link to a file that is not there.
    symlinkSync("nowhere.ts", join(folder.path, "n.test.ts"));
    folder.git(["add", "-A"]);
    expect(prOf(folder).problems).toEqual([
      "n.test.ts: the runner cannot read this test file in its copy. Make it a file that a program can read. If it is one, report this as a defect of the runner",
    ]);
  });

  it("stops when it cannot read the old text of a changed test file", () => {
    const git = (args: string[]) => {
      if (args[0] === "cat-file") throw new Error("fatal: path 'a.test.ts' does not exist");
      return listOnly("M\0a.test.ts\0")(args);
    };
    expect(testsOfPr({ base: "abc", newFiles: [], git, read: () => BASE }).problems).toEqual([
      "a.test.ts: the runner cannot read the old text of this test file (git cat-file blob abc:a.test.ts). Report this as a defect of the runner",
    ]);
  });

  it.each([
    ["M\0a.test.ts", "no end mark"],
    ["R100\0a.test.ts\0b.test.ts\0", "a rename row with two names"],
  ])("refuses a file list that is no list of pairs (%j, %s)", (list) => {
    const git = listOnly(list);
    expect(() => testsOfPr({ base: "HEAD", newFiles: [], git, read: none })).toThrow(
      /cannot read the file list of git/,
    );
  });

  it("names a stop also with --only, and no missing test", () => {
    const tests = new Map([[TEST, [{ name: "other", start: 9, end: 9 }]]]);
    const pr = { tests, problems: ["a.test.ts: a stop"] };
    expect(listProblems({ list: list(), only: "C1", pr, read })).toEqual(["a.test.ts: a stop"]);
    expect(listProblems({ list: list(), only: "", pr, read })).toEqual([
      "a.test.ts: a stop",
      `${TEST}:9: the test "other" has no claim`,
    ]);
  });
});

// A git setting of the machine must not change which tests count.
describe("git settings", () => {
  const TRIO = (n: number) =>
    [
      `it("a${String(n)}", () => {`,
      "  expect(1).toBe(1);",
      "});",
      `it("b${String(n)}", () => {`,
      "  expect(2).toBe(2);",
      "});",
      `it("c${String(n)}", () => {`,
      "  const x = 3;",
      "  const y = 3;",
      "  expect(x + y).toBe(6);",
      "});",
      "",
    ].join("\n");

  function changes(): GitFolder {
    const folder = gitFolder();
    folder.write(".gitattributes", "*.test.ts diff=more\n");
    folder.write("old-1.test.ts", TRIO(1));
    folder.write("old-2.test.ts", TRIO(2));
    folder.write(S, BASE);
    folder.write("gone.test.ts", TRIO(4));
    folder.commit();
    folder.git(["mv", "old-1.test.ts", "new-1.test.ts"]);
    folder.write("new-1.test.ts", TRIO(1).replace("toBe(6)", "toBe(3 + 3)"));
    folder.git(["mv", "old-2.test.ts", "new-2.test.ts"]);
    folder.write(S, edited({ from: "const value = 2;", to: "const value = 3;" }));
    folder.write("né.test.ts", TRIO(3));
    rmSync(join(folder.path, "gone.test.ts"));
    folder.git(["add", "-A"]);
    return folder;
  }
  const EXPECTED = {
    "new-1.test.ts": ["a1", "b1", "c1"],
    "new-2.test.ts": ["a2", "b2", "c2"],
    "né.test.ts": ["a3", "b3", "c3"],
    [S]: ["two"],
  };

  it.each([
    ["no setting", []],
    ["diff.renames=copies", [["diff.renames", "copies"]]],
    ["diff.renames=false", [["diff.renames", "false"]]],
    ["diff.renameLimit=1", [["diff.renameLimit", "1"]]],
    ["diff.autoRefreshIndex=false", [["diff.autoRefreshIndex", "false"]]],
    ["diff.orderFile", [["diff.orderFile", "order.txt"]]],
    ["a text filter", [["diff.more.textconv", "sh -c 'echo more; cat \"$0\"'"]]],
    ["an external diff tool", [["diff.external", "true"]]],
    ["diff.noprefix=true", [["diff.noprefix", "true"]]],
    ["diff.mnemonicPrefix=true", [["diff.mnemonicPrefix", "true"]]],
    ["color.ui=always", [["color.ui", "always"]]],
    ["core.quotePath=true", [["core.quotePath", "true"]]],
    ["diff.relative=true", [["diff.relative", "true"]]],
  ] as const)("counts the same tests with %s", (name, settings) => {
    const folder = changes();
    for (const [key, value] of settings) folder.git(["config", key, value]);
    if (name === "diff.orderFile") {
      mkdirSync(join(folder.path, ".git", "info"), { recursive: true });
      writeFileSync(join(folder.path, "order.txt"), "s.test.ts\nnew-2.test.ts\n");
      folder.write(".git/info/exclude", "order.txt\n");
    }
    if (name === "an external diff tool") folder.env.GIT_EXTERNAL_DIFF = "true";
    expect(prOf(folder)).toEqual(expect.objectContaining({ names: EXPECTED, problems: [] }));
  });

  it("counts the files of the whole repository when git starts in a subfolder with diff.relative=true", () => {
    const folder = gitFolder();
    folder.write("root.test.ts", TRIO(1));
    folder.write("sub/in.test.ts", TRIO(2));
    folder.commit();
    folder.git(["config", "diff.relative", "true"]);
    folder.write("root.test.ts", TRIO(1).replace("toBe(1)", "toBe(2 - 1)"));
    folder.write("sub/in.test.ts", TRIO(2).replace("toBe(2)", "toBe(1 + 1)"));
    expect(prOf(folder, { cwd: "sub" })).toMatchObject({
      names: { "root.test.ts": ["a1"], "sub/in.test.ts": ["b2"] },
      problems: [],
    });
  });
});
