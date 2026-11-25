import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  type LedgerFile,
  ISSUE_FILES,
  checkCounts,
  formProblems,
  formatIds,
  patternProblem,
  searchLines,
  strayLedgerFiles,
  writeCounts,
} from "./lib/records-counts.ts";

const LINK = "https://github.com/binhle312/cty1ng/pull";
const MAIN = "docs/delivery-quality.md";
const ARCHIVE = "docs/delivery-quality-archive.md";
const REGISTER = "docs/delivery-quality-register.md";
const PREVENTION = "docs/delivery-quality-prevention.md";
const AUDIT = "Audit 2026-11-05";
const MARKER = "no lesson source; written by `pnpm records:counts`";

type Issue = {
  id: number;
  pr: number | "audit";
  state?: string;
  milestone?: string;
  escaped?: string;
};

function dq(id: number): string {
  return `DQ-${String(id).padStart(3, "0")}`;
}

// One CR line end, on the first line only: the checks must find a single CR.
function crOnFirstLine(text: string): string {
  const end = text.indexOf("\n");
  return `${text.slice(0, end)}\r${text.slice(end)}`;
}

function lineIn(ledger: { path: string; text: string }[], start: string): number {
  return (ledger[0]?.text ?? "").split("\n").findIndex((line) => line.startsWith(start)) + 1;
}

function issue(row: Issue): string {
  const { id, pr, state = "fixed", milestone = "Audit", escaped = "escaped: no" } = row;
  const found = pr === "audit" ? "audit / audit" : `#${pr} / round 1`;
  const last = escaped === "" ? "Related: none" : `Related: none; ${escaped}; fix-induced: no`;
  return `| ${dq(id)} | ${milestone} / #1 | 2026-11-18 / ${found} | Defect / P3 | A slip | — | ${state} | Review | Fix | ${last} |`;
}

function round(pr: number, form: "link" | "plain" = "link"): string {
  const name = form === "link" ? `[#${pr}](${LINK}/${pr})` : `#${pr}`;
  return `| ${name} / round 1 | 2026-11-18 | a / b | Scope | none | none | none | none | Checks |`;
}

type Register = { pr: number; milestone?: string; coverage?: string; cells: string[] };

function register(row: Register): string {
  const { pr, milestone = `${AUDIT} / a PR`, coverage = "Ledger", cells } = row;
  return `| [#${pr}](${LINK}/${pr}) | ${milestone} | ${coverage} | ${cells.join(" | ")} | — |`;
}

function auditRow(cells: string[]): string {
  const [prs = "", ...counts] = cells;
  return `| ${AUDIT} | ${prs} | ${MARKER} | ${counts.join(" | ")} |`;
}

const ISSUE_HEADER = [
  "| Issue ID | Milestone / introducing PR | Found date / discovery PR / round | Type / severity | Symptom and cause | Principle | State | Source | Fix and verification | Related issue / escaped / fix-induced |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
];
const ROUND_HEADER = [
  "| PR / round ID | Date | Base / head and local changes | Scope / source | New issue IDs | Reopened IDs | Fixed IDs | Withdrawn IDs | Required checks and results |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
];

type Fixture = {
  audit: string[];
  registerRows: string[];
  issues: string[];
  rounds: string[];
  archiveIssues?: string[];
  archiveRounds?: string[];
};

function files(fixture: Fixture): LedgerFile[] {
  const main = [
    "# Delivery quality",
    "",
    "## 2. Milestone view",
    "",
    "| Milestone | PRs in baseline population | Lesson source coverage | Unique issues | Open issues | Escaped issues | Review rounds |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    "| M2 | #20 | 1 lesson | 27 itemized | unknown | unknown | 7 logged |",
    auditRow(fixture.audit),
    "",
    "## 3. PR register",
    "",
    "| PR | Milestone / slice | Coverage | Unique issues | Open issues | Escaped issues | Review rounds | Historical snapshot |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...fixture.registerRows,
    "",
    "## 5. Live issue ledger",
    "",
    ...ISSUE_HEADER,
    ...fixture.issues,
    "",
    "## 6. Review round log",
    "",
    ...ROUND_HEADER,
    ...fixture.rounds,
    "",
  ].join("\n");
  const archive = [
    "# Archive",
    "",
    "## Closed issues",
    "",
    ...ISSUE_HEADER,
    ...(fixture.archiveIssues ?? []),
    "",
    "## Review rounds of merged PRs",
    "",
    ...ROUND_HEADER,
    ...(fixture.archiveRounds ?? []),
    "",
  ].join("\n");
  return [
    { path: MAIN, text: main },
    { path: ARCHIVE, text: archive },
  ];
}

// One PR (#10) with two issues (one open) and one round: the cells as the rows give them.
function onePr(overrides: Partial<Fixture> = {}): Fixture {
  return {
    audit: [
      "#10 (the register rows of this milestone)",
      "2 itemized",
      "1 (1 `open`)",
      "0 in the 2 rows that record it; 0 rows do not record it",
      "1 logged",
    ],
    registerRows: [register({ pr: 10, cells: ["2 (DQ-001, DQ-002)", "1 (DQ-002)", "0", "1"] })],
    issues: [issue({ id: 1, pr: 10 }), issue({ id: 2, pr: 10, state: "open" })],
    rounds: [round(10)],
    ...overrides,
  };
}

function text(all: LedgerFile[], path: string): string {
  return all.find((f) => f.path === path)?.text ?? "";
}

function withSplitLedger(
  { fixture, prevention = "" }: { fixture: Fixture; prevention?: string },
  run: (dir: string) => void,
): void {
  const all = files(fixture);
  const main = text(all, MAIN);
  const start = main.indexOf("## 2. Milestone view");
  const end = main.indexOf("## 5. Live issue ledger");
  const dir = mkdtempSync(join(tmpdir(), "records-cli-"));
  try {
    mkdirSync(join(dir, "docs"));
    writeFileSync(join(dir, MAIN), main.slice(0, start) + main.slice(end));
    writeFileSync(join(dir, REGISTER), main.slice(start, end));
    writeFileSync(join(dir, ARCHIVE), text(all, ARCHIVE));
    writeFileSync(join(dir, PREVENTION), prevention);
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runCounts(dir: string, ...args: string[]) {
  const script = fileURLToPath(new URL("./records-counts.ts", import.meta.url));
  return spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), script, ...args], {
    cwd: dir,
    encoding: "utf8",
  });
}

