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

  it("round-trips, also a description with YAML characters", () => {
    const skill = { slug: "a", description: "Use when: the owner asks # for it", bodyMd: "# A\n" };
    expect(parseSkillMd(serialiseSkillMd(skill))).toEqual(skill);
  });
});
