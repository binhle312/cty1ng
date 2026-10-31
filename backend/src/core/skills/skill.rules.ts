import { SKILL_FORMAT, slugProblem } from "@cty1ng/shared/skills";
import type { ErrorCode } from "@cty1ng/shared/errors";
import { findSensitive, sensitiveLabel } from "../guard/sensitive-data.rules.ts";

// Checks on skill text (domain-model.md §3.1, security.md §2.5 and §2.13). Pure: the limits come
// in from the settings, and the result says what is wrong; the service refuses. The messages
// are the editor's (design/components/skills-page.md §4, §6).

export interface SkillLimits {
  nameMax: number;
  bodyMax: number;
}

export interface SkillProblem {
  code: ErrorCode;
  field: "slug" | "name" | "description" | "body_md";
  message: string;
}

export interface SkillText {
  slug?: string | undefined;
  name?: string | undefined;
  description?: string | undefined;
  bodyMd?: string | undefined;
}

const EMPTY: Record<SkillProblem["field"], string> = {
  slug: "Type a slug.",
  name: "Type a name.",
  description: "Type a description.",
  body_md: "Type the steps.",
};

const NOUN: Record<SkillProblem["field"], string> = {
  slug: "slug",
  name: "name",
  description: "description",
  body_md: "body",
};

// The first problem, in field order, or null. Only the fields that are given are checked.
export function skillTextProblem(text: SkillText, limits: SkillLimits): SkillProblem | null {
  if (text.slug !== undefined) {
    const problem = slugTextProblem(text.slug);
    if (problem !== null) return problem;
  }
  const fields: [SkillProblem["field"], string | undefined, number][] = [
    ["name", text.name, limits.nameMax],
    ["description", text.description, SKILL_FORMAT.descriptionMax],
    ["body_md", text.bodyMd, limits.bodyMax],
  ];
  for (const [field, value, max] of fields) {
    if (value === undefined) continue;
    if (value.trim() === "") return { code: "validation_error", field, message: EMPTY[field] };
    if (value.length > max) {
      return {
        code: "validation_error",
        field,
        message: `The ${NOUN[field]} has ${count(value.length)} characters. The limit is ${count(max)}. Make it shorter.`,
      };
    }
  }
  for (const [field, value] of fields) {
    if (value === undefined) continue;
    const [match] = findSensitive(value);
    if (match === undefined) continue;
    const where = field === "body_md" ? `Line ${String(match.line)}` : `The ${NOUN[field]}`;
    return {
      code: "sensitive_data",
      field,
      message: `${where} looks like ${sensitiveLabel(match.kind)}. The app does not save secrets in skills. Remove it.`,
    };
  }
  return null;
}

export function slugTextProblem(slug: string): SkillProblem | null {
  const problem = slugProblem(slug);
  if (problem === null) return null;
  const message = {
    empty: EMPTY.slug,
    too_long: `The slug has ${count(slug.length)} characters. The limit is ${String(SKILL_FORMAT.slugMax)}. Make it shorter.`,
    pattern: "Use lowercase letters, digits and single hyphens, not at the start or end.",
    reserved: "This slug is reserved. Type a different one.",
  }[problem];
  return { code: "validation_error", field: "slug", message };
}

function count(n: number): string {
  return n.toLocaleString("en-US");
}
