import {
  skillFieldProblem,
  slugFieldProblem,
  type SkillLimits,
  type SkillTextField,
} from "@cty1ng/shared/skills";
import type { ErrorCode } from "@cty1ng/shared/errors";
import { findSensitive, sensitiveLabel } from "../guard/sensitive-data.rules.ts";

// Checks on skill text (domain-model.md §3.1, security.md §2.5 and §2.13). Pure: the limits come
// in from the settings, and the result says what is wrong; the service refuses. The empty, limit
// and slug messages are in `shared/` so the editor shows the same ones
// (design/components/skills-page.md §4, §6); the secret check is here only.

export type { SkillLimits };

export interface SkillProblem {
  code: ErrorCode;
  field: SkillTextField | "changelog";
  message: string;
}

export interface SkillText {
  slug?: string | undefined;
  name?: string | undefined;
  description?: string | undefined;
  bodyMd?: string | undefined;
  // Optional and never empty-checked, but saved and shown, so the guard reads it.
  changelog?: string | undefined;
}

const NOUN: Record<SkillProblem["field"], string> = {
  slug: "slug",
  name: "name",
  description: "description",
  body_md: "body",
  changelog: "changelog",
};

// The first problem, in field order, or null. Only the fields that are given are checked. The
// guard (D39, security.md §2.13) reads every saved field: the slug and the changelog too.
export function skillTextProblem(text: SkillText, limits: SkillLimits): SkillProblem | null {
  if (text.slug !== undefined) {
    const problem = slugTextProblem(text.slug);
    if (problem !== null) return problem;
  }
  const fields: [SkillTextField, string | undefined][] = [
    ["name", text.name],
    ["description", text.description],
    ["body_md", text.bodyMd],
  ];
  for (const [field, value] of fields) {
    if (value === undefined) continue;
    const message = skillFieldProblem(field, value, limits);
    if (message !== null) return { code: "validation_error", field, message };
  }
  const guarded: [SkillProblem["field"], string | undefined][] = [
    ["slug", text.slug],
    ...fields,
    ["changelog", text.changelog],
  ];
  for (const [field, value] of guarded) {
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
  const message = slugFieldProblem(slug);
  return message === null ? null : { code: "validation_error", field: "slug", message };
}
