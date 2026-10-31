import type { SkillTextField } from "@cty1ng/shared/skills";
import { apiErrorText, readApiError } from "../../lib/api/api-error.ts";

// Where the editor shows a failed save (skills-page.md §6): under the field that the server
// named (a taken slug, a limit, a likely secret), or in the save bar.
// The skill changed in another place while this tab has unsaved changes: the edit stays, and
// Discard loads the new text (skills-page.md, "Texts added in the M1b build").
export const CONFLICT_TEXT =
  "This skill changed in another place. Your changes are kept here. Copy what you need, then Discard to load the new text.";

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
    // The skill page loads the newest version at once and keeps the edit (owner, 2026-10-31).
    return { field: null, message: CONFLICT_TEXT };
  }
  if (isTextField(body.field)) return { field: body.field, message: body.message };
  return { field: null, message: body.message };
}
