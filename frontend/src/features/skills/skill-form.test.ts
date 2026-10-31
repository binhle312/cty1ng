import { SETTING_DEFAULTS } from "@cty1ng/shared/settings";
import { describe, expect, it } from "vitest";
import {
  bodyLinesWarning,
  changedFields,
  counter,
  discard,
  fieldProblems,
  hasProblem,
  leaveText,
  markSaved,
  newForm,
  saveKind,
  setField,
  type SkillFields,
} from "./skill-form.ts";

const LIMITS = {
  nameMax: SETTING_DEFAULTS.skill_name_max,
  bodyMax: SETTING_DEFAULTS.skill_body_max,
};
const EMPTY: SkillFields = { name: "", slug: "", description: "", body_md: "" };
const SAVED: SkillFields = {
  name: "Write user stories",
  slug: "write-user-stories",
  description: "Use it for stories.",
  body_md: "## Steps\n1. Read.",
};

// skills-page.md §4 (new skill), §5 (save bar), §6 (errors), §14 (leave), UI-7.3.
describe("the skill editor form", () => {
  it("makes the slug from the name until the owner edits the slug", () => {
    let form = setField(newForm(EMPTY, true), "name", "Viết câu chuyện");
    expect(form.current.slug).toBe("viet-cau-chuyen");
    form = setField(form, "name", "Đặt lịch");
    expect(form.current.slug).toBe("dat-lich");
    form = setField(form, "slug", "my-slug");
    form = setField(form, "name", "Something else");
    expect(form.current.slug).toBe("my-slug");
  });

  it("cuts a slug from a long name at 64 characters, with no hyphen at the cut", () => {
    const form = setField(newForm(EMPTY, true), "name", `${"a".repeat(63)} bcd`);
    expect(form.current.slug).toBe("a".repeat(63));
  });

  it("gives an empty slug for a name with no Latin letters", () => {
    const form = setField(newForm(EMPTY, true), "name", "ユーザーストーリー");
    expect(form.current.slug).toBe("");
    expect(fieldProblems(form, LIMITS).slug).toBe("Type a slug.");
  });

  it("does not change the slug of a saved skill", () => {
    const form = setField(newForm(SAVED, false), "name", "New name");
    expect(form.current.slug).toBe(SAVED.slug);
    expect(fieldProblems(form, LIMITS).slug).toBeNull();
  });

  it("refuses a reserved or malformed slug with the editor's text", () => {
    const form = (slug: string) => setField(newForm(SAVED, true), "slug", slug);
    expect(fieldProblems(form("new"), LIMITS).slug).toBe(
      "This slug is reserved. Type a different one.",
    );
    expect(fieldProblems(form("import"), LIMITS).slug).toBe(
      "This slug is reserved. Type a different one.",
    );
    expect(fieldProblems(form("Bad_Slug"), LIMITS).slug).toBe(
      "Use lowercase letters, digits and single hyphens, not at the start or end.",
    );
    expect(fieldProblems(form("a--b"), LIMITS).slug).not.toBeNull();
  });

  it("asks for every field of a new skill", () => {
    const problems = fieldProblems(newForm(EMPTY, true), LIMITS);
    expect(problems).toEqual({
      name: "Type a name.",
      slug: "Type a slug.",
      description: "Type a description.",
      body_md: "Type the steps.",
    });
    expect(hasProblem(problems)).toBe(true);
  });

  it("uses the limits from the settings, so a lowered skill_name_max refuses a name", () => {
    const form = setField(newForm(SAVED, false), "name", "x".repeat(20));
    expect(fieldProblems(form, LIMITS).name).toBeNull();
    expect(fieldProblems(form, { ...LIMITS, nameMax: 16 }).name).toBe(
      "The name has 20 characters. The limit is 16. Make it shorter.",
    );
    expect(counter("name", form.current.name, { ...LIMITS, nameMax: 16 })).toEqual({
      text: "20 / 16",
      over: true,
    });
  });

  it("counts the description against 1,024 and writes the error with commas", () => {
    const form = setField(newForm(SAVED, false), "description", "d".repeat(1047));
    expect(fieldProblems(form, LIMITS).description).toBe(
      "The description has 1,047 characters. The limit is 1,024. Make it shorter.",
    );
    expect(counter("description", "d".repeat(80), LIMITS)).toEqual({
      text: "80 / 1,024",
      over: false,
    });
  });

  it("warns, without an error, when the body has more lines than skill_body_warn_lines", () => {
    const body = Array.from({ length: 612 }, () => "x").join("\n");
    expect(bodyLinesWarning(body, 500)).toBe(
      "The body has 612 lines. Bots read the full body each time they load it. Try to keep it under 500 lines.",
    );
    expect(bodyLinesWarning(body, 700)).toBeNull();
    const form = setField(newForm(SAVED, false), "body_md", body);
    expect(hasProblem(fieldProblems(form, LIMITS))).toBe(false);
  });

  it("saves a rename only without a version, and a rename with new text as a version", () => {
    const saved = newForm(SAVED, false);
    expect(saveKind(saved)).toBe("none");
    const renamed = setField(saved, "name", "Stories");
    expect(saveKind(renamed)).toBe("rename");
    expect(saveKind(setField(renamed, "body_md", "## Steps\n1. Write."))).toBe("version");
    expect(saveKind(setField(saved, "description", "Other."))).toBe("version");
  });

  it("counts a field changed back to its saved text as not changed, and Discard puts it back", () => {
    let form = setField(newForm(SAVED, false), "description", "Other.");
    expect(changedFields(form)).toEqual(["description"]);
    form = setField(form, "description", SAVED.description);
    expect(changedFields(form)).toEqual([]);
    form = discard(setField(form, "body_md", "x"));
    expect(form.current).toEqual(SAVED);
  });

  it("names the changed fields when the owner leaves", () => {
    let form = setField(newForm(SAVED, false), "description", "Other.");
    expect(leaveText(form, "Write user stories")).toBe(
      "You changed the description of Write user stories. The app has not saved them yet. Stay and save, or let them go.",
    );
    form = setField(form, "body_md", "x");
    expect(leaveText(form, "Write user stories")).toContain(
      "You changed the description and the body of Write user stories.",
    );
    form = setField(form, "name", "y");
    expect(leaveText(form, "y")).toContain("You changed the name, the description and the body");
  });
});

describe("markSaved", () => {
  it("keeps edits typed while the save was pending as changes", () => {
    const start = newForm(SAVED, false);
    const sent = setField(start, "description", "Sent text.");
    const typedLater = setField(sent, "body_md", "Typed while saving.");
    const after = markSaved(typedLater, sent.current);
    expect(after.saved).toEqual(sent.current);
    expect(after.current.body_md).toBe("Typed while saving.");
    expect(changedFields(after)).toEqual(["body_md"]);
  });
});
