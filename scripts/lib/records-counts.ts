// The counts behind `pnpm records:counts` come from the rows of the ledger files.
// See docs/delivery-quality.md#7-update-and-assess, step 2, for where to record each review.
// This module owns two kinds of cells (plans/p3-records-counts.md):
// - the rows of the milestone view whose "Lesson source coverage" cell ends with OWNED_MARKER;
// - the four count cells of each register row with the coverage `Ledger`.
// Pure: the caller reads and writes the files. Tables are found by their header line, in any file,
// so a move of rows to another file changes nothing here.

export type LedgerFile = { path: string; text: string };

export const OWNED_MARKER = "written by `pnpm records:counts`";
export const ISSUE_FILES = ["docs/delivery-quality.md", "docs/delivery-quality-archive.md"];

const PULL_LINK = "https://github.com/binhle312/cty1ng/pull";
const ISSUE_ROW = /^\| DQ-(\d+) \|/;
// A line that starts like an issue row, with other spaces or tabs around the id.
const LOOSE_ISSUE_ROW = /^\|[ \t]*DQ-\d+[ \t]*\|/;
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
  // The discovery cell names a PR (`#N`), in the form `/ #N /` or not.
  foundNamesPr: boolean;
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

// A Markdown table starts with a heading line and a separator line under it.
const SEPARATOR_ROW = /^\|( *:?-+:? *\|)+$/;

// Extra spaces inside the heading cells do not hide the table.
function isHeading(input: { line: string; next: string; header: string }): boolean {
  const { line, next, header } = input;
  return (
    line.startsWith("|") && lineOf(cellsOf(line)).startsWith(header) && SEPARATOR_ROW.test(next)
  );
}

