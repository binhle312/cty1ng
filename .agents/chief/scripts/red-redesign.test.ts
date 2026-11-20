// Red run of the option A redesign (order 130), on the code before the build. Each test asserts
// the safe result; a failing test is a red run. The build deletes this file: each case lives on in
// the new tests.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type CiCheck, type MergeInput, type PrFile, classify } from "./lib/merge-check.ts";
import { type Run, readPr } from "./lib/merge-check-gh.ts";
import { REQUIRED_CHECKS } from "./lib/merge-list.ts";

const HEAD = "1a2b3c4d5e6f708192a3b4c5d6e7f80912345678";
const GREEN: CiCheck[] = REQUIRED_CHECKS.map((name) => ({ name, state: "pass" }));
const RECORD = ['## Order 120\nExact text: "you may merge each docs PR"\n'];
const RULES = ".agents/chief/memories/long-term/rules/";

function input(files: PrFile[], extra: Partial<MergeInput> = {}): MergeInput {
  return {
    number: 152,
    head: HEAD,
    files,
    checks: GREEN,
    record: RECORD,
    privateWords: ["zz-private-zz"],
    minQuoteWords: 4,
    baseRef: "main",
    crossRepository: false,
    author: "owner-login",
    expectedAuthor: "owner-login",
    ...extra,
  };
}

const permissionRule = (rule: string, quote: string): string =>
  `---\nid: R-040\npermission-rule: true\n---\nRule: ${rule}\nOwner said: "${quote}" (2026-11-20)\nHow to apply:\n`;

const BASE_VIEW = {
  headRefOid: HEAD,
  baseRefOid: "b".repeat(40),
  baseRefName: "main",
  isCrossRepository: false,
  author: { login: "owner-login" },
  changedFiles: 1,
};
const checkRun = (name: string, status = "COMPLETED", conclusion: string | null = "SUCCESS") => ({
  __typename: "CheckRun",
  name,
  status,
  conclusion,
});
const content = (text: string): string =>
  JSON.stringify({ encoding: "base64", content: Buffer.from(text).toString("base64") });
const LESSONS = ".agents/chief/memories/long-term/lessons.md";

function run(views: string[]): Run {
  let n = 0;
  return (args) => {
    const line = args.join(" ");
    if (line.includes("pr view")) {
      const view = views[Math.min(n, views.length - 1)] ?? "";
      n += 1;
      return { status: 0, stdout: view };
    }
    if (line.includes("/files")) {
      return { status: 0, stdout: JSON.stringify({ filename: LESSONS, status: "modified" }) };
    }
    return { status: 0, stdout: content("# Lessons\n") };
  };
}

describe("Astra check of ed11f3b", () => {
  it("B1: a StatusContext with a job name does not stand in for the CI job", () => {
    const rollup = [
      ...REQUIRED_CHECKS.filter((name) => name !== "test").map((name) => checkRun(name)),
      { __typename: "StatusContext", context: "test", state: "SUCCESS" },
    ];
    const view = JSON.stringify({ ...BASE_VIEW, statusCheckRollup: rollup });
    const read = readPr(152, run([view]));
    if (!read.ok) throw new Error(read.reason);
    const result = classify(input(read.files, { checks: read.checks }));
    expect(result.exit, "status context as test").not.toBe(0);
  });

  it("B2: a permission rule moved out of rules/ with the same text needs the owner", () => {
    const text = permissionRule("Merge each docs PR after review.", "you may merge each docs PR");
    const moved: PrFile = {
      path: ".agents/chief/memories/long-term/old/R-040-docs-merges.md",
      previousPath: `${RULES}R-040-docs-merges.md`,
      status: "renamed",
      baseText: text,
      headText: text,
    };
    expect(classify(input([moved])).exit, "rule moved out").not.toBe(0);
  });

  it("B3: the second read decides the checks and the base branch", () => {
    const first = JSON.stringify({
      ...BASE_VIEW,
      statusCheckRollup: REQUIRED_CHECKS.map((name) => checkRun(name)),
    });
    const second = JSON.stringify({
      ...BASE_VIEW,
      baseRefName: "release",
      statusCheckRollup: REQUIRED_CHECKS.map((name) =>
        name === "test" ? checkRun(name, "IN_PROGRESS", null) : checkRun(name),
      ),
    });
    const read = readPr(152, run([first, second]));
    if (!read.ok) return;
    const result = classify(input(read.files, { checks: read.checks, baseRef: read.baseRef }));
    expect(result.exit, "stale first view").not.toBe(0);
  });

  it("B4: a package.json moved to another workspace folder is a dependency change", () => {
    const manifest = '{"name":"x","dependencies":{"left-pad":"1.3.0"}}';
    const moved: PrFile = {
      path: "tools/other/package.json",
      previousPath: "backend/package.json",
      status: "renamed",
      baseText: manifest,
      headText: manifest,
    };
    expect(classify(input([moved])).exit, "manifest moved").not.toBe(0);
  });

  it("B5: a reformatted old quote is not a new owner quote", () => {
    const base = permissionRule("Merge each docs PR after review.", "you may merge each docs PR");
    const head = permissionRule("Merge each PR.", "you may merge  each docs PR");
    const rule: PrFile = {
      path: `${RULES}R-040-docs-merges.md`,
      previousPath: undefined,
      status: "modified",
      baseText: base,
      headText: head,
    };
    expect(classify(input([rule])).exit, "reformatted quote").not.toBe(0);
  });

  it("Q3 B: a changed permission rule with a new owner quote needs the owner", () => {
    const base = permissionRule("Merge each docs PR after review.", "you may merge each docs PR");
    const head = permissionRule("Merge each docs PR.", "you may merge each docs PR now");
    const record = ['Exact text: "you may merge each docs PR" and "you may merge each docs PR now"'];
    const rule: PrFile = {
      path: `${RULES}R-040-docs-merges.md`,
      previousPath: undefined,
      status: "modified",
      baseText: base,
      headText: head,
    };
    expect(classify(input([rule], { record })).exit, "changed permission rule").not.toBe(0);
  });

  it("Q3 B: an added permission rule with a valid quote needs the owner", () => {
    const rule: PrFile = {
      path: `${RULES}R-040-docs-merges.md`,
      previousPath: undefined,
      status: "added",
      headText: permissionRule("Merge each docs PR.", "you may merge each docs PR"),
    };
    expect(classify(input([rule])).exit, "added permission rule").not.toBe(0);
  });

  it("R2-3: a memory PR that changes restore.md or audit.md needs the owner", () => {
    for (const name of ["restore.md", "audit.md"]) {
      const changed: PrFile = {
        path: `.agents/chief/memories/long-term/${name}`,
        previousPath: undefined,
        status: "modified",
        baseText: "# Old\n",
        headText: "# New\n",
      };
      expect(classify(input([changed])).exit, name).not.toBe(0);
    }
  });

  it("DQ-1026: the audit cron line names its tool set with --tools", () => {
    const text = readFileSync(".agents/chief/memories/long-term/restore.md", "utf8");
    const line = text.split("\n").find((row) => row.includes("claude -p")) ?? "";
    expect(line, "cron line").toContain('--tools "Read,Grep,Glob,Write"');
  });
});
