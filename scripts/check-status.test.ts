import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkStatus, doneRows, mergedPrs } from "./lib/check-status.ts";
import { readHistory } from "./lib/check-status-git.ts";

const LINK = "https://github.com/binhle312/cty1ng/pull";
const SINCE = "2026-10-30";

// One line of `git log --first-parent --format=%H%x09%cI%x09%s`.
function logLine(sha: string, line: { date: string; subject: string }): string {
  const { date, subject } = line;
  return `${sha}\t${date}T10:00:00+07:00\t${subject}`;
}

function merge(pr: number, date: string): string {
  return logLine(sha(pr), { date, subject: `Merge pull request #${pr} from owner/branch-${pr}` });
}

function sha(pr: number): string {
  return String(pr).padStart(40, "a");
}

function status(doneLines: string[]): string {
  return [
    "# Status",
    "",
    "## Slices",
    "",
    "## Done",
    "",
    "Each row has a date.",
    "",
    "| Date | What |",
    "| --- | --- |",
    ...doneLines,
    "",
  ].join("\n");
}

function row(date: string, ...prs: number[]): string {
  return `| ${date} | ${prs.map((pr) => `[#${pr}](${LINK}/${pr})`).join(", ")} merged. |`;
}

describe("mergedPrs", () => {
  it("reads a merge commit subject as a merged PR", () => {
    expect(mergedPrs(merge(7, "2026-11-01")), "merge commit").toEqual([
      { pr: 7, date: "2026-11-01", sha: sha(7) },
    ]);
  });

  it("reads a squash merge subject as a merged PR", () => {
    const log = logLine("b".repeat(40), {
      date: "2026-10-29",
      subject: "Add the ERDs by domain (#9)",
    });
    expect(mergedPrs(log), "squash merge").toEqual([
      { pr: 9, date: "2026-10-29", sha: "b".repeat(40) },
    ]);
  });

  it("skips a commit that is not a PR merge", () => {
    const log = [
      logLine("c".repeat(40), { date: "2026-10-21", subject: "Initial commit" }),
      logLine("d".repeat(40), { date: "2026-11-02", subject: "Merge branch 'main' into x" }),
      logLine("e".repeat(40), { date: "2026-11-02", subject: "Fix #12 in the list" }),
    ].join("\n");
    expect(mergedPrs(log), "other commits").toEqual([]);
  });
});

describe("doneRows", () => {
  it("counts each link of a Done row with several links", () => {
    const md = status([row("2026-11-01", 7), row("2026-11-02", 8, 10)]);
    expect(doneRows(md).prs, "links of the Done rows").toEqual(new Set([7, 8, 10]));
  });

  it("does not count a link in a section after the Done table", () => {
    const md = `${status([])}\n## Notes\n\n| 2026-11-01 | [#7](${LINK}/7) merged. |\n`;
    expect(doneRows(md).prs, "links after Done").toEqual(new Set());
  });

  it("reports a broken Done row", () => {
    const md = status([`| [#7](${LINK}/7) merged. |`]);
    expect(doneRows(md).problems, "problems of a broken row").toEqual([
      `docs/status.md Done row is not "| YYYY-MM-DD | … |": | [#7](${LINK}/7) merged. |`,
    ]);
  });

  it("counts no link of a broken Done row", () => {
    const md = status([`| 18 Nov | [#7](${LINK}/7) merged. |`]);
    expect(doneRows(md).prs, "links of a broken row").toEqual(new Set());
  });

  it("reports a status file with no Done section", () => {
    expect(doneRows("# Status\n\n## Slices\n").problems, "no Done section").toEqual([
      "docs/status.md has no ## Done section",
    ]);
  });
});

describe("checkStatus", () => {
  it("quotes the measures in the case table", () => {
    const cases: [input: string, measures: string[]][] = [
      ["89,987 bytes", ["89,987 bytes"]],
      ["80,000-byte", ["80,000-byte"]],
      ["1 byte", ["1 byte"]],
      ["3 Bytes", ["3 Bytes"]],
      ["90 KB", ["90 KB"]],
      ["78 rows", ["78 rows"]],
      ["12 row", ["12 row"]],
      ["1 token", ["1 token"]],
      ["120,000 tokens", ["120,000 tokens"]],
      ["1.5 tokens", ["1.5 tokens"]],
      ["1 row and 2 tokens", ["1 row", "2 tokens"]],
      ["3 bytes", ["3 bytes"]],
      ["_12 rows_", ["12 rows"]],
      ["__80,000-byte__", ["80,000-byte"]],
      ["*12 rows*", ["12 rows"]],
      [".5 KB", [".5 KB"]],
      ["78 rows 90 KB", ["78 rows", "90 KB"]],
      ["78 rows, 90 KB", ["78 rows", "90 KB"]],
      ["78 rows,90 KB", ["78 rows", "90 KB"]],
      ["78 rows;90 KB", ["78 rows", "90 KB"]],
      ["[78 rows][90 KB]", ["78 rows", "90 KB"]],
      ["#151", []],
      ["2026-11-24", []],
      ["DQ-570", []],
      ["§7 step 6", []],
      ["Q1 A", []],
      ["PR 5", []],
      ["M2b", []],
      ["fa19669", []],
      ["15 words", []],
      ["1 MB", []],
      ["48-line", []],
      ["rowspan", []],
      ["5 rowers", []],
      ["1,50 rows", []],
      ["v1.5 KB", []],
      ["5 row2", []],
    ];
    for (const [input, measures] of cases) {
      const problems = checkStatus({ merged: [], statusMd: `${status([])}${input}`, since: SINCE });
      const quotedMeasures = problems.map((problem) => problem.match(/"([^"]+)"/)?.[1]);
      expect.soft(quotedMeasures, input).toEqual(measures);
    }
  });

  it("rejects a typed byte count", () => {
    const inputs = [
      "89,987 bytes; 80,000-byte; 1 byte; 3 Bytes; 90 KB",
      "__80,000-byte__",
      ".5 KB",
    ];
    const problems = inputs.map((input) =>
      checkStatus({ merged: [], statusMd: `${status([])}${input}`, since: SINCE }),
    );
    expect(problems, "byte measures").toEqual([
      [
        expect.stringContaining('"89,987 bytes"'),
        expect.stringContaining('"80,000-byte"'),
        expect.stringContaining('"1 byte"'),
        expect.stringContaining('"3 Bytes"'),
        expect.stringContaining('"90 KB"'),
      ],
      [expect.stringContaining('"80,000-byte"')],
      [expect.stringContaining('".5 KB"')],
    ]);
  });

  it("rejects a typed row or token count", () => {
    const inputs = [
      "78 rows; 12 row; 1 token; 120,000 tokens; 1.5 tokens",
      "_12 rows_",
      "*12 rows*",
    ];
    const problems = inputs.map((input) =>
      checkStatus({ merged: [], statusMd: `${status([])}${input}`, since: SINCE }),
    );
    expect(problems, "row and token measures").toEqual([
      [
        expect.stringContaining('"78 rows"'),
        expect.stringContaining('"12 row"'),
        expect.stringContaining('"1 token"'),
        expect.stringContaining('"120,000 tokens"'),
        expect.stringContaining('"1.5 tokens"'),
      ],
      [expect.stringContaining('"12 rows"')],
      [expect.stringContaining('"12 rows"')],
    ]);
  });

  it("names the line number and the measure", () => {
    const statusMd = "# Status\n\n## Follow-ups\n1 row and 2 tokens\n\n## Done\n\n3 bytes";
    const problems = checkStatus({ merged: [], statusMd, since: SINCE });
    const fix =
      "link to the record or the rule that owns the value (One home for each fact, `docs/workflows/pull-request.md`)";
    expect(problems, "measure locations and fix").toEqual([
      `docs/status.md:4: typed measure "1 row". ${fix}`,
      `docs/status.md:4: typed measure "2 tokens". ${fix}`,
      `docs/status.md:8: typed measure "3 bytes". ${fix}`,
    ]);
  });

  it("permits numbers that are not measures", () => {
    const statusMd =
      `${status([])}#151, 2026-11-24, DQ-570, §7 step 6, Q1 A, PR 5, M2b, fa19669, ` +
      "15 words, 1 MB, 48-line, rowspan, 5 rowers. Control: 12 rows.";
    const problems = checkStatus({ merged: [], statusMd, since: SINCE });
    expect(problems, "only the control is a measure").toEqual([
      expect.stringContaining('"12 rows"'),
    ]);
  });

  it("gives the row to add for a merged PR with no Done row", () => {
    const merged = mergedPrs(merge(125, "2026-11-18"));
    expect(checkStatus({ merged, statusMd: status([]), since: SINCE }), "missing row").toEqual([
      `#125 (merged 2026-11-18, aaaaaaa) has no Done row in docs/status.md. Add: | 2026-11-18 | [#125](${LINK}/125) merged. |`,
    ]);
  });

  it("passes when the merged PR has a link in a Done row", () => {
    const merged = mergedPrs(merge(125, "2026-11-18"));
    const md = status([row("2026-11-18", 125)]);
    expect(checkStatus({ merged, statusMd: md, since: SINCE }), "row present").toEqual([]);
  });

  it("ignores a PR merged before the start date", () => {
    const merged = mergedPrs(merge(44, "2026-10-29"));
    expect(checkStatus({ merged, statusMd: status([]), since: SINCE }), "before start").toEqual([]);
  });

  it("counts a PR merged on the start date", () => {
    const merged = mergedPrs(merge(45, "2026-10-30"));
    const problems = checkStatus({ merged, statusMd: status([]), since: SINCE });
    const prs = problems.map((p) => p.split(" ")[0]);
    expect(prs, "on the start date").toEqual(["#45"]);
  });

  it("fails with the problem of a broken Done row", () => {
    const md = status([row("2026-11-18", 125), "| 18 Nov | x |"]);
    const merged = mergedPrs(merge(125, "2026-11-18"));
    expect(checkStatus({ merged, statusMd: md, since: SINCE }), "broken row").toEqual([
      'docs/status.md Done row is not "| YYYY-MM-DD | … |": | 18 Nov | x |',
    ]);
  });

  it("does not read the changed files of a merged PR", () => {
    let reads = 0;
    const input = {
      merged: mergedPrs(merge(140, "2026-11-20")),
      statusMd: status([]),
      since: SINCE,
      changedFiles: (): string[] => {
        reads += 1;
        return ["notes/state.md"];
      },
    };
    const problems = checkStatus(input);
    expect(problems.map((problem) => problem.split(" ")[0])).toEqual(["#140"]);
    expect(reads, "reads of the changed files").toBe(0);
  });
});

describe("readHistory", () => {
  let repo: string;
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: "t",
    GIT_AUTHOR_EMAIL: "t@example.invalid",
    GIT_COMMITTER_NAME: "t",
    GIT_COMMITTER_EMAIL: "t@example.invalid",
  };
  const git = (...args: string[]): string =>
    execFileSync("git", args, { cwd: repo, env, encoding: "utf8" });

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), "check-status-"));
    git("init", "-q", "-b", "main");
    git("commit", "-q", "--allow-empty", "-m", "Initial commit");
    // #1: a branch merged into main.
    git("checkout", "-q", "-b", "one");
    git("commit", "-q", "--allow-empty", "-m", "one");
    git("checkout", "-q", "main");
    git("merge", "-q", "--no-ff", "one", "-m", "Merge pull request #1 from owner/one");
    // #2 merges into the branch of #3, not into main; then #3 merges into main.
    git("checkout", "-q", "-b", "three");
    git("checkout", "-q", "-b", "two");
    git("commit", "-q", "--allow-empty", "-m", "two");
    git("checkout", "-q", "three");
    git("merge", "-q", "--no-ff", "two", "-m", "Merge pull request #2 from owner/two");
    git("checkout", "-q", "main");
    git("merge", "-q", "--no-ff", "three", "-m", "Merge pull request #3 from owner/three");
    // #4: the merge that a push to main checks; CI reads HEAD^1, the history before it.
    git("checkout", "-q", "-b", "four");
    git("commit", "-q", "--allow-empty", "-m", "four");
    git("checkout", "-q", "main");
    git("merge", "-q", "--no-ff", "four", "-m", "Merge pull request #4 from owner/four");
  });
  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it("does not list a PR merged into another PR's branch", () => {
    const history = readHistory(repo, "HEAD");
    const prs = mergedPrs(history.log).map((m) => m.pr);
    expect(prs, "PRs on the first-parent line").toEqual([4, 3, 1]);
  });

  it("does not list the merge of HEAD when it reads HEAD^1", () => {
    const history = readHistory(repo, "HEAD^1");
    const prs = mergedPrs(history.log).map((m) => m.pr);
    expect(prs, "PRs before the merge of HEAD").toEqual([3, 1]);
  });

  it("reports a shallow clone", () => {
    const shallow = mkdtempSync(join(tmpdir(), "check-status-shallow-"));
    try {
      execFileSync("git", ["clone", "-q", "--depth", "1", `file://${repo}`, shallow], { env });
      expect(readHistory(shallow, "HEAD").problems, "shallow clone").toEqual([
        "the clone is shallow, so merges can be missing: fetch the whole history (fetch-depth: 0)",
      ]);
    } finally {
      rmSync(shallow, { recursive: true, force: true });
    }
  });
});