describe("records:counts", () => {
  it("writes counts in the separate register file", () => {
    const fixture = onePr({
      registerRows: [register({ pr: 10, cells: ["0", "0", "0", "0"] })],
    });
    withSplitLedger({ fixture }, (dir) => {
      const result = runCounts(dir, "--write");
      expect(result.status, result.stderr).toBe(0);
      expect(readFileSync(join(dir, REGISTER), "utf8"), "the corrected register row").toContain(
        register({ pr: 10, cells: ["2 (DQ-001, DQ-002)", "1 (DQ-002)", "0", "1"] }),
      );
    });
  });

  it("accepts a Same cause hit in the separate prevention file", () => {
    const row = issue({ id: 853, pr: 10 }).replace(
      "| Fix |",
      "| Same cause: no (search: `paper jam`: DQ-001) |",
    );
    const fixture = onePr({
      registerRows: [register({ pr: 10, cells: ["2 (DQ-002, DQ-853)", "1 (DQ-002)", "0", "1"] })],
      issues: [row, issue({ id: 2, pr: 10, state: "open" })],
    });
    withSplitLedger({ fixture, prevention: "An earlier paper jam (DQ-001).\n" }, (dir) => {
      const result = runCounts(dir);
      expect(result.status, result.stderr).toBe(0);
    });
  });

  it("reports a missing prevention search file", () => {
    withSplitLedger({ fixture: onePr() }, (dir) => {
      rmSync(join(dir, PREVENTION));
      const result = runCounts(dir);
      expect(result.status, result.stdout + result.stderr).toBe(1);
      expect(result.stderr).toContain(`${PREVENTION}: required search file is missing.`);
    });
  });

  it("writes nothing when the prevention search file is missing", () => {
    const fixture = onePr({
      registerRows: [register({ pr: 10, cells: ["0", "0", "0", "0"] })],
    });
    withSplitLedger({ fixture }, (dir) => {
      rmSync(join(dir, PREVENTION));
      const before = readFileSync(join(dir, REGISTER), "utf8");
      const result = runCounts(dir, "--write");
      expect(readFileSync(join(dir, REGISTER), "utf8"), "the stale register stays").toBe(before);
      expect(result.status, result.stdout + result.stderr).toBe(1);
    });
  });

  it("writes nothing when a blank line splits the prevention table", () => {
    const fixture = onePr({
      registerRows: [register({ pr: 10, cells: ["0", "0", "0", "0"] })],
    });
    const prevention = [
      "| Cause / linked issues | Action and owner | Enforcement or review step | Verification | State |",
      "| --- | --- | --- | --- | --- |",
      "| Paper jam | Check the tray | Inspect the tray | Clear | done |",
      "",
      "| Empty tray | Refill the tray | Check the paper level | Full | done |",
      "",
    ].join("\n");
    withSplitLedger({ fixture, prevention }, (dir) => {
      const before = readFileSync(join(dir, REGISTER), "utf8");
      runCounts(dir, "--write");
      expect(readFileSync(join(dir, REGISTER), "utf8"), "split prevention table").toBe(before);
    });
  });

  it("refuses a prevention row with a wrong cell count", () => {
    const prevention = [
      "| Cause / linked issues | Action and owner | Enforcement or review step | Verification | State |",
      "| --- | --- | --- | --- | --- |",
      "| Paper jam | Check the tray | Inspect the tray | Clear | done | extra |",
      "",
    ].join("\n");
    withSplitLedger({ fixture: onePr(), prevention }, (dir) => {
      const result = runCounts(dir);
      expect(result.stderr, "prevention cell count").toContain(
        `${PREVENTION}:3: the row Paper jam has 6 cells`,
      );
    });
  });

  it("does not count a round table in the prevention file", () => {
    const prevention = ["# Prevention", "", ...ROUND_HEADER, round(10), ""].join("\n");
    withSplitLedger({ fixture: onePr(), prevention }, (dir) => {
      const before = readFileSync(join(dir, REGISTER), "utf8");
      const result = runCounts(dir, "--write");
      expect(readFileSync(join(dir, REGISTER), "utf8"), "prevention round not counted").toBe(
        before,
      );
      expect(result.status, "counts stay right").toBe(0);
    });
  });

  describe("checks each of the four files", () => {
    const prevention = [
      "# Prevention",
      "",
      "| Cause / linked issues | Action and owner | Enforcement or review step | Verification | State |",
      "| --- | --- | --- | --- | --- |",
      "| Paper jam | Check the tray | Inspect the tray | Clear | done |",
      "",
    ].join("\n");
    const firstRow = /^\| (DQ-\d+|M2|Paper jam) \|/;
    const kinds = {
      cr: (text: string) => ({
        text: crOnFirstLine(text),
        message: () => ": the file has CR line ends",
      }),
      "padded id": (text: string) => {
        const lines = text.replace(/\n$/, "").split("\n");
        return {
          text: `${lines.join("\n")}\n|  DQ-999 | padded |\n`,
          message: () => `:${lines.length + 1}: write the first cell`,
        };
      },
      "split table": (text: string) => {
        const lines = text.replace(/\n$/, "").split("\n");
        return {
          text: `${lines.join("\n")}\n\n| stray | row |\n`,
          message: () => `:${lines.length + 2}: a table row with no header row before it`,
        };
      },
      "cell count": (text: string) => {
        const lines = text.split("\n");
        const index = lines.findIndex((line) => firstRow.test(line));
        lines[index] = `${lines[index]} extra |`;
        return { text: lines.join("\n"), message: () => `:${index + 1}: the row` };
      },
    };
    for (const path of [MAIN, ARCHIVE, REGISTER, PREVENTION])
      for (const [kind, damage] of Object.entries(kinds))
        it(`finds a ${kind} in ${path}`, () => {
          const fixture = onePr({
            registerRows: [register({ pr: 10, cells: ["0", "0", "0", "0"] })],
            archiveIssues: [issue({ id: 3, pr: 10 })],
          });
          withSplitLedger({ fixture, prevention }, (dir) => {
            const damaged = damage(readFileSync(join(dir, path), "utf8"));
            writeFileSync(join(dir, path), damaged.text);
            const before = readFileSync(join(dir, REGISTER), "utf8");
            const result = runCounts(dir, "--write");
            expect(result.stderr, `${kind} in ${path}`).toContain(`${path}${damaged.message()}`);
            if (path !== REGISTER)
              expect(readFileSync(join(dir, REGISTER), "utf8"), "no write").toBe(before);
          });
        });
  });

  it("finds no form problem in the real delivery-quality files", () => {
    const root = fileURLToPath(new URL("..", import.meta.url));
    const paths = [...ISSUE_FILES, REGISTER, PREVENTION];
    const real = paths.map((path) => ({ path, text: readFileSync(join(root, path), "utf8") }));
    expect(formProblems(real), "real files").toEqual([]);
  });

  it("refuses CR line ends in the prevention file and writes nothing", () => {
    const fixture = onePr({
      registerRows: [register({ pr: 10, cells: ["0", "0", "0", "0"] })],
    });
    withSplitLedger({ fixture, prevention: "An earlier paper jam.\r\n" }, (dir) => {
      const before = readFileSync(join(dir, REGISTER), "utf8");
      const result = runCounts(dir, "--write");
      expect(readFileSync(join(dir, REGISTER), "utf8"), "prevention CR").toBe(before);
      expect(result.stderr).toContain(
        `${PREVENTION}: the file has CR line ends; use LF line ends.`,
      );
    });
  });

  it("refuses a padded issue id in the prevention file and writes nothing", () => {
    const fixture = onePr({
      registerRows: [register({ pr: 10, cells: ["0", "0", "0", "0"] })],
    });
    const prevention = [
      "| Cause / linked issues | Action and owner | Enforcement or review step | Verification | State |",
      "| --- | --- | --- | --- | --- |",
      "| Paper jam | Check the tray | Inspect the tray | Clear | done |",
      "|  DQ-001 | Check the tray | Inspect the tray | Clear | done |",
      "",
    ].join("\n");
    withSplitLedger({ fixture, prevention }, (dir) => {
      const before = readFileSync(join(dir, REGISTER), "utf8");
      const result = runCounts(dir, "--write");
      expect(readFileSync(join(dir, REGISTER), "utf8"), "prevention padded id").toBe(before);
      expect(result.stderr).toContain(
        `${PREVENTION}:4: write the first cell of an issue row as "| DQ-n |"`,
      );
    });
  });

  it("reports a blank line that splits the prevention table", () => {
    const prevention = [
      "| Cause / linked issues | Action and owner | Enforcement or review step | Verification | State |",
      "| --- | --- | --- | --- | --- |",
      "| Paper jam | Check the tray | Inspect the tray | Clear | done |",
      "",
      "| Empty tray | Refill the tray | Check the paper level | Full | done |",
      "",
    ].join("\n");
    withSplitLedger({ fixture: onePr(), prevention }, (dir) => {
      const result = runCounts(dir);
      expect(result.status, result.stdout + result.stderr).toBe(1);
      expect(result.stderr).toContain(`${PREVENTION}:5: a table row with no header row before it`);
    });
  });
});

