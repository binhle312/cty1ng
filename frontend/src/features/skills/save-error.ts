import type { SkillTextField } from "@cty1ng/shared/skills";
import { apiErrorText, readApiError } from "../../lib/api/api-error.ts";

// Where the editor shows a failed save (skills-page.md §6): under the field that the server
// named (a taken slug, a limit, a likely secret), or in the save bar.
// The skill changed in another place while this tab has unsaved changes: the edit stays, and
// Discard loads the new text (skills-page.md, "Texts added in the M1b build").
export const CONFLICT_TEXT =
  "This skill changed in another place. Your changes are kept here. Copy what you need, then Discard to load the new text.";

export const CLONE_LOAD_FAILED = "The app could not load the skill to copy.";

export type SaveError =
  { field: SkillTextField; message: string } | { field: null; message: string };

const FIELDS: readonly string[] = ["slug", "name", "description", "body_md"];

function isTextField(field: string | undefined): field is SkillTextField {
  return field !== undefined && FIELDS.includes(field);
}

// The toast of a Save or a Create that failed after the owner left the page: nothing on a page
// shows the failure then (skills-page.md, "Edge cases"; the bot page has the same rule).
export function lostSaveText({
  name,
  error,
  verb = "save",
}: {
  name: string;
  error: unknown;
  verb?: "save" | "create";
}): string {
  if (readApiError(error)?.code === "stale_write") {
    return `${name} changed in another place, so the app did not save your change.`;
  }
  const failure = saveErrorOf(error);
  // A field outside the form, such as the changelog, has a reason too.
  return failure.field === null && readApiError(error)?.field === undefined
    ? `Could not ${verb} ${name}. Try again.`
    : `Could not ${verb} ${name}: ${failure.message}`;
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
