import {
  formatCount,
  type SkillLimits,
  skillFieldMax,
  skillFieldProblem,
  slugFromName,
  type SkillTextField,
} from "@cty1ng/shared/skills";

// The editor's state and rules, without React (skills-page.md §4–§6, §14). The limits come
// from `GET /settings`, and the messages from `shared/`, so the editor and the server refuse
// the same text.

export interface SkillFields {
  name: string;
  slug: string;
  description: string;
  body_md: string;
}

export interface SkillForm {
  // The saved text (or the empty or cloned text of a new skill), for Discard and for counting
  // changes.
  saved: SkillFields;
  current: SkillFields;
  // A new skill takes its slug from the name until the owner edits the slug (§4).
  slugEdited: boolean;
  isNew: boolean;
}

export const EDITOR_FIELDS = ["name", "slug", "description", "body_md"] as const;

export function newForm(fields: SkillFields, isNew: boolean): SkillForm {
  return { saved: fields, current: fields, slugEdited: false, isNew };
}

export function setField(form: SkillForm, field: SkillTextField, value: string): SkillForm {
  const current = { ...form.current, [field]: value };
  if (field === "slug") return { ...form, current, slugEdited: true };
  if (field === "name" && form.isNew && !form.slugEdited) current.slug = slugFromName(value);
  return { ...form, current };
}

export function discard(form: SkillForm): SkillForm {
  return { ...form, current: form.saved, slugEdited: false };
}

// The fields that differ from the saved text, in page order. The slug counts only for a new
// skill: it is fixed after Create.
export function changedFields(form: SkillForm): SkillTextField[] {
  return EDITOR_FIELDS.filter(
    (field) => (field !== "slug" || form.isNew) && form.current[field] !== form.saved[field],
  );
}

export function isDirty(form: SkillForm): boolean {
  return changedFields(form).length > 0;
}

// What Save does (§5): nothing, a rename only (no version), or a new version (with the rename
// in the same request when the name changed too).
export type SaveKind = "none" | "rename" | "version";

export function saveKind(form: SkillForm): SaveKind {
  const changed = changedFields(form);
  if (changed.length === 0) return "none";
  return changed.every((field) => field === "name") ? "rename" : "version";
}

export function changesLine(count: number): string {
  return count === 1 ? "1 change not saved" : `${String(count)} changes not saved`;
}

// One message per field, or null. The slug is checked only for a new skill.
export function fieldProblems(
  form: SkillForm,
  limits: SkillLimits,
): Record<SkillTextField, string | null> {
  const check = (field: SkillTextField) => skillFieldProblem(field, form.current[field], limits);
  return {
    name: check("name"),
    slug: form.isNew ? check("slug") : null,
    description: check("description"),
    body_md: check("body_md"),
  };
}

export function hasProblem(problems: Record<SkillTextField, string | null>): boolean {
  return Object.values(problems).some((problem) => problem !== null);
}

// "12 / 64"; `over` turns the counter `danger` (§6).
export function counter(
  field: SkillTextField,
  value: string,
  limits: SkillLimits,
): { text: string; over: boolean } {
  const max = skillFieldMax(field, limits);
  return {
    text: `${formatCount(value.length)} / ${formatCount(max)}`,
    over: value.length > max,
  };
}

export function lineCount(text: string): number {
  return text === "" ? 0 : text.split("\n").length;
}

// A warning only (§6): bots read the whole body each time they load it.
export function bodyLinesWarning(body: string, warnLines: number): string | null {
  const lines = lineCount(body);
  if (lines <= warnLines) return null;
  return `The body has ${formatCount(lines)} lines. Bots read the full body each time they load it. Try to keep it under ${formatCount(warnLines)} lines.`;
}

const FIELD_WORDS: Record<SkillTextField, string> = {
  name: "the name",
  slug: "the slug",
  description: "the description",
  body_md: "the body",
};

// The Leave without saving text names the changed fields (§14): "You changed the description
// and the body of Write user stories."
export function leaveText(form: SkillForm, skillName: string): string {
  const words = changedFields(form).map((field) => FIELD_WORDS[field]);
  const list =
    words.length <= 1
      ? (words[0] ?? "")
      : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1] ?? ""}`;
  return `You changed ${list} of ${skillName}. The app has not saved them yet. Stay and save, or let them go.`;
}
