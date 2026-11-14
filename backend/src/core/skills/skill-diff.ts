import type { DiffLine } from "@cty1ng/shared/skills";
import { type ChangeObject, diffLines } from "diff";

// A line diff of two texts, every line included (api.md §2, `GET /skills/{id}/diff`): the
// History tab folds the unchanged runs itself.
//
// `maxEdits` is the budget SKILL_DIFF_MAX_EDITS (architecture.md §8): the most added and removed
// lines that the diff looks for. The cost grows with the square of the budget, not with the
// length of the texts (DQ-037; the plan of P3 PR C has the measurement). Over the budget, the old
// text shows as removed and the new text as added (owner, 2026-11-06): still a correct diff, only
// not the shortest one. No time limit, because a time limit reads the clock.
export function lineDiff(texts: { from: string; to: string; maxEdits: number }): DiffLine[] {
  const changes: ChangeObject<string>[] = diffLines(texts.from, texts.to, {
    maxEditLength: texts.maxEdits,
  }) ?? [
    { value: texts.from, removed: true, added: false, count: 0 },
    { value: texts.to, removed: false, added: true, count: 0 },
  ];
  const lines: DiffLine[] = [];
  for (const change of changes) {
    if (change.value === "") continue;
    const op = change.added ? "add" : change.removed ? "del" : "same";
    const text = change.value.endsWith("\n") ? change.value.slice(0, -1) : change.value;
    for (const line of text.split("\n")) lines.push({ op, text: line });
  }
  return lines;
}
