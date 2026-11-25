// Pure: compare Git snapshots that the CLI reads for the reviewer.
import { type IssueRow, type LedgerFile, formProblems, issueRows } from "./records-counts.ts";

type CellPair = { heading: string; before: string; after: string };
type WordPair = { before: string[]; after: string[] };

function rowsById(files: readonly LedgerFile[]): Map<string, IssueRow> {
  const problems = formProblems(files);
  if (problems.length > 0) throw new Error(problems.join(" "));
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

// Store the length of the longest common subsequence for each pair of suffixes.
function commonWordLengths({ before, after }: WordPair): Uint32Array[] {
  const lengths = [new Uint32Array(after.length + 1)];
  for (const word of before.toReversed()) {
    const next = lengths.at(-1);
    const row = new Uint32Array(after.length + 1);
    for (let index = after.length - 1; index >= 0; index--) {
      row[index] =
        word === after[index]
          ? 1 + (next?.[index + 1] ?? 0)
          : Math.max(next?.[index] ?? 0, row[index + 1] ?? 0);
    }
    lengths.push(row);
  }
  return lengths.reverse();
}

function unmatchedWords({ before, after }: WordPair): WordPair {
  const lengths = commonWordLengths({ before, after });
  const unmatchedBefore: string[] = [];
  const unmatchedAfter: string[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  for (;;) {
    const oldWord = before[oldIndex];
    const newWord = after[newIndex];
    if (oldWord === undefined || newWord === undefined) break;

    if (oldWord === newWord) {
      oldIndex++;
      newIndex++;
    } else if (
      (lengths[oldIndex]?.[newIndex + 1] ?? 0) > (lengths[oldIndex + 1]?.[newIndex] ?? 0)
    ) {
      unmatchedAfter.push(newWord);
      newIndex++;
    } else {
      unmatchedBefore.push(oldWord);
      oldIndex++;
    }
  }
  return {
    before: unmatchedBefore.concat(before.slice(oldIndex)),
    after: unmatchedAfter.concat(after.slice(newIndex)),
  };
}

function lostWords(cell: CellPair): string[] {
  if (cell.before === cell.after) return [];
  const before = cell.before.match(/\S+/g) ?? [];
  const after = cell.after.match(/\S+/g) ?? [];
  const unmatched = unmatchedWords({ before, after });

  // Cancel words that moved to a different position in the same cell.
  const kept = new Map<string, number>();
  for (const word of unmatched.after) kept.set(word, (kept.get(word) ?? 0) + 1);

  return unmatched.before.filter((word) => {
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
  const aligned = alignedCells({ before, after });
  if (aligned !== undefined && !shrank(raw) && !aligned.some(shrank)) return [];
  const cells = aligned ?? [raw];

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
