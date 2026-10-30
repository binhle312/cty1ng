import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkDecisions, checkFolderIndexes, checkStoryRanges } from "./lib/check-index.ts";

let root: string;

function write(path: string, text = ""): void {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

function table(...names: string[]): string {
  return [
    "# x",
    "",
    "| File | What it is for |",
    "| --- | --- |",
    ...names.map((n) => `| \`${n}\` | x |`),
  ].join("\n");
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "check-index-"));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("folder indexes (AC7)", () => {
  const patterns = ["pkg", "pkg/features/*"];

  it("passes when the table lists every file and subfolder", () => {
    write("pkg/README.md", table("a.ts", "features/"));
    write("pkg/a.ts");
    write("pkg/a.test.ts");
    write("pkg/features/x/README.md", table("x.ts"));
    write("pkg/features/x/x.ts");
    expect(checkFolderIndexes(root, patterns)).toEqual([]);
  });

  it("fails when a file is not listed", () => {
    write("pkg/README.md", table("a.ts"));
    write("pkg/a.ts");
    write("pkg/new-file.ts");
    expect(checkFolderIndexes(root, patterns)).toEqual([
      "pkg/README.md: `new-file.ts` is in the folder but not in the table",
    ]);
  });

  it("fails when the table lists a file that does not exist", () => {
    write("pkg/README.md", table("a.ts", "gone.ts"));
    write("pkg/a.ts");
    expect(checkFolderIndexes(root, patterns)).toEqual([
      "pkg/README.md: the table lists `gone.ts`, which does not exist",
    ]);
  });

  it("fails when a subfolder is not listed", () => {
    write("pkg/README.md", table("a.ts"));
    write("pkg/a.ts");
    write("pkg/sub/b.ts");
    expect(checkFolderIndexes(root, patterns)).toEqual([
      "pkg/README.md: `sub` is in the folder but not in the table",
    ]);
  });

  it("fails when an indexed folder has no README.md", () => {
    write("pkg/README.md", table("features/"));
    write("pkg/features/x/x.ts");
    expect(checkFolderIndexes(root, patterns)).toEqual([
      "pkg/features/x/: indexed folder has no README.md",
    ]);
  });

  it("checks that nested rows exist without requiring them", () => {
    write("pkg/README.md", table("src/", "src/a.ts", "src/missing.ts"));
    write("pkg/src/a.ts");
    write("pkg/src/b.ts");
    expect(checkFolderIndexes(root, patterns)).toEqual([
      "pkg/README.md: the table lists `src/missing.ts`, which does not exist",
    ]);
  });

  it("ignores folders that do not exist yet", () => {
    expect(checkFolderIndexes(root, patterns)).toEqual([]);
  });
});

describe("story id ranges", () => {
  const readme = [
    "| File | Stories | Acceptance criteria |",
    "| --- | --- | --- |",
    "| [shell.md](shell.md) | SH-1 to SH-3 | UI-1 |",
  ].join("\n");

  it("passes when every id is in range and the last id exists", () => {
    write("req/README.md", readme);
    write("req/shell.md", "- **SH-1.** a\n- **SH-3.** c\n- **UI-1.2** not a story id\n");
    expect(checkStoryRanges(join(root, "req"))).toEqual([]);
  });

  it("fails on an id outside the range", () => {
    write("req/README.md", readme);
    write("req/shell.md", "- **SH-1.** a\n- **SH-3.** c\n- **SH-4.** d\n");
    expect(checkStoryRanges(join(root, "req"))).toEqual([
      "requirements/shell.md: SH-4 is outside SH-1 to SH-3",
    ]);
  });

  it("fails when the last id of the range does not exist", () => {
    write("req/README.md", readme);
    write("req/shell.md", "- **SH-1.** a\n");
    expect(checkStoryRanges(join(root, "req"))).toEqual([
      "requirements/shell.md: the last id of the range, SH-3, does not exist",
    ]);
  });

  it("fails on a file with story ids and no range", () => {
    write("req/README.md", readme);
    write("req/shell.md", "- **SH-3.** c\n");
    write("req/other.md", "- **OT-1.** a\n");
    expect(checkStoryRanges(join(root, "req"))).toEqual([
      "requirements/other.md: has story ids but no range in requirements/README.md",
    ]);
  });
});