describe("checkCounts", () => {
  it("passes when each owned cell is what the rows give", () => {
    expect(checkCounts(files(onePr())), "a fixture with right cells").toEqual([]);
  });

  it("fails on a stale Audit count, and names the file, the row, the cell and both values", () => {
    const fixture = onePr({
      audit: [
        "#10 (the register rows of this milestone)",
        "1 itemized",
        "1 (1 `open`)",
        "0 in the 2 rows that record it; 0 rows do not record it",
        "1 logged",
      ],
    });
    expect(checkCounts(files(fixture)), "a stale unique count").toEqual([
      `${MAIN}: the row "${AUDIT}", cell "Unique issues" is "1 itemized"; the rows give "2 itemized". Run \`pnpm records:counts --write\`.`,
    ]);
  });

  it("counts the rows and the rounds of the archive file", () => {
    const fixture = onePr({
      archiveIssues: [issue({ id: 3, pr: 10, escaped: "escaped: yes" })],
      archiveRounds: [round(10)],
    });
    const problems = checkCounts(files(fixture)).join("\n");
    expect(problems, "unique from the archive row").toContain('the rows give "3 itemized"');
    expect(problems, "escaped from the archive row").toContain(
      'the rows give "1 in the 3 rows that record it; 0 rows do not record it"',
    );
    expect(problems, "rounds from the archive table").toContain('the rows give "2 logged"');
    expect(problems, "the register row").toContain('the rows give "3 (DQ-001 to DQ-003)"');
  });

  it("skips a withdrawn row, counts a dropped row as unique and not open, and a partial row as open", () => {
    const fixture = onePr({
      issues: [
        issue({ id: 1, pr: 10, state: "withdrawn" }),
        issue({ id: 2, pr: 10, state: "dropped" }),
        issue({ id: 3, pr: 10, state: "partial" }),
        issue({ id: 4, pr: 10, state: "open" }),
      ],
    });
    const problems = checkCounts(files(fixture)).join("\n");
    expect(problems, "unique without the withdrawn row").toContain('the rows give "3 itemized"');
    expect(problems, "open and partial").toContain('the rows give "2 (1 `open`, 1 `partial`)"');
    expect(problems, "register unique").toContain('the rows give "3 (DQ-002 to DQ-004)"');
    expect(problems, "register open").toContain('the rows give "2 (DQ-003, DQ-004)"');
  });

  it("counts escaped yes, records no, and does not record unknown or a missing value", () => {
    const fixture = onePr({
      issues: [
        issue({ id: 1, pr: 10, escaped: "escaped: yes (`abc1234`)" }),
        issue({ id: 2, pr: 10, escaped: "escaped: no" }),
        issue({ id: 3, pr: 10, escaped: "escaped: unknown" }),
        issue({ id: 4, pr: 10, escaped: "" }),
      ],
    });
    const problems = checkCounts(files(fixture)).join("\n");
    expect(problems, "the Audit escaped cell").toContain(
      'the rows give "1 in the 2 rows that record it; 2 rows do not record it"',
    );
    expect(problems, "the register escaped cell").toContain(
      'cell "Escaped issues" is "0"; the rows give "1 (DQ-001)"',
    );
  });
});

describe("writeCounts", () => {
  it("fixes a stale count, and a second write changes nothing", () => {
    const stale = files(onePr({ issues: [issue({ id: 1, pr: 10 })] }));
    const first = writeCounts(stale);
    expect(first.problems, "no problem other than stale cells").toEqual([]);
    expect(checkCounts(first.files), "the check after the write").toEqual([]);
    expect(writeCounts(first.files).files, "a second write").toEqual(first.files);
  });

  it("writes a Ledger register row by discovery PR, of any milestone, and keeps a Partial row as it is", () => {
    const partial = register({
      pr: 9,
      coverage: "Partial",
      cells: ["5 itemized (DQ-100 to DQ-104)", "unknown", "unknown", "6 independent reviews"],
    });
    const fixture = onePr({
      registerRows: [partial, register({ pr: 10, cells: ["0", "0", "0", "0"] })],
      issues: [
        issue({ id: 1, pr: 10 }),
        issue({ id: 2, pr: 10, state: "open", milestone: "unknown" }),
        issue({ id: 5, pr: 9 }),
      ],
      rounds: [round(10), round(10)],
    });
    const written = text(writeCounts(files(fixture)).files, MAIN);
    expect(written, "the Ledger row").toContain(
      `| [#10](${LINK}/10) | ${AUDIT} / a PR | Ledger | 2 (DQ-001, DQ-002) | 1 (DQ-002) | 0 | 2 | — |`,
    );
    expect(written, "the Partial row").toContain(partial);
  });

  it("writes the Audit PR list from the register and adds the rounds of those PRs only", () => {
    const fixture = onePr({
      registerRows: [
        register({ pr: 12, cells: ["1 (DQ-003)", "0", "0", "1"] }),
        register({ pr: 10, cells: ["2 (DQ-001, DQ-002)", "1 (DQ-002)", "0", "2"] }),
        register({
          pr: 11,
          milestone: "M2 / spec",
          coverage: "Partial",
          cells: ["unknown", "unknown", "unknown", "unknown"],
        }),
      ],
      issues: [
        issue({ id: 1, pr: 10 }),
        issue({ id: 2, pr: 10, state: "open" }),
        issue({ id: 3, pr: 12 }),
      ],
      rounds: [round(10), round(11), round(12)],
      archiveRounds: [round(10, "plain")],
    });
    const written = text(writeCounts(files(fixture)).files, MAIN);
    expect(written, "the Audit row").toContain(
      `| ${AUDIT} | #10, #12 (the register rows of this milestone) | ${MARKER} | 3 itemized | 1 (1 \`open\`) | 0 in the 3 rows that record it; 0 rows do not record it | 3 logged |`,
    );
  });

  it("changes no file when only a problem is found", () => {
    const fixture = onePr({ issues: [issue({ id: 1, pr: 10 }), issue({ id: 1, pr: 10 })] });
    const result = writeCounts(files(fixture));
    expect(result.files, "the files").toEqual(files(fixture));
    expect(result.problems, "the problem").toEqual([
      `${dq(1)} is in 2 rows (${MAIN}, ${MAIN}): each id has one row.`,
    ]);
  });
});

