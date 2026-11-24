// Pure: compare Git snapshots that the CLI reads for the reviewer.
import { type IssueRow, type LedgerFile, issueRows } from "./records-counts.ts";

type CellPair = { heading: string; before: string; after: string };

function rowsById(files: readonly LedgerFile[]): Map<string, IssueRow> {
  const rows = new Map<string, IssueRow>();
  for (const row of issueRows(files)) {
    const previous = rows.get(row.id);
    if (previous !== undefined) {
      throw new Error(`${row.id} is in both ${previous.path} and ${row.path}`);
    }
    rows.set(row.id, row);
  }
  return rows;
}

function cellsByHeading(row: IssueRow): Map<string, string> | undefined {
  if (row.headers.length !== row.cells.length) return undefined;
  const cells = new Map(row.headers.map((heading, index) => [heading, row.cells[index] ?? ""]));
  return cells.size === row.headers.length ? cells : undefined;
}

function alignedCells(pair: { before: IssueRow; after: IssueRow }): CellPair[] | undefined {
  const before = cellsByHeading(pair.before);
  const after = cellsByHeading(pair.after);
  if (before === undefined || after === undefined || before.size !== after.size) return undefined;

  const pairs: CellPair[] = [];
  for (const [heading, oldCell] of before) {
    const newCell = after.get(heading);
    if (newCell === undefined) return undefined;
    pairs.push({ heading, before: oldCell, after: newCell });
  }
  return pairs;
}

function lostWords(cell: CellPair): string[] {
  const kept = new Map<string, number>();
  for (const word of cell.after.match(/\S+/g) ?? []) kept.set(word, (kept.get(word) ?? 0) + 1);

  return (cell.before.match(/\S+/g) ?? []).filter((word) => {
    const count = kept.get(word) ?? 0;
    if (count === 0) return true;
    kept.set(word, count - 1);
    return false;
  });
}

function shrank(cell: Pick<CellPair, "before" | "after">): boolean {
  return Buffer.byteLength(cell.after) < Buffer.byteLength(cell.before);
}

function compareRows({ before, after }: { before: IssueRow; after: IssueRow }): string[] {
  const raw = { heading: "raw row", before: before.raw, after: after.raw };
  const cells = alignedCells({ before, after }) ?? [raw];
  if (!shrank(raw) && !cells.some(shrank)) return [];

  const prefix = `${before.id} ${before.path} -> ${after.path}`;
  return cells.flatMap((cell) => {
    const words = lostWords(cell);
    return words.length === 0 ? [] : [`${prefix} [${cell.heading}]: ${words.join(" ")}`];
  });
}

export function removedWords(input: {
  base: readonly LedgerFile[];
  head: readonly LedgerFile[];
}): string[] {
  const base = rowsById(input.base);
  const head = rowsById(input.head);
  const report: string[] = [];
  for (const [id, before] of base) {
    const after = head.get(id);
    if (after === undefined) continue;
    report.push(...compareRows({ before, after }));
  }
  return report;
}
