import type { SkillId } from "@cty1ng/shared/ids";
import {
  slugProblem,
  type Skill,
  type SkillImportPreview,
  type SkillImportResult,
  type SkillImportRow,
} from "@cty1ng/shared/skills";
import { DomainError } from "../errors.ts";
import { findSensitive, sensitiveLabel } from "../guard/sensitive-data.rules.ts";
import type { Clock } from "../ports/clock.ts";
import type { Readers, SkillRecord, UnitOfWork } from "../ports/repositories.ts";
import { readSettings } from "../settings/settings.service.ts";
import { lineDiff } from "./skill-diff.ts";
import { parseSkillMd } from "./skill-md.ts";
import { skillTextProblem } from "./skill.rules.ts";
import type { SkillsService } from "./skills.service.ts";

// Skill import (domain-model.md §3.5, D5): a preview that writes nothing, then an Apply of the
// ticked rows in one transaction. The zip adapter and the CLI turn a zip or a folder into
// `ImportFolder`s, so this service never touches files.

export interface ImportFolder {
  // The top folder name, which must be the skill's slug.
  folder: string;
  // SKILL.md: its bytes, `too_large` when the reader did not open it (security.md §2.4), or
  // `missing`.
  skillMd: Uint8Array | "too_large" | "missing";
  // Every other file of the folder, never opened.
  skippedFiles: string[];
}

// What a row saw at preview time; Apply checks all of it again (spec gap pass #9).
interface Seen {
  skillId: SkillId | null;
  rowVersion: number | null;
  latestVersion: number | null;
  authorId: string | null;
  deprecated: boolean;
  trashed: boolean;
}

interface StoredRow {
  row: SkillImportRow;
  seen: Seen;
  description: string;
  bodyMd: string;
}

interface StoredPreview {
  id: string;
  actor: string;
  file: string;
  expiresAt: number;
  rows: Map<string, StoredRow>;
  // Set while an Apply runs, so a second Apply of the same preview gets `preview_expired`.
  applying: boolean;
}

