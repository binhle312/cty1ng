import { describe, expect, it } from "vitest";
import {
  copyName,
  copySlug,
  skillFieldProblem,
  slugFieldProblem,
  slugFromName,
  slugProblem,
} from "./skills.ts";

describe("slugFromName (skills-page.md §4)", () => {
  it.each([
    ["Write user stories", "write-user-stories"],
    ["Viết câu chuyện", "viet-cau-chuyen"],
    ["Đặt lịch", "dat-lich"],
    ["  --Hello,  World!--  ", "hello-world"],
    ["Café 2.0", "cafe-2-0"],
    ["日本語のスキル", ""],
    ["", ""],
  ])("%j → %j", (name, slug) => {
    expect(slugFromName(name)).toBe(slug);
  });

  it("cuts at 64 characters with no hyphen at the cut", () => {
    const slug = slugFromName(`${"a".repeat(63)} b`);
    expect(slug).toBe("a".repeat(63));
    expect(slugFromName("x".repeat(70))).toHaveLength(64);
  });

  it("always gives a valid slug or an empty one", () => {
    for (const name of ["Ä--ß", "a__b", "-x-", "ĐĐ đ", "Mix 9 Ünï"]) {
      const slug = slugFromName(name);
      expect(slug === "" || slugProblem(slug) === null).toBe(true);
    }
  });
});

describe("slugProblem (domain-model.md §3.1)", () => {
  it.each([
    ["write-user-stories", null],
    ["a", null],
    ["a1-b2", null],
    ["", "empty"],
    ["a".repeat(65), "too_long"],
    ["-a", "pattern"],
    ["a-", "pattern"],
    ["a--b", "pattern"],
    ["A", "pattern"],
    ["a_b", "pattern"],
    ["new", "reserved"],
    ["import", "reserved"],
  ])("%j → %j", (slug, problem) => {
    expect(slugProblem(slug)).toBe(problem);
  });
});

describe("copies (skills-page.md §12)", () => {
  it("adds -copy, then -copy-2 and up while taken", () => {
    const taken = new Set(["notes-copy", "notes-copy-2"]);
    expect(copySlug("notes", () => false)).toBe("notes-copy");
    expect(copySlug("notes", (slug) => taken.has(slug))).toBe("notes-copy-3");
  });

  it("cuts the base so the suffix stays within 64", () => {
    const long = "a".repeat(64);
    expect(copySlug(long, () => false)).toBe(`${"a".repeat(59)}-copy`);
    const slug = copySlug(long, (s) => s.endsWith("-copy"));
    expect(slug).toBe(`${"a".repeat(57)}-copy-2`);
    expect(slugProblem(slug)).toBeNull();
  });

  it("cuts the name so the copy fits the name limit", () => {
    expect(copyName("Notes", 64)).toBe("Notes (copy)");
    expect(copyName("n".repeat(64), 64)).toHaveLength(64);
    expect(copyName("n".repeat(64), 64).endsWith(" (copy)")).toBe(true);
  });
});

// One set of messages for the editor and the server (skills-page.md §4, §6).
describe("skillFieldProblem", () => {
  const limits = { nameMax: 16, bodyMax: 1000 };

  it("asks for an empty field and names the limit of a long one", () => {
    expect(skillFieldProblem("name", "  ", limits)).toBe("Type a name.");
    expect(skillFieldProblem("body_md", "", limits)).toBe("Type the steps.");
    expect(skillFieldProblem("name", "n".repeat(17), limits)).toBe(
      "The name has 17 characters. The limit is 16. Make it shorter.",
    );
    expect(skillFieldProblem("body_md", "b".repeat(1001), limits)).toBe(
      "The body has 1,001 characters. The limit is 1,000. Make it shorter.",
    );
    expect(skillFieldProblem("description", "d".repeat(1024), limits)).toBeNull();
  });

  it("gives the slug rule's message for each slug problem", () => {
    expect(slugFieldProblem("")).toBe("Type a slug.");
    expect(slugFieldProblem("Bad_Slug")).toBe(
      "Use lowercase letters, digits and single hyphens, not at the start or end.",
    );
    expect(slugFieldProblem("import")).toBe("This slug is reserved. Type a different one.");
    expect(slugFieldProblem("s".repeat(65))).toBe(
      "The slug has 65 characters. The limit is 64. Make it shorter.",
    );
    expect(skillFieldProblem("slug", "ok-slug", limits)).toBeNull();
  });
});
