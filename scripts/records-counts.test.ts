import { describe, expect, it } from "vitest";
import {
  type LedgerFile,
  checkCounts,
  formatIds,
  strayLedgerFiles,
  writeCounts,
} from "./lib/records-counts.ts";

const LINK = "https://github.com/binhle312/cty1ng/pull";
const MAIN = "docs/delivery-quality.md";
const ARCHIVE = "docs/delivery-quality-archive.md";
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
  function rows(fix: string, id = 751): Fixture {
    const row = issue({ id, pr: 100 }).replace("| Fix |", `| ${fix} |`);
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
      `${MAIN}: DQ-751 has no "Same cause: yes|no (search: …)" in its "Fix and verification" cell (AGENTS.md §9; each row from DQ-751 on).`,
    ]);
  });

  it("passes a row that answers with a search, and an older row with no answer", () => {
    const answered = "`abc1234`: the fix. Same cause: no (search: `grep -n split`: no hit)";
    expect(checkCounts(files(rows(answered))), "an answer with a search").toEqual([]);
    expect(checkCounts(files(rows("`abc1234`: the fix", 750))), "DQ-750").toEqual([]);
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