describe("structure problems", () => {
  it("reports an Audit row whose discovery PR has no register row, with the row to add", () => {
    const fixture = onePr({
      issues: [
        issue({ id: 1, pr: 10 }),
        issue({ id: 2, pr: 10, state: "open" }),
        issue({ id: 3, pr: 14 }),
      ],
    });
    expect(checkCounts(files(fixture)), "a PR with no register row").toContain(
      `#14 has Audit rows (${dq(3)}) and no register row in ${MAIN} §3. Add: | [#14](${LINK}/14) | ${AUDIT} / <slice> | Ledger | 0 | 0 | 0 | 0 | — |, then run \`pnpm records:counts --write\`.`,
    );
  });

  it("does not ask for a register row for rows that the audit itself found", () => {
    const fixture = onePr({ archiveIssues: [issue({ id: 3, pr: "audit", state: "fixed" })] });
    expect(checkCounts(files(fixture)).join("\n"), "an audit row").not.toContain("no register row");
  });

  it("reports one id in two rows, across the files", () => {
    const fixture = onePr({ archiveIssues: [issue({ id: 2, pr: 10 })] });
    expect(checkCounts(files(fixture)), "a double row").toContain(
      `${dq(2)} is in 2 rows (${MAIN}, ${ARCHIVE}): each id has one row.`,
    );
  });

  it("reports a table that a blank line splits, and writes nothing then", () => {
    const fixture = onePr({ rounds: [round(10), "", round(10)] });
    expect(checkCounts(files(fixture)), "a split round table").toEqual([
      `${MAIN}:29: a table row with no header row before it: a blank line or text split the table, and its rows show as text. Join the table.`,
    ]);
    expect(writeCounts(files(fixture)).files, "no write").toEqual(files(fixture));
  });

  it("reports a row with no state word, and a row whose discovery PR is not in the form / #N /", () => {
    const fixture = onePr({
      issues: [
        issue({ id: 1, pr: 10, state: "Open" }),
        issue({ id: 2, pr: 10, state: "open (owner)" }),
        issue({ id: 3, pr: 10 }).replace("/ #10 / round 1", "/ [#10](x) / round 1"),
        issue({ id: 4, pr: 10 }).replace("/ #10 / round 1", "/ #10, round 1"),
      ],
    });
    expect(checkCounts(files(fixture)), "malformed rows").toEqual([
      `${MAIN}: DQ-001 has no state cell (open, partial, fixed, dropped, withdrawn or unknown).`,
      `${MAIN}: DQ-002 has no state cell (open, partial, fixed, dropped, withdrawn or unknown).`,
      `${MAIN}: DQ-003 names a PR in its "Found date / discovery PR / round" cell, but not as "/ #N /".`,
      `${MAIN}: DQ-004 names a PR in its "Found date / discovery PR / round" cell, but not as "/ #N /".`,
    ]);
  });

  it("reports only the structure problem, with no stale cell counted from broken rows", () => {
    const fixture = onePr({ archiveIssues: [issue({ id: 2, pr: 10 })] });
    expect(checkCounts(files(fixture)), "a double row, no stale cell").toEqual([
      `${dq(2)} is in 2 rows (${MAIN}, ${ARCHIVE}): each id has one row.`,
    ]);
  });

  it("reports two milestone rows of the script with the same first word", () => {
    const [main, archive] = files(onePr());
    const second = `| Audit 2027-01-10 | — | ${MARKER} | 0 itemized | 0 | 0 in the 0 rows that record it; 0 rows do not record it | 0 logged |`;
    const text = (main?.text ?? "").replace(
      auditRow(onePr().audit),
      `${auditRow(onePr().audit)}\n${second}`,
    );
    expect(
      checkCounts([{ path: MAIN, text }, archive ?? { path: ARCHIVE, text: "" }]),
      "two Audit rows",
    ).toEqual([
      `Two rows of the milestone view count the ledger milestone "Audit": "${AUDIT}", "Audit 2027-01-10". Give each a first word of its own.`,
    ]);
  });

  it("reports a row with more or fewer cells than its header", () => {
    const fixture = onePr({
      issues: [
        issue({ id: 1, pr: 10 }).replace("| Review |", "| Review | stray |"),
        issue({ id: 2, pr: 10, state: "open" }).replace("| — |", "|"),
      ],
    });
    const problems = checkCounts(files(fixture));
    expect(
      problems.filter((p) => p.includes("cells")),
      "cell counts",
    ).toEqual([
      `${MAIN}:${lineIn(files(fixture), "| DQ-001 |")}: the row DQ-001 has 11 cells; its header has 10. Fix the stray or missing "|".`,
      `${MAIN}:${lineIn(files(fixture), "| DQ-002 |")}: the row DQ-002 has 9 cells; its header has 10. Fix the stray or missing "|".`,
    ]);
  });

  it("reports a round row and a register row with more or fewer cells than their header", () => {
    const fixture = onePr({
      rounds: [round(10).replace("| none | none |", "| none | none | stray |")],
      registerRows: [register({ pr: 10, cells: ["2 (DQ-001, DQ-002)", "1 (DQ-002)", "0"] })],
    });
    const problems = checkCounts(files(fixture)).filter((p) => p.includes("cells"));
    expect(problems, "round and register cell counts").toEqual([
      `${MAIN}:${lineIn(files(fixture), "| [#10](" + LINK + "/10) / round")}: the row [#10](${LINK}/10) / round 1 has 10 cells; its header has 9. Fix the stray or missing "|".`,
      `${MAIN}:${lineIn(files(fixture), "| [#10](" + LINK + "/10) | ")}: the row [#10](${LINK}/10) has 7 cells; its header has 8. Fix the stray or missing "|".`,
    ]);
  });

  it("ignores a padded data row that looks like a register heading", () => {
    const glossary = "| Field | Group |\n| --- | --- |\n|  PR  | Milestone / slice |\n";
    const ledger = files(onePr()).map((file) =>
      file.path === MAIN ? { path: MAIN, text: `${file.text}\n${glossary}` } : file,
    );
    const problems = checkCounts(ledger);
    expect(problems, "no second register").toEqual([]);
  });

  it("refuses an issue row whose id cell has extra spaces", () => {
    const fixture = onePr();
    const padded = files(fixture).map((file) =>
      file.path === MAIN
        ? {
            path: MAIN,
            text: file.text
              .replace("| DQ-001 |", "|  DQ-001 |")
              .replace("| DQ-002 |", "| DQ-002  |"),
          }
        : file,
    );
    const problems = checkCounts(padded).filter((p) => p.includes("first cell"));
    expect(problems, "padded id cells").toEqual([
      `${MAIN}:${lineIn(padded, "|  DQ-001 |")}: write the first cell of an issue row as "| DQ-n |", with one space on each side.`,
      `${MAIN}:${lineIn(padded, "| DQ-002  |")}: write the first cell of an issue row as "| DQ-n |", with one space on each side.`,
    ]);
    expect(writeCounts(padded).files, "no write with a padded id").toEqual(padded);
  });

  it("writes nothing with a padded id and a stale register", () => {
    const fixture = onePr({
      registerRows: [register({ pr: 10, cells: ["0", "0", "0", "0"] })],
    });
    const padded = files(fixture).map((file) =>
      file.path === MAIN ? { ...file, text: file.text.replace("| DQ-001 |", "|  DQ-001 |") } : file,
    );
    expect(writeCounts(padded).files, "stale register, padded id").toEqual(padded);
  });

  it("writes nothing with one CR line end and a stale register", () => {
    const fixture = onePr({
      registerRows: [register({ pr: 10, cells: ["0", "0", "0", "0"] })],
    });
    const crlf = files(fixture).map((file) =>
      file.path === MAIN ? { ...file, text: crOnFirstLine(file.text) } : file,
    );
    expect(writeCounts(crlf).files, "stale register, one CR").toEqual(crlf);
  });

  it("refuses CR line ends once for each file", () => {
    const crlf = files(onePr()).map((file) =>
      file.path === ARCHIVE ? { ...file, text: file.text.replace(/\n/g, "\r\n") } : file,
    );
    const problems = checkCounts(crlf).filter((p) => p.includes("CR"));
    expect(problems, "one CR problem").toEqual([
      `${ARCHIVE}: the file has CR line ends; use LF line ends.`,
    ]);
    expect(writeCounts(crlf).files, "no write with CR line ends").toEqual(crlf);
  });

  it("reports a milestone view row with more cells than its header", () => {
    const fixture = onePr({ audit: [...onePr().audit, "stray"] });
    const problems = checkCounts(files(fixture)).filter((p) => p.includes("cells"));
    expect(problems, "milestone view cell count").toEqual([
      `${MAIN}:${lineIn(files(fixture), "| Audit 2026-11-05 |")}: the row Audit 2026-11-05 has 8 cells; its header has 7. Fix the stray or missing "|".`,
    ]);
  });

  it("reports a table that no file has, and a table that two files have", () => {
    const [main, archive] = files(onePr());
    const noRegister = {
      path: MAIN,
      text: (main?.text ?? "").replace(
        "| PR | Milestone / slice |",
        "| Pull | Milestone / slice |",
      ),
    };
    expect(checkCounts([noRegister, archive ?? main ?? noRegister]), "no register").toContain(
      'No file has the table of the PR register (its header starts with "| PR | Milestone / slice |").',
    );
    const twice = {
      path: ARCHIVE,
      text: `${archive?.text ?? ""}\n| PR | Milestone / slice | Coverage |\n| --- | --- | --- |\n`,
    };
    expect(checkCounts([main ?? twice, twice]), "two registers").toContain(
      `Two tables of the PR register: ${MAIN}, ${ARCHIVE}. Keep one.`,
    );
  });
});

