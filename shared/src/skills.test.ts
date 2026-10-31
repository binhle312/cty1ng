import { describe, expect, it } from "vitest";
import { copyName, copySlug, slugFromName, slugProblem } from "./skills.ts";

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