function tablesWithHeader(input: { files: readonly LedgerFile[]; header: string }): Table[] {
  const tables: Table[] = [];
  for (const file of input.files) {
    const lines = file.text.split("\n");
    lines.forEach((line, index) => {
      if (!isHeading({ line, next: lines[index + 1] ?? "", header: input.header })) return;
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

function issueId(line: string): number | undefined {
  return numberOf(ISSUE_ROW.exec(line)?.[1]);
}

export type IssueRow = Pick<Row, "path" | "cells"> & {
  id: string;
  raw: string;
  headers: readonly string[];
};

export function issueRows(files: readonly LedgerFile[]): IssueRow[] {
  return files.flatMap((file) => {
    const columns = new Map<number, Pick<IssueRow, "headers" | "cells">>();
    for (const table of tablesWithHeader({ files: [file], header: ISSUE_HEADER }))
      for (const row of table.rows)
        columns.set(row.line, { headers: table.headers, cells: row.cells });

    return file.text.split("\n").flatMap((raw, index) => {
      const id = issueId(raw);
      if (id === undefined) return [];
      // A row outside a table still has an ID, but its headings are unknown.
      const parsed = columns.get(index) ?? { headers: [], cells: cellsOf(raw) };
      return { id: dq(id), path: file.path, raw, ...parsed };
    });
  });
}

function parseIssue(input: { path: string; line: string }): Issue | undefined {
  const id = issueId(input.line);
  if (id === undefined) return undefined;
  const cells = cellsOf(input.line);
  const last = cells[cells.length - 1] ?? "";
  const recorded = /escaped: /.test(last) && !/escaped: unknown/.test(last);
  return {
    id,
    path: input.path,
    milestone: (cells[1] ?? "").split(/[\s/]/)[0] ?? "",
    discoveryPr: numberOf(/\/ #(\d+) \//.exec(cells[2] ?? "")?.[1]),
    foundNamesPr: /#\d/.test(cells[2] ?? ""),
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

// The readers match an issue row by its exact first cell and split lines at LF, so they refuse
// other forms: a missed row would hide its words (owner, 2026-11-25, plan revision 9, Q2 R).
export function formProblems(files: readonly LedgerFile[]): string[] {
  return files.flatMap((file) => {
    if (file.text.includes("\r"))
      return [`${file.path}: the file has CR line ends; use LF line ends.`];
    return file.text
      .split("\n")
      .flatMap((line, index) =>
        LOOSE_ISSUE_ROW.test(line) && !ISSUE_ROW.test(line)
          ? [
              `${file.path}:${index + 1}: write the first cell of an issue row as "| DQ-n |", with one space on each side.`,
            ]
          : [],
      );
  });
}

// The counts come only from `files`; the structure checks also read `checkedOnly` (plan revision 11,
// Q1 A: the prevention file is checked, never a source of counts).
function readLedger(
  files: readonly LedgerFile[],
  checkedOnly: readonly LedgerFile[] = [],
): { ledger?: Ledger; problems: string[] } {
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
  const checkedFiles = [...files, ...checkedOnly];
  problems.push(
    ...formProblems(checkedFiles),
    ...splitTables(checkedFiles),
    ...cellCountProblems(checkedFiles),
  );
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

const ISSUE_HEADER = "| Issue ID |";
const PREVENTION_HEADER = "| Cause / linked issues |";

// A row with more or fewer cells than its header: a stray or missing `|` moves each later cell,
// so the state, the discovery PR or the escaped value would be read from the wrong cell.
function cellCountProblems(files: readonly LedgerFile[]): string[] {
  const headers = [
    ISSUE_HEADER,
    ROUND_HEADER,
    PREVENTION_HEADER,
    ...Object.values(TABLES).map((t) => t.header),
  ];
  return headers.flatMap((header) =>
    tablesWithHeader({ files, header }).flatMap((table) =>
      table.rows
        .filter((row) => row.cells.length !== table.headers.length)
        .map(
          (row) =>
            `${row.path}:${row.line + 1}: the row ${row.cells[0] ?? ""} has ${row.cells.length} cells; its header has ${table.headers.length}. Fix the stray or missing "|".`,
        ),
    ),
  );
}

// A table row after a line that is not a table line starts a new table, and with no header row
// after it, Markdown shows its rows as text: a blank line split the table.
export function splitTables(files: readonly LedgerFile[]): string[] {
  const problems: string[] = [];
  for (const file of files) {
    const lines = file.text.split("\n");
    lines.forEach((line, index) => {
      const previous = index === 0 ? "" : (lines[index - 1] ?? "");
      if (!line.startsWith("|") || previous.startsWith("|")) return;
      if (SEPARATOR_ROW.test(lines[index + 1] ?? "")) return;
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
  for (const issue of ledger.issues) {
    if (issue.state === undefined)
      problems.push(
        `${issue.path}: ${dq(issue.id)} has no state cell (open, partial, fixed, dropped, withdrawn or unknown).`,
      );
    if (issue.foundNamesPr && issue.discoveryPr === undefined)
      problems.push(
        `${issue.path}: ${dq(issue.id)} names a PR in its "Found date / discovery PR / round" cell, but not as "/ #N /".`,
      );
  }
  const keys = new Map<string, string[]>();
  for (const row of ledger.milestones.rows) {
    if (!(row.cells[2] ?? "").endsWith(OWNED_MARKER)) continue;
    const name = row.cells[0] ?? "";
    const key = name.split(" ")[0] ?? "";
    keys.set(key, [...(keys.get(key) ?? []), name]);
  }
  for (const [key, names] of keys)
    if (names.length > 1)
      problems.push(
        `Two rows of the milestone view count the ledger milestone "${key}": ${names.map((n) => `"${n}"`).join(", ")}. Give each a first word of its own.`,
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

// The "Same cause?" answer of a row lives in its "Fix and verification" cell (AGENTS.md §9; owner,
// 2026-11-18, q4 Q3 A). Two checks, by id; a withdrawn row has no fix to answer for:
// - DQ-751 to DQ-777 (the rows of #135): the old form uses the rule of main
//   (owner, 2026-11-25, plan revision 6).
// - From DQ-853 on (owner, 2026-11-19, morning Q4 A, "new rows only"): the search is one pattern
//   that this module runs again, each id that the row cites must be in a hit line other than the
//   row, and a yes names its §9 step. The rows in between belong to PRs that were open then.
const OLD_FORM = { first: 751, last: 777 };
const FIRST_SEARCHED_ID = 853;
// `Same cause: yes|no (search: <command or places>: <hits>)`; an escaped `\|` may be in the search.
const OLD_ANSWER = /Same cause: (yes|no) \(search: (?:[^|\\]|\\.)+?: (?:[^|\\]|\\.)+\)/;
const ANSWER_START = /^Same cause: (yes|no) \(search: `([^`]*)`: /;
const STEP_START = "; §9: ";
const OWNER_STEP =
  /^owner, (\d{4}-\d{2}-\d{2}), (?:#[1-9]\d*|[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*) Q[1-9]\d* [A-Z]$/;
const PROPOSAL_STEP = /^proposal DQ-(\d+)$/;
const FIXED_STEP = "fixed answer (AGENTS.md §9, owner 2026-11-11)";
const WHOLE_DQ_ID = /\bDQ-\d+\b/g;
const STEP_HINT =
  '"; §9: owner, <YYYY-MM-DD>, <page> Q<n> <option>", "; §9: proposal DQ-<n>" or "; §9: fixed answer (AGENTS.md §9, owner 2026-11-11)"';

function isGregorianDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !value.startsWith("0000-") &&
    Number.isFinite(date.valueOf()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function answerParts(segment: string) {
  const start = ANSWER_START.exec(segment);
  if (start === null) return undefined;
  const body = segment.slice(start[0].length);
  let depth = 0;
  let stepAt: number | undefined;
  let closeAt: number | undefined;
  for (const token of body.matchAll(/\\[\\`]|`[^`]*`|[();]/g)) {
    const at = token.index;
    if (token[0] === "(") depth++;
    if (token[0] === ")") {
      if (depth === 0) {
        closeAt = at;
        break;
      }
      depth--;
    }
    if (depth === 0 && stepAt === undefined && body.startsWith(STEP_START, at)) stepAt = at;
  }
  if (closeAt === undefined) return undefined;
  const cited = body.slice(0, stepAt ?? closeAt);
  if (cited.trim() === "") return undefined;
  return {
    yes: start[1] === "yes",
    written: start[2] ?? "",
    cited,
    step: stepAt === undefined ? undefined : body.slice(stepAt + STEP_START.length, closeAt),
    suffix: body.slice(closeAt + 1),
  };
}

// Why grep -E and a JavaScript regular expression could read a pattern in two ways, or none.
export function patternProblem(pattern: string): string | undefined {
  if (pattern.trim() === "") return "it is empty";
  if (/\\[A-Za-z0-9]/.test(pattern)) return "it has a backslash before a letter or a digit";
  if (pattern.includes("[[")) return 'it has "[["';
  if (pattern.includes("(?")) return 'it has "(?"';
  try {
    new RegExp(pattern, "i");
  } catch {
    return "it does not compile";
  }
  return undefined;
}

export type Hit = { path: string; line: number; text: string };

// Match lines with a case-insensitive JavaScript regular expression.
export function searchLines(pattern: string, files: readonly LedgerFile[]): Hit[] {
  const regex = new RegExp(pattern, "i");
  return files.flatMap((file) => {
    // grep reads a last line with no newline, and no line after a final newline.
    const lines = file.text.endsWith("\n")
      ? file.text.slice(0, -1).split("\n")
      : file.text.split("\n");
    return lines.flatMap((text, index) =>
      regex.test(text) ? [{ path: file.path, line: index + 1, text }] : [],
    );
  });
}

type SearchedRow = {
  where: string;
  answer: NonNullable<ReturnType<typeof answerParts>>;
  row: { path: string; line: number; cell: string; id: number };
  // The files that the pattern reads, and the ids of the ledger rows.
  searched: readonly LedgerFile[];
  ids: ReadonlySet<number>;
};

function searchProblems(input: SearchedRow): string[] {
  const { where, answer, row, searched, ids } = input;
  const { yes, written, cited, step, suffix } = answer;
  const pattern = written.replaceAll("\\|", "|");
  const why = patternProblem(pattern);
  if (why !== undefined)
    return [
      `${where}: the search pattern \`${written}\` is not allowed: ${why} (pull-request.md).`,
    ];
  const citedIds = cited.match(WHOLE_DQ_ID) ?? [];
  if (citedIds.length === 0 && cited.trim() !== "none")
    return [`${where}: the search \`${written}\` must cite hit ids or use "none".`];
  const hits = searchLines(pattern, searched).filter(
    (hit) => hit.path !== row.path || hit.line !== row.line,
  );
  const hitIds = new Set(hits.flatMap((hit) => hit.text.match(WHOLE_DQ_ID) ?? []));
  const problems = citedIds
    .filter((id) => !hitIds.has(id))
    .map(
      (id) =>
        `${where}: the search \`${written}\` finds ${id} in no line other than this row; cite only ids of its hits (owner, 2026-11-19, morning Q4 A).`,
    );
  if (/^\s*:/.test(suffix))
    problems.push(
      `${where}: a colon continues the answer after its closing ")". Put hits inside the answer or move the note before it.`,
    );
  if (!yes) {
    if (step !== undefined) problems.push(`${where}: a no has a §9 step.`);
    return problems;
  }
  const ownerDate = OWNER_STEP.exec(step ?? "")?.[1];
  const proposal = numberOf(PROPOSAL_STEP.exec(step ?? "")?.[1]);
  if (ownerDate !== undefined && !isGregorianDate(ownerDate))
    problems.push(`${where}: the owner step date is not a real date.`);
  if (ownerDate === undefined && proposal === undefined && step !== FIXED_STEP)
    return [...problems, `${where} answers yes and names no §9 step: add ${STEP_HINT}.`];
  if (proposal === row.id && !row.cell.startsWith("Proposal:"))
    problems.push(
      `${where}: the §9 proposal ${dq(proposal)} is this row; name the row of the proposal.`,
    );
  else if (proposal !== undefined && !ids.has(proposal))
    problems.push(`${where}: the §9 proposal ${dq(proposal)} is not a row of the ledger files.`);
  return problems;
}

function answerProblems(
  files: readonly LedgerFile[],
  otherSearchFiles: readonly LedgerFile[],
): string[] {
  const searched = [...files, ...otherSearchFiles];
  const ids = new Set(
    files.flatMap((file) => file.text.split("\n").flatMap((line) => issueId(line) ?? [])),
  );
  return files.flatMap((file) =>
    file.text.split("\n").flatMap((line, index) => {
      const id = issueId(line);
      if (id === undefined) return [];
      const oldForm = id >= OLD_FORM.first && id <= OLD_FORM.last;
      if (!oldForm && id < FIRST_SEARCHED_ID) return [];
      const cells = cellsOf(line);
      if (cells[6] === "withdrawn") return [];
      const cell = cells[8] ?? "";
      const where = `${file.path}: ${dq(id)}`;
      if (oldForm) {
        if (OLD_ANSWER.test(cell)) return [];
        return [
          `${where} has no "Same cause: yes|no (search: …)" in its "Fix and verification" cell (AGENTS.md §9; rows ${dq(OLD_FORM.first)} to ${dq(OLD_FORM.last)}).`,
        ];
      }
      const formProblem = `${where} has no "Same cause: yes|no (search: \`<pattern>\`: <hits>)" in its "Fix and verification" cell (AGENTS.md §9; each row from ${dq(FIRST_SEARCHED_ID)} on).`;
      const markers = [...cell.matchAll(/\\[\\`]|`[^`]*`|(Same cause:)/g)].filter(
        (token) => token[1] !== undefined,
      );
      if (markers.length === 0) return [formProblem];
      return markers.flatMap((marker, n) => {
        const answer = answerParts(cell.slice(marker.index, markers[n + 1]?.index));
        if (answer === undefined) return [formProblem];
        return searchProblems({
          where,
          answer,
          row: { path: file.path, line: index + 1, cell, id },
          searched,
          ids,
        });
      });
    }),
  );
}

// Every problem: the structure of the files, then each owned cell that differs from the rows.
// A search of a row also reads `otherSearchFiles`: docs/delivery-quality-prevention.md and the lessons.
// `checkedOnly` files get the structure checks and are never a source of counts.
export function checkCounts(
  files: readonly LedgerFile[],
  {
    otherSearchFiles = [],
    checkedOnly = [],
  }: { otherSearchFiles?: readonly LedgerFile[]; checkedOnly?: readonly LedgerFile[] } = {},
): string[] {
  const { ledger, problems } = readLedger(files, checkedOnly);
  if (ledger === undefined) return problems;
  // A stale cell counted from broken rows would mislead, and `--write` refuses to write then.
  const structure = structureProblems(ledger);
  if (structure.length > 0) return [...structure, ...answerProblems(files, otherSearchFiles)];
  return [...answerProblems(files, otherSearchFiles), ...staleProblems(ledger)];
}

// The files with each owned cell written from the rows. With a structure problem, no file changes.
export function writeCounts(
  files: readonly LedgerFile[],
  checkedOnly: readonly LedgerFile[] = [],
): {
  files: LedgerFile[];
  problems: string[];
} {
  const { ledger, problems } = readLedger(files, checkedOnly);
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
      const ids = file.text.split("\n").flatMap((line) => issueId(line) ?? []);
      if (ids.length === 0) return [];
      return [
        `${file.path} has ledger rows (${formatIds(ids)}) and is not in LEDGER_FILES of scripts/records-counts.ts: add it there.`,
      ];
    });
}
