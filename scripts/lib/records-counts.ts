// The counts behind `pnpm records:counts`: the rows of the ledger files are the one home of each
// issue and round, and this module writes the counts that other tables give from them
// (plans/p3-records-counts.md). It owns two kinds of cells:
// - the rows of the milestone view whose "Lesson source coverage" cell ends with OWNED_MARKER;
// - the four count cells of each register row with the coverage `Ledger`.
// Pure: the caller reads and writes the files. Tables are found by their header line, in any file,
// so a move of rows to another file changes nothing here.

export type LedgerFile = { path: string; text: string };

export const OWNED_MARKER = "written by `pnpm records:counts`";

const PULL_LINK = "https://github.com/binhle312/cty1ng/pull";
const ISSUE_ROW = /^\| DQ-(\d+) \|/;
const STATES = ["open", "partial", "fixed", "dropped", "withdrawn", "unknown"] as const;
type State = (typeof STATES)[number];

const TABLES = {
  milestones: { name: "the milestone view", header: "| Milestone | PRs in baseline population |" },
  register: { name: "the PR register", header: "| PR | Milestone / slice |" },
} as const;
const ROUND_HEADER = "| PR / round ID |";
const WRITE_HINT = "Run `pnpm records:counts --write`.";

type Issue = {
  id: number;
  path: string;
  milestone: string;
  discoveryPr: number | undefined;
  state: State | undefined;
  escaped: "yes" | "no" | "unrecorded";
};

// A table row: where it is, and its cells as they are written.
type Row = { path: string; line: number; cells: string[] };
type Table = { path: string; headers: string[]; rows: Row[] };

type Ledger = {
  issues: Issue[];
  rounds: Map<number, number>;
  milestones: Table;
  register: Table;
};

// The cells of a Markdown table line, split at each `|` that is not escaped.
function cellsOf(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/(?<!\\)\|$/, "")
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim());
}

function lineOf(cells: readonly string[]): string {
  return `| ${cells.join(" | ")} |`;
}

function dq(id: number): string {
  return `DQ-${String(id).padStart(3, "0")}`;
}

// "DQ-001 to DQ-003, DQ-007, DQ-008": a run of three or more ids is a range.
export function formatIds(ids: readonly number[]): string {
  const sorted = [...new Set(ids)].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = 0;
  while (start < sorted.length) {
    let end = start;
    while (end + 1 < sorted.length && sorted[end + 1] === (sorted[end] ?? 0) + 1) end++;
    const run = sorted.slice(start, end + 1);
    if (run.length >= 3) parts.push(`${dq(run[0] ?? 0)} to ${dq(run[run.length - 1] ?? 0)}`);
    else parts.push(...run.map(dq));
    start = end + 1;
  }
  return parts.join(", ");
}

function tablesWithHeader(input: { files: readonly LedgerFile[]; header: string }): Table[] {
  const tables: Table[] = [];
  for (const file of input.files) {
    const lines = file.text.split("\n");
    lines.forEach((line, index) => {
      if (!line.startsWith(input.header)) return;
      const rows: Row[] = [];
      for (let next = index + 2; next < lines.length; next++) {
        const row = lines[next] ?? "";
        if (!row.startsWith("|")) break;
        rows.push({ path: file.path, line: next, cells: cellsOf(row) });
      }
      tables.push({ path: file.path, headers: cellsOf(line), rows });
    });
  }
  return tables;
}

