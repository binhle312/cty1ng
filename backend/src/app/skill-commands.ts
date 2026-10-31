import { basename } from "node:path";
import type { SkillImportRow } from "@cty1ng/shared/skills";
import { DomainError } from "../core/errors.ts";
import { OWNER_ID } from "../core/owner.ts";
import type { compose } from "./compose.ts";
import { isNewOrEmpty, readSkillFolders, writeSkillFolders } from "./skill-folders.ts";

// The `skills` CLI commands (api.md §2). They call the same services as the API. `trash` and
// `restore` are temporary: M5b's Trash page replaces them, and M5b removes them (owner,
// 2026-10-30).

type Backend = Pick<ReturnType<typeof compose>, "skills" | "skillImport" | "readers">;
type Out = (line: string) => void;

export async function importSkills(
  backend: Backend,
  folder: string,
  apply: boolean,
  out: Out,
): Promise<number> {
  const preview = await backend.skillImport.preview(
    basename(folder),
    readSkillFolders(folder),
    OWNER_ID,
  );
  for (const row of preview.rows) out(rowLine(row));
  const good = preview.rows.filter((row) => row.status === "new" || row.status === "changed");
  const bad = preview.rows.some((row) => row.status === "invalid" || row.status === "conflict");
  if (good.length === 0) {
    out("Nothing to import.");
  } else if (!apply) {
    out(`Nothing written. Run again with --apply to import ${countOf(good.length, "skill")}.`);
  } else {
    const result = await backend.skillImport.apply(
      preview.preview_id,
      good.map((row) => row.slug),
      OWNER_ID,
    );
    out(
      `Imported: ${countOf(result.created, "new skill")}, ${countOf(result.new_versions, "new version")}.`,
    );
  }
  return bad ? 1 : 0;
}

export async function exportSkills(
  backend: Backend,
  folder: string,
  slugs: readonly string[],
  out: Out,
): Promise<number> {
  if (!isNewOrEmpty(folder)) {
    out(`${folder} is not empty. Choose an empty or new folder.`);
    return 1;
  }
  const ids = [];
  for (const slug of slugs) {
    const skill = await backend.readers.skills.bySlug(slug);
    if (skill === null || skill.trashedAt !== null) {
      out(`No skill with the slug ${slug}.`);
      return 1;
    }
    ids.push(skill.id);
  }
  const { files } = await backend.skills.exportFiles(slugs.length === 0 ? null : ids);
  writeSkillFolders(folder, files);
  out(`Exported ${countOf(files.length, "skill")} to ${folder}.`);
  return 0;
}

export async function listTrash(backend: Backend, out: Out): Promise<number> {
  const trashed = await backend.readers.skills.trashed();
  if (trashed.length === 0) out("Trash has no skills.");
  for (const skill of trashed) {
    out(`${skill.slug}  ${skill.name}  (in Trash since ${skill.trashedAt?.toISOString() ?? "?"})`);
  }
  return 0;
}

export async function restoreSkill(backend: Backend, slug: string, out: Out): Promise<number> {
  const skill = await backend.readers.skills.bySlug(slug);
  if (skill?.trashedAt == null) {
    out(`No skill with the slug ${slug} is in Trash.`);
    return 1;
  }
  await backend.skills.restore(skill.id, OWNER_ID);
  out(`Restored ${slug}. It is still deprecated; make it active on its page.`);
  return 0;
}

// A refused write prints its message; anything else is a bug and goes up.
export async function reportDomainErrors(work: () => Promise<number>, out: Out): Promise<number> {
  try {
    return await work();
  } catch (error) {
    if (!(error instanceof DomainError)) throw error;
    out(error.message);
    return 1;
  }
}

function rowLine(row: SkillImportRow): string {
  const versions =
    row.status === "new"
      ? "v1"
      : row.status === "changed"
        ? `v${String(row.from_version)} -> v${String(row.to_version)}`
        : row.status === "unchanged"
          ? `v${String(row.from_version)}`
          : (row.reason ?? "");
  const skipped =
    row.skipped_files.length === 0 ? "" : `  (skipped: ${row.skipped_files.join(", ")})`;
  return `${row.status.padEnd(9)} ${row.slug.padEnd(28)} ${versions}${skipped}`;
}

function countOf(n: number, noun: string): string {
  return `${String(n)} ${noun}${n === 1 ? "" : "s"}`;
}
