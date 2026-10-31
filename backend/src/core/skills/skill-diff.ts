import type { DiffLine } from "@cty1ng/shared/skills";
import { diffLines } from "diff";

// A line diff of two texts, every line included (api.md §2, `GET /skills/{id}/diff`): the
// History tab folds the unchanged runs itself.
export function lineDiff(from: string, to: string): DiffLine[] {
  const lines: DiffLine[] = [];
  for (const change of diffLines(from, to)) {
    const op = change.added ? "add" : change.removed ? "del" : "same";
    const text = change.value.endsWith("\n") ? change.value.slice(0, -1) : change.value;
    for (const line of text.split("\n")) lines.push({ op, text: line });
  }
  return lines;
}