describe("the Same cause answer of a row", () => {
  // The rows of #100 from DQ-751 on, with a fix cell; the other cells are right.
  function rows(
    fix: string,
    options: { id?: number; change?: (row: string) => string } = {},
  ): Fixture {
    const { id = 751, change = (row: string) => row } = options;
    const row = change(issue({ id, pr: 100 }).replace("| Fix |", `| ${fix} |`));
    return onePr({
      registerRows: [
        register({ pr: 10, cells: ["2 (DQ-001, DQ-002)", "1 (DQ-002)", "0", "1"] }),
        register({ pr: 100, cells: [`1 (${dq(id)})`, "0", "0", "0"] }),
      ],
      audit: [
        "#10, #100 (the register rows of this milestone)",
        "3 itemized",
        "1 (1 `open`)",
        "0 in the 3 rows that record it; 0 rows do not record it",
        "1 logged",
      ],
      issues: [issue({ id: 1, pr: 10 }), issue({ id: 2, pr: 10, state: "open" }), row],
    });
  }

  it("reports a row from DQ-751 on whose fix cell has no answer with a search", () => {
    expect(checkCounts(files(rows("`abc1234`: the fix. Same cause? No"))), "no search").toEqual([
      `${MAIN}: DQ-751 has no "Same cause: yes|no (search: …)" in its "Fix and verification" cell (AGENTS.md §9; rows DQ-751 to DQ-777).`,
    ]);
  });

  it("passes a row that answers with a search, and an older row with no answer", () => {
    const answered = "`abc1234`: the fix. Same cause: no (search: `grep -n split`: no hit)";
    expect(checkCounts(files(rows(answered))), "an answer with a search").toEqual([]);
    expect(checkCounts(files(rows("`abc1234`: the fix", { id: 750 }))), "DQ-750").toEqual([]);
  });

  const NO_ANSWER = (id: number) =>
    `${MAIN}: ${dq(id)} has no "Same cause: yes|no (search: …)" in its "Fix and verification" cell (AGENTS.md §9; rows DQ-751 to DQ-777).`;

  it.each([
    ["an answer with no search", "Same cause: no"],
    ["the word search with no command and hits", "Same cause: no (no search done)"],
    ["a word other than yes or no", "Same cause: maybe (search: `grep -n x`: no hit)"],
    ["a small first letter", "same cause: no (search: `grep -n x`: no hit)"],
  ])("reports %s", (_name, fix) => {
    expect(checkCounts(files(rows(`\`abc1234\`: the fix. ${fix}`))), fix).toEqual([NO_ANSWER(751)]);
  });

  it("reports an old-form search with no hits", () => {
    const fix = "`abc1234`: the fix. Same cause: no (search: `grep -n x`)";
    expect(checkCounts(files(rows(fix))), "no hits").toEqual([NO_ANSWER(751)]);
  });

  it("accepts an old-form search place with parentheses", () => {
    const fix = "Same cause: no (search: review notes (archive): no hit)";
    expect(checkCounts(files(rows(fix))), "parentheses in the search place").toEqual([]);
  });

  it("reads the answer only in the Fix and verification cell", () => {
    const inRelated = (row: string) =>
      row.replace("Related: none;", "Related: none. Same cause: no (search: `grep -n x`: no hit);");
    expect(
      checkCounts(files(rows("`abc1234`: the fix", { id: 751, change: inRelated }))),
      "answer in Related",
    ).toEqual([NO_ANSWER(751)]);
  });

  it("passes a search that has an escaped pipe", () => {
    const answer = '`abc1234`: the fix. Same cause: no (search: `grep -E "a\\|b"`: no hit)';
    expect(checkCounts(files(rows(answer))), "escaped pipe").toEqual([]);
  });

  it("checks no row after DQ-777 and before DQ-853, nor a row found after 2026-11-18 below DQ-853, and skips a withdrawn row", () => {
    const later = (row: string) => row.replace("| 2026-11-18 /", "| 2026-11-19 /");
    expect(
      checkCounts(files(rows("`abc1234`: the fix", { id: 700, change: later }))),
      "DQ-700 found later",
    ).toEqual([]);
    expect(checkCounts(files(rows("`abc1234`: the fix", { id: 778 }))), "DQ-778").toEqual([]);
    expect(checkCounts(files(rows("`abc1234`: the fix", { id: 852 }))), "DQ-852").toEqual([]);
    const withdrawn = files(
      rows("Withdrawn: not a defect", {
        id: 751,
        change: (row) => row.replace("| fixed |", "| withdrawn |"),
      }),
    );
    expect(
      checkCounts(withdrawn).filter((p) => p.includes("Same cause")),
      "withdrawn",
    ).toEqual([]);
  });

  it("lists the answer problems next to a structure problem", () => {
    const [main, archive] = files(rows("`abc1234`: the fix"));
    const row = (main?.text ?? "").split("\n").find((line) => line.startsWith("| DQ-751 |")) ?? "";
    const archiveText = (archive?.text ?? "").replace(/(\| --- \|[^\n]*\n)/, `$1${row}\n`);
    expect(
      checkCounts([main ?? { path: MAIN, text: "" }, { path: ARCHIVE, text: archiveText }]),
      "a double row and two rows with no answer",
    ).toEqual([
      `DQ-751 is in 2 rows (${MAIN}, ${ARCHIVE}): each id has one row.`,
      NO_ANSWER(751),
      NO_ANSWER(751).replace(MAIN, ARCHIVE),
    ]);
  });
});

