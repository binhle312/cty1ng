import type {
  DiffLine,
  Skill,
  SkillDetail,
  SkillVersion,
  SkillVersionListItem,
} from "@cty1ng/shared/skills";
import { SkillId, SkillVersionId } from "@cty1ng/shared/ids";
import type { Settings } from "@cty1ng/shared/settings";
import { DomainError } from "../errors.ts";
import type { AppendEvent } from "../events/append-event.ts";
import type { Clock } from "../ports/clock.ts";
import type { Ids } from "../ports/ids.ts";
import type {
  Readers,
  SkillRecord,
  SkillsReader,
  SkillVersionRecord,
  Tx,
  UnitOfWork,
} from "../ports/repositories.ts";
import { readSettings } from "../settings/settings.service.ts";
import { lineDiff } from "./skill-diff.ts";
import { serialiseSkillMd } from "./skill-md.ts";
import { skillTextProblem, type SkillText } from "./skill.rules.ts";

// Skills (domain-model.md §3, api.md §2, D5, D6, D14, D49). Versions are never updated; every
// write to a `skills` row raises its `row_version`; every change writes its event in the same
// transaction. Bots and pins come with M2, so the bot lists here are always empty.

export interface SkillsDeps {
  uow: UnitOfWork;
  readers: Readers;
  appendEvent: AppendEvent;
  clock: Clock;
  ids: Ids;
}

export interface NewSkillInput {
  slug: string;
  name: string;
  description: string;
  bodyMd: string;
  clonedFromSkillVersionId?: SkillVersionId | undefined;
  changelog?: string | undefined;
}

export interface NewVersionInput {
  baseVersion: number;
  description: string;
  bodyMd: string;
  changelog?: string | undefined;
  upgradeBotIds: readonly string[];
  // A rename in the same Save (spec gap pass #2): both or neither.
  rename?: { name: string; rowVersion: number } | undefined;
}

