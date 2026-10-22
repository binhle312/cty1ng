import { describe, expect, it } from "vitest";
import { checkIndexes, listedNames } from "./check-index";

const readme = (...names: string[]): string =>
  [
    "# folder",
    "",
    "| File | What it is for |",
    "| --- | --- |",
    ...names.map((n) => `| \`${n}\` | x |`),
  ].join("\n");

function run(files: string[], readmes: Record<string, string>): string[] {
  return checkIndexes({
    files,
    readFile: (path) => readmes[path],
    folders: ["pkg/src/*"],
  });
}

describe("AC7: check:index (architecture.md §4.2)", () => {
  it("passes when the table lists every file and subfolder", () => {
    const files = [
      "pkg/src/a/README.md",
      "pkg/src/a/one.ts",
      "pkg/src/a/one.test.ts",
      "pkg/src/a/sub/x.ts",
    ];
    expect(run(files, { "pkg/src/a/README.md": readme("one.ts", "sub/") })).toEqual([]);
  });

  it("AC7: fails when a file is added without being listed", () => {
    const files = ["pkg/src/a/README.md", "pkg/src/a/one.ts", "pkg/src/a/unlisted.ts"];
    expect(run(files, { "pkg/src/a/README.md": readme("one.ts") })).toEqual([
      "pkg/src/a/README.md: does not list unlisted.ts",
    ]);
  });

  it("AC7: fails when the table lists a file that does not exist", () => {
    const files = ["pkg/src/a/README.md", "pkg/src/a/one.ts"];
    expect(run(files, { "pkg/src/a/README.md": readme("one.ts", "gone.ts") })).toEqual([
      "pkg/src/a/README.md: lists gone.ts, which does not exist",
    ]);
  });

  it("fails when an indexed folder has no README.md", () => {
    expect(run(["pkg/src/b/one.ts"], {})).toEqual(["pkg/src/b/: missing README.md index"]);
  });

  it("does not list tests, README.md or generated/", () => {
    const files = ["pkg/src/a/README.md", "pkg/src/a/x.test.tsx", "pkg/src/a/generated/client.ts"];
    expect(run(files, { "pkg/src/a/README.md": readme() })).toEqual([]);
  });

  it("reads names from the first cell, with or without backticks or a trailing slash", () => {
    expect(
      listedNames("| File | What |\n| --- | --- |\n| `a.ts` | x |\n| sub/ | y |\n| `dir` | z |"),
    ).toEqual(["a.ts", "sub/", "dir"]);
  });
});