function parseIssue(input: { path: string; line: string }): Issue | undefined {
  const match = ISSUE_ROW.exec(input.line);
  if (match === null) return undefined;
  const cells = cellsOf(input.line);
  const last = cells[cells.length - 1] ?? "";
  const recorded = /escaped: /.test(last) && !/escaped: unknown/.test(last);
  return {
    id: Number(match[1]),
    path: input.path,
    milestone: (cells[1] ?? "").split(/[\s/]/)[0] ?? "",
    discoveryPr: numberOf(/\/ #(\d+) \//.exec(cells[2] ?? "")?.[1]),
    state: cells.slice(3).find((cell): cell is State => STATES.some((state) => state === cell)),
    escaped: /escaped: yes/.test(last) ? "yes" : recorded ? "no" : "unrecorded",
  };
}

function numberOf(text: string | undefined): number | undefined {
  return text === undefined ? undefined : Number(text);
}

// The PR of a round row: `[#N](…) / …` or `#N / …`.
function roundPr(cell: string): number | undefined {
  const name =
    cell
      .replace(/\(https[^)]*\)/, "")
      .replace(/[[\]]/g, "")
      .split("/")[0] ?? "";
  return numberOf(/^#(\d+)$/.exec(name.trim())?.[1]);
}

function registerPr(row: Row): number | undefined {
  return numberOf(/^\[#(\d+)\]/.exec(row.cells[0] ?? "")?.[1]);
}

function readLedger(files: readonly LedgerFile[]): { ledger?: Ledger; problems: string[] } {
  const problems: string[] = [];
  const found = Object.values(TABLES).map((table) => {
    const tables = tablesWithHeader({ files, header: table.header });
    if (tables.length === 0)
      problems.push(
        `No file has the table of ${table.name} (its header starts with "${table.header}").`,
      );
    if (tables.length > 1)
      problems.push(
        `Two tables of ${table.name}: ${tables.map((t) => t.path).join(", ")}. Keep one.`,
      );
    return tables[0];
  });
  problems.push(...splitTables(files));
  const [milestones, register] = found;
  if (problems.length > 0 || milestones === undefined || register === undefined)
    return { problems };
  const issues = files.flatMap((file) =>
    file.text.split("\n").flatMap((line) => parseIssue({ path: file.path, line }) ?? []),
  );
  const rounds = new Map<number, number>();
  for (const table of tablesWithHeader({ files, header: ROUND_HEADER }))
    for (const row of table.rows) {
      const pr = roundPr(row.cells[0] ?? "");
      if (pr !== undefined) rounds.set(pr, (rounds.get(pr) ?? 0) + 1);
    }
  return { ledger: { issues, rounds, milestones, register }, problems };
}

function idCell(issues: readonly Issue[]): string {
  return issues.length === 0 ? "0" : `${issues.length} (${formatIds(issues.map((i) => i.id))})`;
}

function openCell(issues: readonly Issue[]): string {
  const parts = (["open", "partial"] as const)
    .map((state) => ({ state, count: issues.filter((i) => i.state === state).length }))
    .filter((part) => part.count > 0);
  const total = parts.reduce((sum, part) => sum + part.count, 0);
  if (total === 0) return "0";
  return `${total} (${parts.map((part) => `${part.count} \`${part.state}\``).join(", ")})`;
}

function isOpen(issue: Issue): boolean {
  return issue.state === "open" || issue.state === "partial";
}

// The cells that the rows give, by table row: the index of each owned cell and its text.
type Owned = { row: Row; name: string; headers: string[]; cells: Map<number, string> };

function ownedCells(ledger: Ledger): Owned[] {
  const counted = ledger.issues.filter((issue) => issue.state !== "withdrawn");
  const owned: Owned[] = [];
  for (const row of ledger.milestones.rows) {
    if (!(row.cells[2] ?? "").endsWith(OWNED_MARKER)) continue;
    const name = row.cells[0] ?? "";
    const key = name.split(" ")[0] ?? "";
    const prs = ledger.register.rows
      .filter((r) => (r.cells[1] ?? "").startsWith(name))
      .flatMap((r) => registerPr(r) ?? [])
      .sort((a, b) => a - b);
    const issues = counted.filter((issue) => issue.milestone === key);
    const recorded = issues.filter((issue) => issue.escaped !== "unrecorded").length;
    const escaped = issues.filter((issue) => issue.escaped === "yes").length;
    const rounds = prs.reduce((sum, pr) => sum + (ledger.rounds.get(pr) ?? 0), 0);
    owned.push({
      row,
      name: `"${name}"`,
      headers: ledger.milestones.headers,
      cells: new Map([
        [1, `${prs.map((pr) => `#${pr}`).join(", ")} (the register rows of this milestone)`],
        [3, `${issues.length} itemized`],
        [4, openCell(issues)],
        [
          5,
          `${escaped} in the ${recorded} rows that record it; ${issues.length - recorded} rows do not record it`,
        ],
        [6, `${rounds} logged`],
      ]),
    });
  }
  for (const row of ledger.register.rows) {
    const pr = registerPr(row);
    if (row.cells[2] !== "Ledger" || pr === undefined) continue;
    const issues = counted.filter((issue) => issue.discoveryPr === pr);
    owned.push({
      row,
      name: `#${pr}`,
      headers: ledger.register.headers,
      cells: new Map([
        [3, idCell(issues)],
        [4, idCell(issues.filter(isOpen))],
        [5, idCell(issues.filter((issue) => issue.escaped === "yes"))],
        [6, String(ledger.rounds.get(pr) ?? 0)],
      ]),
    });
  }
  return owned;
}

