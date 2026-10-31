import type { DiffLine } from "@cty1ng/shared/skills";

// The History tab folds long runs of unchanged lines (skills-page.md §13): "{n} lines with no
// change · Show". A few unchanged lines stay next to each change, so a change keeps its
// place in the text.
export const DIFF_CONTEXT_LINES = 3;

export type DiffChunk =
  { kind: "lines"; lines: DiffLine[] } | { kind: "fold"; key: number; lines: DiffLine[] };

export function foldDiff(lines: DiffLine[], context = DIFF_CONTEXT_LINES): DiffChunk[] {
  const chunks: DiffChunk[] = [];
  const show = (part: DiffLine[]) => {
    if (part.length === 0) return;
    const last = chunks[chunks.length - 1];
    if (last?.kind === "lines") last.lines.push(...part);
    else chunks.push({ kind: "lines", lines: [...part] });
  };
  let i = 0;
  while (i < lines.length) {
    const start = i;
    const line = lines[i];
    if (line?.op !== "same") {
      while (i < lines.length && lines[i]?.op !== "same") i += 1;
      show(lines.slice(start, i));
      continue;
    }
    while (i < lines.length && lines[i]?.op === "same") i += 1;
    const run = lines.slice(start, i);
    const keepBefore = start === 0 ? 0 : context;
    const keepAfter = i === lines.length ? 0 : context;
    const hidden = run.length - keepBefore - keepAfter;
    // One hidden line is shown: a fold of one line saves no space.
    if (hidden < 2) {
      show(run);
      continue;
    }
    show(run.slice(0, keepBefore));
    chunks.push({
      kind: "fold",
      key: start + keepBefore,
      lines: run.slice(keepBefore, run.length - keepAfter),
    });
    show(run.slice(run.length - keepAfter));
  }
  return chunks;
}
