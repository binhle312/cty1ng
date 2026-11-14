import type { DiffLine } from "@cty1ng/shared/skills";
import { describe, expect, it } from "vitest";
import { lineDiff } from "./skill-diff.ts";

// The diff budget (audit 2026-11-05, DQ-037; owner 2026-11-06): over SKILL_DIFF_MAX_EDITS added
// and removed lines, the old text shows as removed and the new text as added.

// Applies a diff to its old text: the `same` and `del` lines must be the old text, and the
// `same` and `add` lines the new text.
const sides = (lines: DiffLine[]) => ({
  old: lines.filter((line) => line.op !== "add").map((line) => line.text),
  new: lines.filter((line) => line.op !== "del").map((line) => line.text),
});

describe("lineDiff", () => {
  it("keeps the unchanged lines when the change is inside the budget", () => {
    // One removed and one added line: an edit length of 2.
    expect(lineDiff({ from: "a\nb\nc", to: "a\nx\nc", maxEdits: 2 })).toEqual([
      { op: "same", text: "a" },
      { op: "del", text: "b" },
      { op: "add", text: "x" },
      { op: "same", text: "c" },
    ]);
  });

  it("shows the old text as removed and the new text as added over the budget", () => {
    expect(lineDiff({ from: "a\nb\nc", to: "a\nx\nc", maxEdits: 1 })).toEqual([
      { op: "del", text: "a" },
      { op: "del", text: "b" },
      { op: "del", text: "c" },
      { op: "add", text: "a" },
      { op: "add", text: "x" },
      { op: "add", text: "c" },
    ]);
  });

  it("gives a diff whose two sides are the two texts over the budget", () => {
    const from = Array.from({ length: 50 }, (_, i) => `old ${String(i)}`).join("\n");
    const to = Array.from({ length: 40 }, (_, i) => `new ${String(i)}`).join("\n");
    expect(sides(lineDiff({ from, to, maxEdits: 10 }))).toEqual({
      old: from.split("\n"),
      new: to.split("\n"),
    });
  });

  it("treats an empty old text over the budget as inside it", () => {
    expect(lineDiff({ from: "", to: "a\nb", maxEdits: 1 })).toEqual(
      lineDiff({ from: "", to: "a\nb", maxEdits: 100 }),
    );
  });
});
