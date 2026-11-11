import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findSensitive } from "../../src/core/guard/sensitive-data.rules.ts";

// Real text with no secret, so each refused line is a false match (security.md §2.13). Skills and
// bots have no override, so a false match blocks a save. Examples cannot show how often that
// occurs in text that the owner can write, and this test can. It holds a limit for all the text,
// and it does not list shapes, so a new rule that refuses normal text fails here.
const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const FOLDERS = [
  { path: "seed/skills", types: [".md"] },
  { path: "docs", types: [".md"] },
  { path: ".agents/skills", types: [".md"] },
  { path: "backend/src", types: [".ts"] },
  { path: "frontend/src", types: [".ts", ".tsx"] },
  { path: "shared/src", types: [".ts"] },
];
// Text that quotes the guard's forms, or that holds fake secrets on purpose.
const LEFT_OUT =
  /\.test\.tsx?$|\/core\/guard\/|\/generated\/|docs\/(audits|lessons-learned)\/|docs\/(delivery-quality|delivery-quality-archive|security)\.md$/;
const MAX_REFUSED_LINES = 0;
// A smaller text means that a folder moved, and the limit would then prove less.
const MIN_LINES = 40_000;

function textFiles(): { name: string; text: string }[] {
  return FOLDERS.flatMap(({ path, types }) =>
    readdirSync(join(ROOT, path), { recursive: true, encoding: "utf8" })
      .map((file) => join(path, file))
      .filter((name) => types.includes(extname(name)) && !LEFT_OUT.test(name))
      .map((name) => ({
        name,
        text: readFileSync(join(ROOT, name), "utf8"),
      })),
  );
}

describe("the guard on real text with no secret", () => {
  const files = textFiles();

  it("reads enough text for the limit to mean something", () => {
    const lines = files.reduce((sum, file) => sum + file.text.split("\n").length, 0);
    expect(lines).toBeGreaterThanOrEqual(MIN_LINES);
  });

  it("refuses no more lines than the limit", () => {
    // Only the file, the line and the kind: the guard's rule is that the found text stays here.
    const refused = files.flatMap(({ name, text }) =>
      findSensitive(text).map((match) => `${name}:${match.line} ${match.kind}`),
    );
    expect(refused.length, refused.join("\n")).toBeLessThanOrEqual(MAX_REFUSED_LINES);
  });
});
