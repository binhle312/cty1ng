import { describe, expect, it } from "vitest";
import {
  applyEdits,
  type BreakList,
  framesOf,
  lineOf,
  linkProblems,
  playwrightOutcomes,
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
    ).toEqual(["C1: the id is used twice", "C1: a break changes the code, not its test"]);
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
    expect(verdict([failed(3)], AT)).toEqual({ kind: "caught", at: `${TEST}:3` });
  });

  it("calls a pass a survivor", () => {
    expect(verdict([{ status: "passed", timedOut: false, frames: [], message: "" }], AT)).toEqual({
      kind: "survived",
    });
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