export function createSkillImportService(deps: {
  uow: UnitOfWork;
  readers: Readers;
  skills: SkillsService;
  clock: Clock;
  previewMinutes: number;
  previewMax: number;
}) {
  // Insertion order is age order, so the first key is the oldest preview.
  const previews = new Map<string, StoredPreview>();

  function dropExpired(): void {
    const now = deps.clock.now().getTime();
    for (const [id, preview] of previews) if (preview.expiresAt <= now) previews.delete(id);
  }

  async function seenNow(reader: Readers["skills"], slug: string): Promise<Seen> {
    const skill = await reader.bySlug(slug);
    if (skill === null) {
      return {
        skillId: null,
        rowVersion: null,
        latestVersion: null,
        authorId: null,
        deprecated: false,
        trashed: false,
      };
    }
    return {
      skillId: skill.id,
      rowVersion: skill.rowVersion,
      latestVersion: (await reader.latestVersion(skill.id))?.version ?? null,
      authorId: skill.authorId,
      deprecated: skill.deprecatedAt !== null,
      trashed: skill.trashedAt !== null,
    };
  }

  async function previewRow(
    folder: ImportFolder,
    actor: string,
    limits: { nameMax: number; bodyMax: number },
  ): Promise<StoredRow> {
    const slug = folder.folder;
    const base = {
      slug,
      // A new skill gets its slug as its name; a slug longer than skill_name_max is refused
      // below, never cut (domain-model.md §3.5, §10).
      name: slug,
      from_version: null,
      to_version: null,
      diff: null,
      skipped_files: folder.skippedFiles,
    };
    const empty = { description: "", bodyMd: "" };
    const seen = await seenNow(deps.readers.skills, slug);
    const invalid = (reason: string): StoredRow => ({
      row: { ...base, status: "invalid", reason },
      seen,
      ...empty,
    });

    const problem = slugProblem(slug);
    if (problem === "reserved") return invalid("This slug is reserved. Rename the folder.");
    if (problem !== null) {
      return invalid(
        "The folder name is not a slug. Use lowercase letters, digits and single hyphens.",
      );
    }
    if (folder.skillMd === "missing") return invalid("The folder has no SKILL.md.");
    if (folder.skillMd === "too_large") return invalid("SKILL.md is larger than 1 MB.");
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(folder.skillMd);
    } catch {
      return invalid("SKILL.md is not UTF-8 text.");
    }
    const parsed = parseSkillMd(text);
    if ("invalid" in parsed) return invalid(parsed.invalid);
    if (parsed.slug !== slug) {
      return invalid(`The name in SKILL.md is "${parsed.slug}", not the folder name.`);
    }
    const textProblem = skillTextProblem(
      { description: parsed.description, bodyMd: parsed.bodyMd },
      limits,
    );
    if (textProblem !== null) return invalid(textProblem.message);

    const content = { description: parsed.description, bodyMd: parsed.bodyMd };
    const conflict = (reason: string, name: string): StoredRow => ({
      row: { ...base, name, status: "conflict", reason },
      seen,
      ...content,
    });
    if (seen.skillId === null) {
      if (slug.length > limits.nameMax) {
        return invalid(
          `The folder name is the new skill's name, and it has ${String(slug.length)} characters. The limit is ${String(limits.nameMax)}. Rename the folder.`,
        );
      }
      return {
        row: { ...base, status: "new", reason: null, to_version: 1 },
        seen,
        ...content,
      };
    }
    const skill = await deps.readers.skills.byId(seen.skillId);
    const latest = await deps.readers.skills.latestVersion(seen.skillId);
    if (skill === null || latest === null) return invalid("The skill changed. Preview again.");
    if (seen.trashed) return conflict("This skill is in Trash.", skill.name);
    if (seen.authorId !== actor) {
      return conflict(
        `${authorLabel(skill, actor)} made this skill. Only the author can add a version.`,
        skill.name,
      );
    }
    if (seen.deprecated) return conflict("Deprecated. Make it active again to import.", skill.name);
    if (latest.description === parsed.description && latest.bodyMd === parsed.bodyMd) {
      return {
        row: {
          ...base,
          name: skill.name,
          status: "unchanged",
          reason: null,
          from_version: latest.version,
        },
        seen,
        ...content,
      };
    }
    // A new version is refused while the saved name is over a lowered limit (§10).
    if (skill.name.length > limits.nameMax) {
      return invalid(
        `The skill's name has ${String(skill.name.length)} characters. The limit is ${String(limits.nameMax)}. Rename the skill, then import again.`,
      );
    }
    return {
      row: {
        ...base,
        name: skill.name,
        status: "changed",
        reason: null,
        from_version: latest.version,
        to_version: latest.version + 1,
        diff: {
          description:
            latest.description === parsed.description
              ? null
              : lineDiff(latest.description, parsed.description),
          body: lineDiff(latest.bodyMd, parsed.bodyMd),
        },
      },
      seen,
      ...content,
    };
  }

  return {
    // Writes nothing (domain-model.md §3.5).
    preview: async (
      file: string,
      folders: readonly ImportFolder[],
      actor: string,
    ): Promise<SkillImportPreview> => {
      // The file name goes into every changelog ("Imported from {file}"), so the guard reads it
      // (security.md §2.13).
      const [match] = findSensitive(file);
      if (match !== undefined) {
        throw new DomainError(
          "sensitive_data",
          `The file name looks like ${sensitiveLabel(match.kind)}. The app does not save secrets in skills. Rename the file.`,
          "file",
        );
      }
      const settings = await readSettings(deps.readers.settings);
      const limits = { nameMax: settings.skill_name_max, bodyMax: settings.skill_body_max };
      const rows = new Map<string, StoredRow>();
      const sorted = [...folders].sort((a, b) => a.folder.localeCompare(b.folder));
      for (const folder of sorted) rows.set(folder.folder, await previewRow(folder, actor, limits));

      dropExpired();
      while (previews.size >= deps.previewMax) {
        const oldest = previews.keys().next().value;
        if (oldest === undefined) break;
        previews.delete(oldest);
      }
      const id = globalThis.crypto.randomUUID();
      previews.set(id, {
        id,
        actor,
        file,
        expiresAt: deps.clock.now().getTime() + deps.previewMinutes * 60_000,
        rows,
        applying: false,
      });
      return { preview_id: id, file, rows: [...rows.values()].map((stored) => stored.row) };
    },

    // Applies the ticked `new` and `changed` rows in one transaction, or nothing.
    apply: async (
      previewId: string,
      slugs: readonly string[],
      actor: string,
    ): Promise<SkillImportResult> => {
      dropExpired();
      const preview = previews.get(previewId);
      if (preview?.actor !== actor || preview.applying) {
        throw new DomainError(
          "preview_expired",
          "This preview is gone: it expired, was applied, or the app restarted. Preview again.",
        );
      }
      if (slugs.length === 0) {
        throw new DomainError("validation_error", "Tick at least one skill to apply.", "slugs");
      }
      const picked = slugs.map((slug) => {
        const stored = preview.rows.get(slug);
        if (stored === undefined || !["new", "changed"].includes(stored.row.status)) {
          throw new DomainError(
            "validation_error",
            `${slug} is not a new skill or a new version in this preview.`,
            "slugs",
          );
        }
        return stored;
      });

      // Claimed before the first await; a failed Apply frees it again (a stale_write keeps the
      // preview, and nothing was written).
      preview.applying = true;
      const result = await deps.uow
        .run(async (tx) => {
          const ids: SkillId[] = [];
          let created = 0;
          let newVersions = 0;
          for (const stored of picked) {
            const now = await seenNow(tx.skills, stored.row.slug);
            if (!sameSeen(now, stored.seen)) {
              throw new DomainError(
                "stale_write",
                "A skill changed after the preview. The app applied nothing. Preview again.",
              );
            }
            const changelog = `Imported from ${preview.file}`;
            if (stored.row.status === "new") {
              ids.push(
                await deps.skills.createInTx(
                  tx,
                  {
                    slug: stored.row.slug,
                    name: stored.row.name,
                    description: stored.description,
                    bodyMd: stored.bodyMd,
                    changelog,
                  },
                  actor,
                ),
              );
              created += 1;
            } else if (stored.seen.skillId !== null && stored.seen.latestVersion !== null) {
              await deps.skills.addVersionInTx(
                tx,
                stored.seen.skillId,
                {
                  baseVersion: stored.seen.latestVersion,
                  description: stored.description,
                  bodyMd: stored.bodyMd,
                  changelog,
                  upgradeBotIds: [],
                },
                actor,
              );
              ids.push(stored.seen.skillId);
              newVersions += 1;
            }
          }
          return { ids, created, newVersions };
        })
        .finally(() => {
          preview.applying = false;
        });
      previews.delete(previewId);
      const skills: Skill[] = [];
      for (const id of result.ids) skills.push(await deps.skills.summary(id, actor));
      return { created: result.created, new_versions: result.newVersions, skills };
    },
  };
}

function sameSeen(a: Seen, b: Seen): boolean {
  return (
    a.skillId === b.skillId &&
    a.rowVersion === b.rowVersion &&
    a.latestVersion === b.latestVersion &&
    a.authorId === b.authorId &&
    a.deprecated === b.deprecated &&
    a.trashed === b.trashed
  );
}

// Phase 1 has one owner; another author shows by id (only tests reach this, D14).
function authorLabel(skill: SkillRecord, actor: string): string {
  return skill.authorId === actor ? "You" : skill.authorId;
}

export type SkillImportService = ReturnType<typeof createSkillImportService>;
