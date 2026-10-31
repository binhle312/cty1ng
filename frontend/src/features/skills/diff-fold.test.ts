import type { DiffLine } from "@cty1ng/shared/skills";
import { describe, expect, it } from "vitest";
import { foldDiff } from "./diff-fold.ts";

const same = (n: number, from = 0): DiffLine[] =>
  Array.from({ length: n }, (_, k) => ({ op: "same", text: `s${String(from + k)}` }));
const add: DiffLine = { op: "add", text: "new" };
const del: DiffLine = { op: "del", text: "old" };

const shape = (lines: DiffLine[]) =>
  foldDiff(lines, 2).map((chunk) => `${chunk.kind}:${String(chunk.lines.length)}`);

// skills-page.md §13: unchanged runs fold as "{n} lines with no change · Show".
describe("foldDiff", () => {
  it("keeps the unchanged lines next to a change and folds the rest", () => {
    expect(shape([...same(10), del, add, ...same(10, 10)])).toEqual([
      "fold:8",
      "lines:6",
      "fold:8",
    ]);
  });

  it("keeps context on both sides of a run between two changes", () => {
    expect(shape([add, ...same(10), add])).toEqual(["lines:3", "fold:6", "lines:3"]);
  });

  it("does not fold a run that is only one line longer than the context", () => {
    expect(shape([add, ...same(5), add])).toEqual(["lines:7"]);
  });

  it("folds a text with no change into one fold", () => {
    expect(shape(same(4))).toEqual(["fold:4"]);
  });

  it("returns nothing for no lines", () => {
    expect(foldDiff([])).toEqual([]);
  });
});
