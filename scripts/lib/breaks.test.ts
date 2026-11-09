import { describe, expect, it } from "vitest";
import {
  applyEdits,
  type BreakList,
  changedLines,
  coverageProblems,
  framesOf,
  isTestFile,
  lineOf,
  linkProblems,
  nameMatches,
  playwrightOutcomes,
  testCalls,
  verdict,
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
      "+++ b/x.test.ts",
      "@@ -3 +3 @@",
      "--- a/y.test.ts",
      "+++ /dev/null",
      "@@ -1,4 +0,0 @@",
    ].join("\n");
    expect(changedLines(diff)).toEqual(new Map([["x.test.ts", new Set([3])]]));
  });

  it("tells a test or a test helper from the code", () => {
    expect(isTestFile("backend/test/helpers.ts")).toBe(true);
    expect(isTestFile("frontend/src/a.test.tsx")).toBe(true);
    expect(isTestFile("frontend/test/e2e/bots.spec.ts")).toBe(true);
    expect(isTestFile("backend/src/core/bots/bots.service.ts")).toBe(false);
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