describe("the search of a new row (DQ-853 on)", () => {
  // Rows DQ-001 and DQ-002 ("A slip") and DQ-853 with a fix cell; DQ-003 ("a zebra") is in the
  // archive; a lesson names DQ-004 and DQ-020.
  const LESSON: LedgerFile = {
    path: "docs/lessons-learned/a-lesson.md",
    text: "# A lesson\n\nA kangaroo slip (DQ-004). As DQ-020 said.\n",
  };
  function rows(fix: string, change: (row: string) => string = (row) => row): LedgerFile[] {
    const row = change(issue({ id: 853, pr: 100 }).replace("| Fix |", `| ${fix} |`));
    const zebra = issue({ id: 3, pr: 10 }).replace("A slip", "A zebra");
    return files(
      onePr({
        registerRows: [
          register({ pr: 10, cells: ["3 (DQ-001 to DQ-003)", "1 (DQ-002)", "0", "1"] }),
          register({ pr: 100, cells: ["1 (DQ-853)", "0", "0", "0"] }),
        ],
        audit: [
          "#10, #100 (the register rows of this milestone)",
          "4 itemized",
          "1 (1 `open`)",
          "0 in the 4 rows that record it; 0 rows do not record it",
          "1 logged",
        ],
        issues: [issue({ id: 1, pr: 10 }), issue({ id: 2, pr: 10, state: "open" }), row],
        archiveIssues: [zebra],
      }),
    );
  }
  const check = (fix: string, change?: (row: string) => string) =>
    checkCounts(rows(`\`abc1234\`: the fix. ${fix}`, change), { otherSearchFiles: [LESSON] });
  const FORM = `${MAIN}: DQ-853 has no "Same cause: yes|no (search: \`<pattern>\`: <hits>)" in its "Fix and verification" cell (AGENTS.md §9; each row from DQ-853 on).`;
  const MISSING = (pattern: string, id: string) =>
    `${MAIN}: DQ-853: the search \`${pattern}\` finds ${id} in no line other than this row; cite only ids of its hits (owner, 2026-11-19, morning Q4 A).`;
  const NO_STEP = `${MAIN}: DQ-853 answers yes and names no §9 step: add "; §9: owner, <YYYY-MM-DD>, <page> Q<n> <option>", "; §9: proposal DQ-<n>" or "; §9: fixed answer (AGENTS.md §9, owner 2026-11-11)".`;

  it("reports a row from DQ-853 on in the old form", () => {
    expect(check("Same cause: no (search: grep -n slip: DQ-001)"), "old form").toEqual([FORM]);
  });

  it("reports the text of #137's DQ-849, a yes with no search pattern and no step", () => {
    const dq849 =
      'Not fixed (records only, the last check). Owner decides the redesign (§9). Same cause? Yes (§9): DQ-809 (search: "Same cause", "§9")';
    expect(check(dq849), "DQ-849").toEqual([FORM]);
  });

  it("passes a cited id that a hit line other than the row has", () => {
    expect(check("Same cause: no (search: `a slip`: DQ-001, other causes)"), "DQ-001").toEqual([]);
  });

  it("reports a cited id that only the row's own line has", () => {
    expect(check("Same cause: no (search: `fix of DQ-002`: DQ-002)"), "own line").toEqual([
      MISSING("fix of DQ-002", "DQ-002"),
    ]);
  });

  it("reports a cited id that no hit line has", () => {
    expect(check("Same cause: no (search: `a slip`: DQ-001, DQ-007)"), "DQ-007").toEqual([
      MISSING("a slip", "DQ-007"),
    ]);
  });

  it("reads a cited id as a whole id", () => {
    expect(check("Same cause: no (search: `as DQ-020`: DQ-02)"), "DQ-02").toEqual([
      MISSING("as DQ-020", "DQ-02"),
    ]);
  });

  it("reads an escaped pipe as an alternation", () => {
    const fix = "Same cause: no (search: `zebra\\|kangaroo`: DQ-003, DQ-004)";
    expect(check(fix), "alternation").toEqual([]);
  });

  it("matches in any case", () => {
    expect(check("Same cause: no (search: `A SLIP`: DQ-002)"), "any case").toEqual([]);
  });

  it("counts a hit in the archive", () => {
    expect(check("Same cause: no (search: `zebra`: DQ-003)"), "archive").toEqual([]);
  });

  it("counts a hit in a lesson", () => {
    expect(check("Same cause: no (search: `kangaroo`: DQ-004)"), "lesson").toEqual([]);
    expect(
      checkCounts(rows("`abc1234`: the fix. Same cause: no (search: `kangaroo`: DQ-004)")),
      "no lessons given",
    ).toEqual([MISSING("kangaroo", "DQ-004")]);
  });

  it("passes none as the hits", () => {
    expect(check("Same cause: no (search: `wombat`: none)"), "none").toEqual([]);
  });

  it("reports a backtick in the pattern", () => {
    expect(check("Same cause: no (search: `a`slip`: DQ-001)"), "backtick").toEqual([FORM]);
  });

  it.each([
    { name: "an empty pattern", pattern: " ", why: "it is empty" },
    {
      name: "a backslash before a letter",
      pattern: "slip\\d",
      why: "it has a backslash before a letter or a digit",
    },
    { name: "a POSIX class", pattern: "[[:digit:]]", why: 'it has "[["' },
    { name: "a group with (?", pattern: "(?=slip)", why: 'it has "(?"' },
    { name: "a pattern that does not compile", pattern: "slip(", why: "it does not compile" },
  ])("reports $name", ({ pattern, why }) => {
    expect(check(`Same cause: no (search: \`${pattern}\`: none)`), pattern).toEqual([
      `${MAIN}: DQ-853: the search pattern \`${pattern}\` is not allowed: ${why} (pull-request.md).`,
    ]);
  });

  it("passes a yes with an owner decision as its step", () => {
    const step = "owner, 2026-11-19, morning Q4 A";
    expect(check(`Same cause: yes (search: \`a slip\`: DQ-001; §9: ${step})`), "owner").toEqual([]);
  });

  it("passes a yes with a proposal row as its step", () => {
    const step = "proposal DQ-002";
    expect(check(`Same cause: yes (search: \`a slip\`: DQ-001; §9: ${step})`), "proposal").toEqual(
      [],
    );
  });

  it("passes a yes with the fixed answer as its step", () => {
    const step = "fixed answer (AGENTS.md §9, owner 2026-11-11)";
    expect(check(`Same cause: yes (search: \`a slip\`: DQ-001; §9: ${step})`), "fixed").toEqual([]);
  });

  it("reports a yes with no step", () => {
    expect(check("Same cause: yes (search: `a slip`: DQ-001)"), "no step").toEqual([NO_STEP]);
  });

  it("reports a proposal that is no row, and a proposal that is the row itself", () => {
    expect(
      check("Same cause: yes (search: `a slip`: DQ-001; §9: proposal DQ-999)"),
      "DQ-999",
    ).toEqual([`${MAIN}: DQ-853: the §9 proposal DQ-999 is not a row of the ledger files.`]);
    expect(
      check("Same cause: yes (search: `a slip`: DQ-001; §9: proposal DQ-853)"),
      "itself",
    ).toEqual([
      `${MAIN}: DQ-853: the §9 proposal DQ-853 is this row; name the row of the proposal.`,
    ]);
  });

  it("accepts an id in parenthesized hits", () => {
    const fix = "Same cause: yes (search: `kangaroo`: (DQ-004); §9: proposal DQ-002)";
    expect(check(fix), "parenthesized hits").toEqual([]);
  });

  it("checks hits after a nested close", () => {
    const fix = "Same cause: no (search: `a slip`: (DQ-001), DQ-007)";
    expect(check(fix), "hits after a nested close").toEqual([MISSING("a slip", "DQ-007")]);
  });

  it("checks hits after a plain semicolon", () => {
    const fix = "Same cause: no (search: `a slip`: DQ-001; see DQ-007)";
    expect(check(fix), "hits after a plain semicolon").toEqual([MISSING("a slip", "DQ-007")]);
  });

  it("accepts two answers in one cell", () => {
    const fix =
      "Same cause: no (search: `a slip`: DQ-001). Same cause: no (search: `zebra`: DQ-003)";
    expect(check(fix), "two valid answers").toEqual([]);
  });

  it("checks the second answer in a cell", () => {
    const fix =
      "Same cause: no (search: `a slip`: DQ-001). Same cause: no (search: `zebra`: DQ-007)";
    expect(check(fix), "hits of the second answer").toEqual([MISSING("zebra", "DQ-007")]);
  });

  it("rejects plain text in place of hits in the second answer", () => {
    const fix =
      "Same cause: no (search: `a slip`: DQ-001). Same cause: no (search: `zebra`: see review)";
    expect(check(fix), "second answer without an id or none").toEqual([
      `${MAIN}: DQ-853: the search \`zebra\` must cite hit ids or use "none".`,
    ]);
  });

  it("rejects a malformed second answer", () => {
    const fix = "Same cause: no (search: `a slip`: DQ-001). Same cause: yes";
    expect(check(fix), "malformed second answer").toEqual([FORM]);
  });

  it("ignores a quoted marker", () => {
    const fix = "The label is `Same cause:`. Same cause: no (search: `a slip`: DQ-001)";
    expect(check(fix), "quoted marker").toEqual([]);
  });

  it("checks a marker between escaped backticks", () => {
    const fix = "Same cause: no (search: `a slip`: DQ-001). \\`Same cause: maybe\\`";
    expect(check(fix), "marker between escaped backticks").toEqual([FORM]);
  });

  it("checks hits after escaped backticks in the answer body", () => {
    const fix = "Same cause: no (search: `a slip`: DQ-001 \\`(label\\`), DQ-007)";
    expect(check(fix), "hits after escaped backticks").toEqual([MISSING("a slip", "DQ-007")]);
  });

  it("checks a fixed row whose fix cell says withdrawn", () => {
    const problems = checkCounts(rows("withdrawn"), { otherSearchFiles: [LESSON] });
    expect(problems, "withdrawn outside State").toEqual([FORM]);
  });

  it("rejects a section 9 step for a no", () => {
    const fix = "Same cause: no (search: `a slip`: DQ-001; §9: proposal DQ-002)";
    expect(check(fix), "step for a no").toEqual([`${MAIN}: DQ-853: a no has a §9 step.`]);
  });

  it("rejects blank hits", () => {
    expect(check("Same cause: no (search: `a slip`:   )"), "blank hits").toEqual([FORM]);
  });

  it("rejects a colon continuation after an answer", () => {
    const fix = "Same cause: no (search: `a slip`: none): see DQ-001";
    expect(check(fix), "colon continuation").toEqual([
      `${MAIN}: DQ-853: a colon continues the answer after its closing ")". Put hits inside the answer or move the note before it.`,
    ]);
  });

  const checkStep = (step: string) =>
    check(`Same cause: yes (search: \`a slip\`: DQ-001; §9: ${step})`);
  const BAD_DATE = `${MAIN}: DQ-853: the owner step date is not a real date.`;

  it("rejects an unknown section 9 step", () => {
    expect(checkStep("someone agreed"), "unknown step").toEqual([NO_STEP]);
  });

  it("rejects free text in an owner step", () => {
    expect(
      checkStep("owner, 2026-11-19, morning Q4 A in the review"),
      "owner step with free text",
    ).toEqual([NO_STEP]);
  });

  it("accepts a leap day on a PR page", () => {
    expect(checkStep("owner, 2024-02-29, #135 Q3 A"), "leap day on a PR page").toEqual([]);
  });

  it("rejects a date outside the month", () => {
    expect(checkStep("owner, 2026-02-30, morning Q4 A"), "date outside the month").toEqual([
      BAD_DATE,
    ]);
  });

  it("rejects a leap day outside a leap year", () => {
    expect(checkStep("owner, 2026-02-29, morning Q4 A"), "leap day outside a leap year").toEqual([
      BAD_DATE,
    ]);
  });

  it("rejects year zero", () => {
    expect(checkStep("owner, 0000-01-01, morning Q4 A"), "year zero").toEqual([BAD_DATE]);
  });

  it("rejects an owner page with spaces", () => {
    expect(checkStep("owner, 2026-11-19, morning review Q4 A"), "page with spaces").toEqual([
      NO_STEP,
    ]);
  });

  it("rejects question zero", () => {
    expect(checkStep("owner, 2026-11-19, morning Q0 A"), "question zero").toEqual([NO_STEP]);
  });

  it("rejects a multi-letter answer", () => {
    expect(checkStep("owner, 2026-11-19, morning Q4 AB"), "multi-letter answer").toEqual([NO_STEP]);
  });

  const SELF_PROPOSAL = "Same cause: yes (search: `a slip`: DQ-001; §9: proposal DQ-853)";
  const SELF_PROPOSAL_PROBLEM = `${MAIN}: DQ-853: the §9 proposal DQ-853 is this row; name the row of the proposal.`;

  it("accepts a self-proposal with its prefix", () => {
    const problems = checkCounts(rows(`  Proposal: a redesign. ${SELF_PROPOSAL}`));
    expect(problems, "self-proposal with prefix").toEqual([]);
  });

  it("rejects a self-proposal without its prefix", () => {
    expect(check(SELF_PROPOSAL), "self-proposal without prefix").toEqual([SELF_PROPOSAL_PROBLEM]);
  });

  it("requires the self-proposal prefix at the start", () => {
    expect(
      check(`Proposal: a redesign. ${SELF_PROPOSAL}`),
      "self-proposal with a late prefix",
    ).toEqual([SELF_PROPOSAL_PROBLEM]);
  });

  it("skips a withdrawn row", () => {
    const withdrawn = (row: string) => row.replace("| fixed |", "| withdrawn |");
    const problems = check("Withdrawn: not a defect", withdrawn);
    const ofTheRow = problems.filter((p) => p.startsWith(`${MAIN}: DQ-853`));
    expect(ofTheRow, "withdrawn").toEqual([]);
  });
});