describe("decisions index", () => {
  function index(...rows: string[]): string {
    return ["| Id | Decision | Status | Changed by |", "| --- | --- | --- | --- |", ...rows].join(
      "\n",
    );
  }

  it("passes when the index matches the metadata lines", () => {
    write("dec/D01-a.md", "# D01\nStatus: accepted\n");
    write("dec/D02-b.md", "# D02\nStatus: accepted\nAmends: D01\n");
    write(
      "dec/README.md",
      index("| D1 | [a](D01-a.md) | accepted | D02 |", "| D2 | [b](D02-b.md) | accepted | |"),
    );
    expect(checkDecisions(join(root, "dec"))).toEqual([]);
  });

  it("fails when `Amends:` names a decision that does not exist", () => {
    write("dec/D01-a.md", "Amends: D09\n");
    write("dec/README.md", index("| D1 | [a](D01-a.md) | accepted | |"));
    expect(checkDecisions(join(root, "dec"))).toEqual([
      "decisions/D01-a.md: `Amends:` names D09, which does not exist",
    ]);
  });

  it("fails when Changed by misses an amending decision", () => {
    write("dec/D01-a.md", "");
    write("dec/D02-b.md", "Supersedes: D01\n");
    write(
      "dec/README.md",
      index("| D1 | [a](D01-a.md) | superseded by D02 | |", "| D2 | [b](D02-b.md) | accepted | |"),
    );
    expect(checkDecisions(join(root, "dec"))).toEqual([
      'decisions/README.md: D01 "Changed by" misses D02, whose metadata line names D01',
    ]);
  });

  it("fails when Changed by lists a decision that does not amend it", () => {
    write("dec/D01-a.md", "");
    write("dec/D02-b.md", "");
    write(
      "dec/README.md",
      index("| D1 | [a](D01-a.md) | accepted | D02 |", "| D2 | [b](D02-b.md) | accepted | |"),
    );
    expect(checkDecisions(join(root, "dec"))).toEqual([
      'decisions/README.md: D01 "Changed by" lists D02, but D02 has no `Amends:` or `Supersedes:` line naming D01 and no dated amendment backs it',
    ]);
  });

  it("accepts a decision named by a dated amendment (the D19 case)", () => {
    write("dec/D01-a.md", "**Amended 2026-10-27 (owner).** D02 changed the path.\n");
    write("dec/D02-b.md", "");
    write(
      "dec/README.md",
      index(
        "| D1 | [a](D01-a.md) | accepted | D02 (amendment 2026-10-27) |",
        "| D2 | [b](D02-b.md) | accepted | |",
      ),
    );
    expect(checkDecisions(join(root, "dec"))).toEqual([]);
  });

  it("fails on a dated amendment that the decision file does not have", () => {
    write("dec/D01-a.md", "");
    write("dec/D02-b.md", "");
    write(
      "dec/README.md",
      index(
        "| D1 | [a](D01-a.md) | accepted | D02 (amendment 2026-10-27) |",
        "| D2 | [b](D02-b.md) | accepted | |",
      ),
    );
    expect(checkDecisions(join(root, "dec"))).toHaveLength(1);
  });

  it("fails on a decision with no row and on a row that links to a missing file", () => {
    write("dec/D01-a.md", "");
    write("dec/D02-b.md", "");
    write(
      "dec/README.md",
      index("| D1 | [a](D01-a.md) | accepted | |", "| D3 | [c](D03-c.md) | accepted | |"),
    );
    expect(checkDecisions(join(root, "dec"))).toEqual([
      "decisions/README.md: D02 has 0 index rows, expected 1 (D02-b.md)",
      "decisions/README.md: the D03 row links to D03-c.md, which does not exist",
    ]);
  });
});