export function createSkillsService(deps: SkillsDeps) {
  const { uow, readers, clock } = deps;
  const newVersionId = () => SkillVersionId.parse(deps.ids.newId("skillv"));

  async function liveSkill(reader: SkillsReader, id: SkillId): Promise<SkillRecord> {
    const skill = await reader.byId(id);
    // A skill in Trash answers 404 everywhere except restore and the permanent delete (api.md §2).
    if (skill === null || skill.trashedAt !== null) throw notFound();
    return skill;
  }

  async function trashedSkill(reader: SkillsReader, id: SkillId): Promise<SkillRecord> {
    const skill = await reader.byId(id);
    if (skill?.trashedAt == null) throw new DomainError("not_found", "No such skill in Trash.");
    return skill;
  }

  async function toShape(reader: SkillsReader, skill: SkillRecord, actor: string): Promise<Skill> {
    const latest = await reader.latestVersion(skill.id);
    // Invariant 25: a committed skill always has a version.
    if (latest === null) throw new Error(`skill ${skill.id} has no version`);
    return shape(reader, skill, latest, actor);
  }

  async function shape(
    reader: SkillsReader,
    skill: SkillRecord,
    latest: SkillVersionRecord,
    actor: string,
  ): Promise<Skill> {
    let clonedFrom: Skill["cloned_from"] = null;
    if (skill.clonedFromSkillVersionId !== null) {
      const source = await reader.versionById(skill.clonedFromSkillVersionId);
      const sourceSkill = source === null ? null : await reader.byId(source.skillId);
      if (source !== null && sourceSkill !== null) {
        clonedFrom = { skill_id: sourceSkill.id, slug: sourceSkill.slug, version: source.version };
      }
    }
    return {
      id: skill.id,
      slug: skill.slug,
      name: skill.name,
      author_id: skill.authorId,
      is_author: skill.authorId === actor,
      row_version: skill.rowVersion,
      latest_version: {
        version: latest.version,
        description: latest.description,
        changelog: latest.changelog,
        created_at: latest.createdAt.toISOString(),
      },
      bots_using: 0,
      bots_outdated: 0,
      deprecated: skill.deprecatedAt !== null,
      deprecated_at: skill.deprecatedAt?.toISOString() ?? null,
      updated_at: skill.updatedAt.toISOString(),
      cloned_from: clonedFrom,
    };
  }

  async function emitSkill(
    tx: Tx,
    type: "skill.created" | "skill.updated" | "skill.deprecated" | "skill.restored",
    id: SkillId,
    actor: string,
  ): Promise<Skill> {
    const skill = await tx.skills.byId(id);
    if (skill === null) throw new Error(`skill ${id} vanished in its own transaction`);
    const data = { skill: await toShape(tx.skills, skill, actor) };
    await deps.appendEvent(tx, { event: { type, data }, conversationId: null });
    return data.skill;
  }

  async function emitTrashCount(tx: Tx): Promise<void> {
    const skill = (await tx.skills.trashed()).length;
    await deps.appendEvent(tx, {
      event: { type: "trash.changed", data: { counts: { skill } } },
      conversationId: null,
    });
  }

  function checkText(text: SkillText, settings: Settings): void {
    const problem = skillTextProblem(text, {
      nameMax: settings.skill_name_max,
      bodyMax: settings.skill_body_max,
    });
    if (problem !== null) throw new DomainError(problem.code, problem.message, problem.field);
  }

  // A new skill and its v1 in the caller's transaction (invariant 25). Also used by Clone and
  // by import.
  async function createInTx(tx: Tx, input: NewSkillInput, actor: string): Promise<SkillId> {
    const settings = await readSettings(tx.settings);
    checkText(
      { slug: input.slug, name: input.name, description: input.description, bodyMd: input.bodyMd },
      settings,
    );
    if (input.clonedFromSkillVersionId !== undefined) {
      const source = await tx.skills.versionById(input.clonedFromSkillVersionId);
      const sourceSkill = source === null ? null : await tx.skills.byId(source.skillId);
      if (sourceSkill === null || sourceSkill.trashedAt !== null) {
        throw new DomainError(
          "validation_error",
          "The skill to copy does not exist.",
          "cloned_from_skill_version_id",
        );
      }
    }
    const now = clock.now();
    const id = SkillId.parse(deps.ids.newId("skill"));
    const inserted = await tx.skills.insertSkill({
      id,
      slug: input.slug,
      name: input.name,
      authorId: actor,
      clonedFromSkillVersionId: input.clonedFromSkillVersionId ?? null,
      rowVersion: 1,
      createdAt: now,
      updatedAt: now,
      deprecatedAt: null,
      trashedAt: null,
      trashedBotIds: null,
    });
    // The slug stays taken while the skill is in Trash, so a restore always works (D49).
    if (!inserted) {
      throw new DomainError("slug_taken", "This slug exists. Type a different one.", "slug");
    }
    await tx.skills.insertVersion(versionRow(newVersionId(), id, 1, input, actor, now));
    await emitSkill(tx, "skill.created", id, actor);
    return id;
  }

  // Version N+1 in the caller's transaction. Moves no pin (D6).
  async function addVersionInTx(
    tx: Tx,
    id: SkillId,
    input: NewVersionInput,
    actor: string,
  ): Promise<void> {
    const skill = await liveSkill(tx.skills, id);
    assertAuthor(skill, actor);
    assertActive(skill);
    if (input.upgradeBotIds.length > 0) throw noSuchBots("upgrade_bot_ids");
    const latest = await tx.skills.latestVersion(id);
    if (latest === null || latest.version !== input.baseVersion) throw stale();
    const settings = await readSettings(tx.settings);
    checkText(
      { name: input.rename?.name, description: input.description, bodyMd: input.bodyMd },
      settings,
    );
    const now = clock.now();
    const updated = await tx.skills.updateSkill(
      id,
      input.rename === undefined ? { updatedAt: now } : { name: input.rename.name, updatedAt: now },
      input.rename?.rowVersion,
    );
    if (!updated) throw stale();
    const inserted = await tx.skills.insertVersion(
      versionRow(newVersionId(), id, input.baseVersion + 1, input, actor, now),
    );
    // Two saves of the same base version: the loser changes nothing (architecture.md §11).
    if (!inserted) throw stale();
    await emitSkill(tx, "skill.updated", id, actor);
  }

  async function purgeInTx(tx: Tx, id: SkillId, actor: string): Promise<void> {
    const clones = await tx.skills.purge(id);
    await deps.appendEvent(tx, {
      event: { type: "skill.purged", data: { skill_id: id } },
      conversationId: null,
    });
    for (const clone of clones) await emitSkill(tx, "skill.updated", clone, actor);
    await emitTrashCount(tx);
  }

  return {
    createInTx,
    addVersionInTx,

    list: async (options: { includeDeprecated: boolean }, actor: string): Promise<Skill[]> => {
      const rows = await readers.skills.list(options);
      return Promise.all(rows.map((row) => shape(readers.skills, row.skill, row.latest, actor)));
    },

    summary: async (id: SkillId, actor: string): Promise<Skill> =>
      toShape(readers.skills, await liveSkill(readers.skills, id), actor),

    get: async (id: SkillId, actor: string): Promise<SkillDetail> => {
      const skill = await liveSkill(readers.skills, id);
      const latest = await readers.skills.latestVersion(id);
      if (latest === null) throw notFound();
      return { ...(await shape(readers.skills, skill, latest, actor)), body_md: latest.bodyMd };
    },

    create: (input: NewSkillInput, actor: string): Promise<Skill> =>
      uow.run(async (tx) => {
        const id = await createInTx(tx, input, actor);
        return toShape(tx.skills, await liveSkill(tx.skills, id), actor);
      }),

    // A rename creates no version (spec gap pass #2).
    rename: (id: SkillId, input: { name: string; rowVersion: number }, actor: string) =>
      uow.run(async (tx) => {
        const skill = await liveSkill(tx.skills, id);
        assertAuthor(skill, actor);
        assertActive(skill);
        checkText({ name: input.name }, await readSettings(tx.settings));
        const now = clock.now();
        const updated = await tx.skills.updateSkill(
          id,
          { name: input.name, updatedAt: now },
          input.rowVersion,
        );
        if (!updated) throw stale();
        return emitSkill(tx, "skill.updated", id, actor);
      }),

    addVersion: (id: SkillId, input: NewVersionInput, actor: string): Promise<Skill> =>
      uow.run(async (tx) => {
        await addVersionInTx(tx, id, input, actor);
        return toShape(tx.skills, await liveSkill(tx.skills, id), actor);
      }),

    versions: async (id: SkillId): Promise<SkillVersionListItem[]> => {
      await liveSkill(readers.skills, id);
      return (await readers.skills.versions(id)).map(versionListItem);
    },

    version: async (id: SkillId, version: number): Promise<SkillVersion> => {
      await liveSkill(readers.skills, id);
      const row = await readers.skills.version(id, version);
      if (row === null)
        throw new DomainError("not_found", `This skill has no v${String(version)}.`);
      return versionShape(row);
    },

    diff: async (
      id: SkillId,
      from: number,
      to: number,
    ): Promise<{ description: DiffLine[] | null; body: DiffLine[] }> => {
      await liveSkill(readers.skills, id);
      const [a, b] = await Promise.all([
        readers.skills.version(id, from),
        readers.skills.version(id, to),
      ]);
      if (a === null || b === null) throw new DomainError("not_found", "No such version.");
      return {
        description:
          a.description === b.description ? null : lineDiff(a.description, b.description),
        body: lineDiff(a.bodyMd, b.bodyMd),
      };
    },

    // Restore of vK creates N+1 with vK's text; history is append-only (D6).
    restoreVersion: (id: SkillId, version: number, changelog: string | undefined, actor: string) =>
      uow.run(async (tx) => {
        const source = await tx.skills.version(id, version);
        const latest = await tx.skills.latestVersion(id);
        if (source === null || latest === null) {
          await liveSkill(tx.skills, id);
          throw new DomainError("not_found", `This skill has no v${String(version)}.`);
        }
        await addVersionInTx(
          tx,
          id,
          {
            baseVersion: latest.version,
            description: source.description,
            bodyMd: source.bodyMd,
            changelog: changelog ?? `Restored v${String(version)}`,
            upgradeBotIds: [],
          },
          actor,
        );
        return toShape(tx.skills, await liveSkill(tx.skills, id), actor);
      }),

    // The latest version of each picked skill as `<slug>/SKILL.md` (D5, UI-7.8); no ids means
    // every active skill. The zip is named `<n>-skills-<UTC timestamp, ISO basic>.zip`.
    exportFiles: async (
      ids: readonly SkillId[] | null,
    ): Promise<{ fileName: string; files: { path: string; text: string }[] }> => {
      const picked =
        ids === null
          ? (await readers.skills.list({ includeDeprecated: false })).map((row) => row.skill)
          : await Promise.all(ids.map((id) => liveSkill(readers.skills, id)));
      const files: { path: string; text: string }[] = [];
      for (const skill of picked) {
        const latest = await readers.skills.latestVersion(skill.id);
        if (latest === null) continue;
        files.push({
          path: `${skill.slug}/SKILL.md`,
          text: serialiseSkillMd({
            slug: skill.slug,
            description: latest.description,
            bodyMd: latest.bodyMd,
          }),
        });
      }
      const stamp = clock
        .now()
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "");
      return { fileName: `${String(files.length)}-skills-${stamp}.zip`, files };
    },

    upgradeCandidates: async (id: SkillId): Promise<never[]> => {
      await liveSkill(readers.skills, id);
      return [];
    },

    deprecate: (
      id: SkillId,
      input: { removeBotIds: readonly string[]; rowVersion: number },
      actor: string,
    ) =>
      uow.run(async (tx) => {
        const skill = await liveSkill(tx.skills, id);
        assertAuthor(skill, actor);
        if (input.removeBotIds.length > 0) throw noSuchBots("remove_bot_ids");
        if (skill.rowVersion !== input.rowVersion) throw stale();
        if (skill.deprecatedAt !== null) return toShape(tx.skills, skill, actor);
        const now = clock.now();
        await tx.skills.updateSkill(id, { deprecatedAt: now, updatedAt: now }, input.rowVersion);
        return emitSkill(tx, "skill.deprecated", id, actor);
      }),

    undeprecate: (id: SkillId, input: { rowVersion: number }, actor: string) =>
      uow.run(async (tx) => {
        const skill = await liveSkill(tx.skills, id);
        assertAuthor(skill, actor);
        if (skill.rowVersion !== input.rowVersion) throw stale();
        if (skill.deprecatedAt === null) return toShape(tx.skills, skill, actor);
        await tx.skills.updateSkill(
          id,
          { deprecatedAt: null, updatedAt: clock.now() },
          input.rowVersion,
        );
        return emitSkill(tx, "skill.updated", id, actor);
      }),

    // Delete sends a deprecated skill to Trash and removes it from every bot (D49, invariant 19).
    trash: (id: SkillId, input: { rowVersion: number }, actor: string) =>
      uow.run(async (tx) => {
        const skill = await liveSkill(tx.skills, id);
        assertAuthor(skill, actor);
        if (skill.deprecatedAt === null) {
          throw new DomainError(
            "not_deprecated",
            "Deprecate the skill first. Only a deprecated skill can go to Trash.",
          );
        }
        if (skill.rowVersion !== input.rowVersion) throw stale();
        const now = clock.now();
        // No pins exist before M2; M2 deletes them here and keeps their bot ids.
        const removedBotIds: string[] = [];
        await tx.skills.updateSkill(
          id,
          { trashedAt: now, trashedBotIds: removedBotIds, updatedAt: now },
          input.rowVersion,
        );
        await deps.appendEvent(tx, {
          event: { type: "skill.trashed", data: { skill_id: id } },
          conversationId: null,
        });
        await emitTrashCount(tx);
        return { skill_id: id, removed_bot_ids: removedBotIds };
      }),

    // Out of Trash, still deprecated. Suggests bots, never assigns (invariant 21).
    restore: (id: SkillId, actor: string) =>
      uow.run(async (tx) => {
        const skill = await trashedSkill(tx.skills, id);
        assertAuthor(skill, actor);
        // M2 keeps the bots in `trashed_bot_ids` that are not deleted; M1 has none.
        const suggestedBotIds: string[] = [];
        await tx.skills.updateSkill(id, {
          trashedAt: null,
          trashedBotIds: null,
          updatedAt: clock.now(),
        });
        const restored = await emitSkill(tx, "skill.restored", id, actor);
        await emitTrashCount(tx);
        return { skill: restored, suggested_bot_ids: suggestedBotIds };
      }),

    // The permanent delete of a skill in Trash (D62).
    purge: (id: SkillId, actor: string) =>
      uow.run(async (tx) => {
        const skill = await trashedSkill(tx.skills, id);
        assertAuthor(skill, actor);
        await purgeInTx(tx, id, actor);
      }),

    trashed: async (actor: string) => {
      const rows = await readers.skills.trashed();
      return Promise.all(rows.map((skill) => toShape(readers.skills, skill, actor)));
    },

    // The purge job (architecture.md §6.1): each skill whose `trashed_at + trash_days` is at or
    // before now, one per transaction. Returns how many it purged.
    purgeDue: async (actor: string): Promise<number> => {
      const settings = await readSettings(readers.settings);
      const cutoff = new Date(clock.now().getTime() - settings.trash_days * 86_400_000);
      let purged = 0;
      for (const id of await readers.skills.trashedUntil(cutoff)) {
        const done = await uow.run(async (tx) => {
          const skill = await tx.skills.byId(id);
          // Restored or purged since the list was read.
          if (skill?.trashedAt == null || skill.trashedAt > cutoff) return false;
          await purgeInTx(tx, id, actor);
          return true;
        });
        if (done) purged += 1;
      }
      return purged;
    },
  };
}