// A table row after a line that is not a table line starts a new table, and with no header row
// after it, Markdown shows its rows as text: a blank line split the table.
function splitTables(files: readonly LedgerFile[]): string[] {
  const problems: string[] = [];
  for (const file of files) {
    const lines = file.text.split("\n");
    lines.forEach((line, index) => {
      const previous = index === 0 ? "" : (lines[index - 1] ?? "");
      if (!line.startsWith("|") || previous.startsWith("|")) return;
      if (/^\|( *:?-+:? *\|)+$/.test(lines[index + 1] ?? "")) return;
      problems.push(
        `${file.path}:${index + 1}: a table row with no header row before it: a blank line or text split the table, and its rows show as text. Join the table.`,
      );
    });
  }
  return problems;
}

function structureProblems(ledger: Ledger): string[] {
  const problems: string[] = [];
  const paths = new Map<number, string[]>();
  for (const issue of ledger.issues)
    paths.set(issue.id, [...(paths.get(issue.id) ?? []), issue.path]);
  for (const [id, where] of paths)
    if (where.length > 1)
      problems.push(
        `${dq(id)} is in ${where.length} rows (${where.join(", ")}): each id has one row.`,
      );
  const registered = new Set(ledger.register.rows.flatMap((row) => registerPr(row) ?? []));
  for (const row of ledger.milestones.rows) {
    if (!(row.cells[2] ?? "").endsWith(OWNED_MARKER)) continue;
    const name = row.cells[0] ?? "";
    const key = name.split(" ")[0] ?? "";
    const missing = new Map<number, number[]>();
    for (const issue of ledger.issues)
      if (
        issue.milestone === key &&
        issue.discoveryPr !== undefined &&
        !registered.has(issue.discoveryPr)
      )
        missing.set(issue.discoveryPr, [...(missing.get(issue.discoveryPr) ?? []), issue.id]);
    for (const [pr, ids] of missing)
      problems.push(
        `#${pr} has ${key} rows (${formatIds(ids)}) and no register row in ${ledger.register.path} §3. Add: ${lineOf([`[#${pr}](${PULL_LINK}/${pr})`, `${name} / <slice>`, "Ledger", "0", "0", "0", "0", "—"])}, then run \`pnpm records:counts --write\`.`,
      );
  }
  return problems;
}

function staleProblems(ledger: Ledger): string[] {
  const problems: string[] = [];
  for (const owned of ownedCells(ledger)) {
    for (const [index, want] of owned.cells) {
      const now = owned.row.cells[index] ?? "";
      if (now !== want)
        problems.push(
          `${owned.row.path}: the row ${owned.name}, cell "${owned.headers[index] ?? index}" is "${now}"; the rows give "${want}". ${WRITE_HINT}`,
        );
    }
  }
  return problems;
}

// Every problem: the structure of the files, then each owned cell that differs from the rows.
export function checkCounts(files: readonly LedgerFile[]): string[] {
  const { ledger, problems } = readLedger(files);
  if (ledger === undefined) return problems;
  return [...structureProblems(ledger), ...staleProblems(ledger)];
}

// The files with each owned cell written from the rows. With a structure problem, no file changes.
export function writeCounts(files: readonly LedgerFile[]): {
  files: LedgerFile[];
  problems: string[];
} {
  const { ledger, problems } = readLedger(files);
  if (ledger === undefined) return { files: [...files], problems };
  const structure = structureProblems(ledger);
  if (structure.length > 0) return { files: [...files], problems: structure };
  const lines = new Map(files.map((file) => [file.path, file.text.split("\n")]));
  for (const owned of ownedCells(ledger)) {
    const cells = [...owned.row.cells];
    for (const [index, want] of owned.cells) cells[index] = want;
    const target = lines.get(owned.row.path);
    if (target !== undefined && cells.join("|") !== owned.row.cells.join("|"))
      target[owned.row.line] = lineOf(cells);
  }
  return {
    files: files.map((file) => ({
      path: file.path,
      text: (lines.get(file.path) ?? []).join("\n"),
    })),
    problems: [],
  };
}

// A docs file outside the list that holds ledger rows (a line that starts with `| DQ-<digits> |`).
// An id quoted inside text is not a row.
export function strayLedgerFiles(input: {
  docs: readonly LedgerFile[];
  list: readonly string[];
}): string[] {
  return input.docs
    .filter((file) => !input.list.includes(file.path))
    .flatMap((file) => {
      const ids = file.text
        .split("\n")
        .flatMap((line) => numberOf(ISSUE_ROW.exec(line)?.[1]) ?? []);
      if (ids.length === 0) return [];
      return [
        `${file.path} has ledger rows (${formatIds(ids)}) and is not in LEDGER_FILES of scripts/records-counts.ts: add it there.`,
      ];
    });
}
