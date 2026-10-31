import type { SkillTextField } from "@cty1ng/shared/skills";
import { apiErrorText, readApiError } from "../../lib/api/api-error.ts";

// Where the editor shows a failed save (skills-page.md §6): under the field that the server
// named (a taken slug, a limit, a likely secret), or in the save bar.
export type SaveError =
  { field: SkillTextField; message: string } | { field: null; message: string };

const FIELDS: readonly string[] = ["slug", "name", "description", "body_md"];

function isTextField(field: string | undefined): field is SkillTextField {
  return field !== undefined && FIELDS.includes(field);
}

export function saveErrorOf(error: unknown): SaveError {
  const body = readApiError(error);
  if (body === null) return { field: null, message: apiErrorText(error) };
  if (body.code === "slug_taken") {
    return { field: "slug", message: "This slug exists. Type a different one." };
  }
  if (body.code === "stale_write") {
    return {
      field: null,
      message: "This skill changed in another place. Reload the page to see the change.",
    };
  }
  if (isTextField(body.field)) return { field: body.field, message: body.message };
  return { field: null, message: body.message };
}