export type SkillsService = ReturnType<typeof createSkillsService>;

function versionRow(
  id: SkillVersionId,
  skillId: SkillId,
  version: number,
  input: { description: string; bodyMd: string; changelog?: string | undefined },
  actor: string,
  now: Date,
): SkillVersionRecord {
  return {
    id,
    skillId,
    version,
    description: input.description,
    bodyMd: input.bodyMd,
    changelog: oneLine(input.changelog),
    createdBy: actor,
    createdAt: now,
  };
}

function versionListItem(row: SkillVersionRecord): SkillVersionListItem {
  return {
    id: row.id,
    version: row.version,
    description: row.description,
    changelog: row.changelog,
    created_by: row.createdBy,
    created_at: row.createdAt.toISOString(),
    bots_using: 0,
  };
}

function versionShape(row: SkillVersionRecord): SkillVersion {
  return { ...versionListItem(row), body_md: row.bodyMd };
}

// The changelog is one line (skills-page.md §5); empty means none.
function oneLine(changelog: string | undefined): string | null {
  const line = changelog?.replace(/\s*\n\s*/g, " ").trim() ?? "";
  return line === "" ? null : line;
}

function assertAuthor(skill: SkillRecord, actor: string): void {
  // D14: only the author changes a skill. Phase 1 has one owner, so only tests reach this.
  if (skill.authorId !== actor) {
    throw new DomainError("not_author", "Only the author can change this skill. Clone it to edit.");
  }
}

function assertActive(skill: SkillRecord): void {
  if (skill.deprecatedAt !== null) {
    throw new DomainError(
      "skill_deprecated",
      "Deprecated skills are read-only. Make it active again to edit it.",
    );
  }
}

function noSuchBots(field: string): DomainError {
  return new DomainError("validation_error", "No bot uses this skill.", field);
}

function stale(): DomainError {
  return new DomainError("stale_write", "The skill changed since you opened it. Reload it.");
}

function notFound(): DomainError {
  return new DomainError("not_found", "No such skill.");
}
