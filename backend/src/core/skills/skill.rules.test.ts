import { describe, expect, it } from "vitest";
import { skillTextProblem } from "./skill.rules.ts";

const limits = { nameMax: 64, bodyMax: 20_000 };
const good = { slug: "notes", name: "Notes", description: "Use it.", bodyMd: "## Steps" };

describe("skillTextProblem (skills-page.md §6)", () => {
  it("accepts good text", () => {
    expect(skillTextProblem(good, limits)).toBeNull();
  });

  it.each([
    [{ slug: "new" }, "slug", "This slug is reserved. Type a different one."],
    [
      { slug: "a--b" },
      "slug",
      "Use lowercase letters, digits and single hyphens, not at the start or end.",
    ],
    [{ name: "  " }, "name", "Type a name."],
    [{ description: "" }, "description", "Type a description."],
    [{ bodyMd: "\n" }, "body_md", "Type the steps."],
    [
      { description: "d".repeat(1047) },
      "description",
      "The description has 1,047 characters. The limit is 1,024. Make it shorter.",
    ],
    [
      { name: "n".repeat(65) },
      "name",
      "The name has 65 characters. The limit is 64. Make it shorter.",
    ],
    [
      { bodyMd: "b".repeat(20_001) },
      "body_md",
      "The body has 20,001 characters. The limit is 20,000. Make it shorter.",
    ],
  ])("%j → %s: %s", (change, field, message) => {
    expect(skillTextProblem({ ...good, ...change }, limits)).toEqual({
      code: "validation_error",
      field,
      message,
    });
  });

  it("uses the limits it is given (settings)", () => {
    expect(skillTextProblem({ name: "n".repeat(20) }, { nameMax: 16, bodyMax: 1000 })?.field).toBe(
      "name",
    );
  });

  it("refuses a likely secret in any field and names the body line", () => {
    const body = "# Steps\n\n1. Call the API\n2. Use sk-proj-abcdefghijklmnop9f2a";
    expect(skillTextProblem({ ...good, bodyMd: body }, limits)).toEqual({
      code: "sensitive_data",
      field: "body_md",
      message: "Line 4 looks like an API key. The app does not save secrets in skills. Remove it.",
    });
    expect(skillTextProblem({ name: "password: hunter22" }, limits)).toMatchObject({
      code: "sensitive_data",
      field: "name",
      message:
        "The name looks like a password. The app does not save secrets in skills. Remove it.",
    });
  });

  // Review of PR #52: every saved field goes through the guard, not only the edited text.
  it("refuses a likely secret in the slug and in the changelog", () => {
    expect(
      skillTextProblem({ ...good, slug: "sk-proj-abcdefghijklmnop1234" }, limits),
    ).toMatchObject({
      code: "sensitive_data",
      field: "slug",
    });
    expect(skillTextProblem({ ...good, changelog: "password: hunter22" }, limits)).toEqual({
      code: "sensitive_data",
      field: "changelog",
      message:
        "The changelog looks like a password. The app does not save secrets in skills. Remove it.",
    });
    expect(skillTextProblem({ ...good, changelog: "" }, limits)).toBeNull();
  });

  it("checks only the fields it is given", () => {
    expect(skillTextProblem({ name: "Renamed" }, limits)).toBeNull();
  });
});