describe("searchLines and grep", () => {
  // The lib runs a pattern as a JavaScript regular expression; the documented command is grep -E.
  // For each pattern of the tests above, both give the same hit lines.
  const TEXT = [
    "| DQ-001 | A slip | fixed |",
    "| DQ-003 | A zebra | open |",
    "A kangaroo slip (DQ-004). As DQ-020 said.",
    "Escaped \\| pipe and a.dot",
    "a SLIP in capitals",
    "",
  ].join("\n");
  const PATTERNS = [
    "a slip",
    "zebra|kangaroo",
    "A SLIP",
    "as DQ-020",
    "a.dot",
    "slip|pipe$",
    "^\\| DQ-00[13]",
  ];
  const grep = spawnSync("grep", ["--version"], { encoding: "utf8" });

  it("accepts the search patterns from plan revision 4", () => {
    for (const pattern of ["a+?", "a{,3}", "[a[:digit:]]", "x[^]"]) {
      expect(patternProblem(pattern), "revision 4 pattern " + pattern).toBeUndefined();
    }
  });

  it("gives the hit lines of grep -n -i -E for each pattern", (context) => {
    if (grep.error !== undefined) {
      context.skip("no grep on this machine, so the parity of the lib and grep is not checked");
    }
    const dir = mkdtempSync(join(tmpdir(), "records-grep-"));
    try {
      const path = join(dir, "ledger.md");
      writeFileSync(path, TEXT);
      for (const pattern of PATTERNS) {
        expect(patternProblem(pattern), pattern).toBeUndefined();
        const out = spawnSync("grep", ["-n", "-i", "-E", "--", pattern, path], {
          encoding: "utf8",
        });
        const want = out.stdout
          .split("\n")
          .filter((line) => line !== "")
          .map((line) => Number(line.slice(0, line.indexOf(":"))));
        const got = searchLines(pattern, [{ path, text: TEXT }]).map((hit) => hit.line);
        expect(got, pattern).toEqual(want);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("strayLedgerFiles", () => {
  it("reports a docs file outside the list that holds ledger rows, and not a file that only quotes an id", () => {
    const docs: LedgerFile[] = [
      { path: MAIN, text: issue({ id: 1, pr: 10 }) },
      { path: "docs/delivery-quality-2.md", text: `# Moved\n\n${issue({ id: 2, pr: 10 })}\n` },
      {
        path: "docs/status.md",
        text: "| 2026-11-18 | DQ-001 is fixed. |\nSee DQ-002 and | DQ-003 in a line.\n",
      },
    ];
    expect(strayLedgerFiles({ docs, list: [MAIN, ARCHIVE] }), "the stray file").toEqual([
      "docs/delivery-quality-2.md has ledger rows (DQ-002) and is not in LEDGER_FILES of scripts/records-counts.ts: add it there.",
    ]);
  });
});

describe("formatIds", () => {
  it("writes a run of three or more ids as a range, and lists two", () => {
    expect(formatIds([8, 3, 1, 2, 7]), "runs").toBe("DQ-001 to DQ-003, DQ-007, DQ-008");
  });
});
