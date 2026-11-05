import { describe, expect, it } from "vitest";
import { parseSkillMd, serialiseSkillMd } from "./skill-md.ts";

describe("SKILL.md", () => {
  it("parses the frontmatter and the body", () => {
    const text = "---\nname: write-user-stories\ndescription: Write stories.\n---\n\n# Write\n";
    expect(parseSkillMd(text)).toEqual({
      slug: "write-user-stories",
      description: "Write stories.",
      bodyMd: "# Write\n",
    });
  });

  it("accepts CRLF and other standard keys", () => {
    const text = "---\r\nname: a\r\ndescription: d\r\nlicense: MIT\r\n---\r\nBody";
    expect(parseSkillMd(text)).toEqual({ slug: "a", description: "d", bodyMd: "Body" });
  });

  it.each([
    ["no frontmatter", "# Just a body", "The file has no frontmatter between --- lines."],
    ["bad YAML", "---\nname: [a\n---\n", "The frontmatter is not valid YAML."],
    [
      "no description",
      "---\nname: a\n---\nx",
      "The frontmatter needs a name and a description, both text.",
    ],
    [
      "a custom tag",
      "---\nname: !!js/function x\ndescription: d\n---\n",
      "The frontmatter is not valid YAML.",
    ],
    [
      // Review of PR #52: parsing passed and toJS() threw, so the whole preview failed (500).
      "nested aliases (a YAML bomb)",
      `---\na: &a [x, x, x, x, x, x, x, x, x, x]\nb: &b [*a, *a, *a, *a, *a, *a, *a, *a, *a, *a]\nc: &c [*b, *b, *b, *b, *b, *b, *b, *b, *b, *b]\nname: a\ndescription: d\n---\n`,
      "The frontmatter is not valid YAML.",
    ],
  ])("reports %s", (_label, text, reason) => {
    expect(parseSkillMd(text)).toEqual({ invalid: reason });
  });

  // Audit 2026-11-05, row 5. The parse time grows with the square of the keys, and the server
  // waits for it. 40,000 keys took 12.4 s. The owner approved 8 KB on 2026-11-05.
  describe("the frontmatter limit of 8,192 characters", () => {
    const LIMIT = 8_192;
    const tooLarge = { invalid: "The frontmatter is larger than 8 KB." };

    // A frontmatter of exactly `length` characters, with a filler comment that YAML ignores.
    function withFrontmatter(length: number): string {
      const start = "name: a\ndescription: d\n# ";
      return `---\n${start}${"x".repeat(length - start.length)}\n---\nBody`;
    }

    it("accepts a frontmatter at the limit", () => {
      expect(parseSkillMd(withFrontmatter(LIMIT))).toEqual({
        slug: "a",
        description: "d",
        bodyMd: "Body",
      });
    });

    it("reports a frontmatter one character over the limit", () => {
      expect(parseSkillMd(withFrontmatter(LIMIT + 1))).toEqual(tooLarge);
    });

    it("reports 40,000 keys at once, with no parse", () => {
      const keys = Array.from({ length: 40_000 }, (_, index) => `key${String(index)}: 1`);
      const text = `---\nname: a\ndescription: d\n${keys.join("\n")}\n---\n`;
      const start = performance.now();
      expect(parseSkillMd(text)).toEqual(tooLarge);
      expect(performance.now() - start).toBeLessThan(500);
    });

    // Every character of this description needs a 4-character YAML escape.
    it("still round-trips the longest description, with full escaping", () => {
      const skill = { slug: "a", description: "\u0001".repeat(1_024), bodyMd: "# A\n" };
      expect(parseSkillMd(serialiseSkillMd(skill))).toEqual(skill);
    });

    it("sets no limit on the body", () => {
      const bodyMd = "x".repeat(1_000_000);
      expect(parseSkillMd(`---\nname: a\ndescription: d\n---\n${bodyMd}`)).toEqual({
        slug: "a",
        description: "d",
        bodyMd,
      });
    });

    it("finds no closing --- line in a 1 MB file quickly", () => {
      const start = performance.now();
      expect(parseSkillMd(`---\n${"\n--".repeat(330_000)}`)).toEqual({
        invalid: "The file has no frontmatter between --- lines.",
      });
      expect(performance.now() - start).toBeLessThan(500);
    });
  });

  it("round-trips, also a description with YAML characters", () => {
    const skill = { slug: "a", description: "Use when: the owner asks # for it", bodyMd: "# A\n" };
    expect(parseSkillMd(serialiseSkillMd(skill))).toEqual(skill);
  });

  // Review of PR #52: the parser trimmed the description and every leading blank line of the
  // body, so an untouched export imported as `changed`.
  it("round-trips a description with outer spaces and a body that starts with blank lines", () => {
    const skill = { slug: "a", description: " Use it. ", bodyMd: "\n\n# A\n" };
    expect(parseSkillMd(serialiseSkillMd(skill))).toEqual(skill);
  });

  // Review of PR #52: the parser turned CRLF into LF in the body too.
  it("keeps CRLF line endings in the body and the description", () => {
    const skill = {
      slug: "a",
      description: "Line one\r\nline two",
      bodyMd: "\r\n# A\r\n\r\n1. Do it.\r\n",
    };
    expect(parseSkillMd(serialiseSkillMd(skill))).toEqual(skill);
    expect(parseSkillMd("---\r\nname: a\r\ndescription: d\r\n---\r\n\r\nx\r\ny")).toEqual({
      slug: "a",
      description: "d",
      bodyMd: "x\r\ny",
    });
  });
});
