import { and, asc, eq, gt, isNotNull, isNull, lte, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { AvatarStyle } from "@cty1ng/shared/bots";
import { Effort } from "@cty1ng/shared/catalog";
import { BotId, SkillId, SkillVersionId } from "@cty1ng/shared/ids";
import type {
  BotPinRecord,
  BotPinView,
  BotRecord,
  BotsWriter,
} from "../../core/ports/repositories.ts";
import type { Db } from "./client.ts";
import { bots, botSkills, skills, skillVersions } from "./schema.ts";

// The bots repository (domain-model.md §2, §3.1) over one Drizzle connection: the writer inside
// a transaction, or the reader outside one.

export function botsRepository(db: Db): BotsWriter {
  const latest = alias(skillVersions, "latest");
  const newer = alias(skillVersions, "newer");
  const isLatest = notExists(
    db
      .select({ one: sql`1` })
      .from(newer)
      .where(and(eq(newer.skillId, latest.skillId), gt(newer.version, latest.version))),
  );

  const one = (row: typeof bots.$inferSelect | undefined): Promise<BotRecord | null> =>
    Promise.resolve(row === undefined ? null : toBot(row));

  return {
    list: () =>
      Promise.resolve(db.select().from(bots).where(isNull(bots.deletedAt)).all().map(toBot)),
    byId: (id) => one(db.select().from(bots).where(eq(bots.id, id)).get()),
    bySlug: (slug) => one(db.select().from(bots).where(eq(bots.slug, slug)).get()),
    byCreateKey: (key) => one(db.select().from(bots).where(eq(bots.createKey, key)).get()),
    slugTaken: (slug) =>
      Promise.resolve(
        db.select({ id: bots.id }).from(bots).where(eq(bots.slug, slug)).get() !== undefined,
      ),
    nameKeyHolder: (nameKey) =>
      one(
        db
          .select()
          .from(bots)
          .where(and(eq(bots.nameKey, nameKey), isNull(bots.purgedAt)))
          .get(),
      ),
    pins: (botId) => {
      const rows = db
        .select({ pin: botSkills, skill: skills, pinned: skillVersions, latest })
        .from(botSkills)
        .innerJoin(skills, eq(skills.id, botSkills.skillId))
        .innerJoin(skillVersions, eq(skillVersions.id, botSkills.skillVersionId))
        .innerJoin(latest, and(eq(latest.skillId, botSkills.skillId), isLatest))
        .where(eq(botSkills.botId, botId))
        .orderBy(asc(skills.name), asc(skills.id))
        .all();
      return Promise.resolve(
        rows.map((row): BotPinView => ({
          ...toPin(row.pin),
          skillSlug: row.skill.slug,
          skillName: row.skill.name,
          description: row.pinned.description,
          version: row.pinned.version,
          latestVersion: row.latest.version,
          deprecated: row.skill.deprecatedAt !== null,
        })),
      );
    },
    pinsOfSkill: (skillId) => {
      const rows = db
        .select({
          botId: botSkills.botId,
          skillVersionId: botSkills.skillVersionId,
          version: skillVersions.version,
          alwaysLoad: botSkills.alwaysLoad,
          deletedAt: bots.deletedAt,
        })
        .from(botSkills)
        .innerJoin(bots, eq(bots.id, botSkills.botId))
        .innerJoin(skillVersions, eq(skillVersions.id, botSkills.skillVersionId))
        .where(and(eq(botSkills.skillId, skillId), isNull(bots.purgedAt)))
        .orderBy(asc(bots.name), asc(bots.id))
        .all();
      return Promise.resolve(
        rows.map((row) => ({
          botId: BotId.parse(row.botId),
          skillVersionId: SkillVersionId.parse(row.skillVersionId),
          version: row.version,
          alwaysLoad: row.alwaysLoad,
          botDeleted: row.deletedAt !== null,
        })),
      );
    },
    pinnedIds: () =>
      Promise.resolve(
        db
          .select({ id: bots.id })
          .from(bots)
          .where(isNotNull(bots.pinnedPosition))
          .orderBy(asc(bots.pinnedPosition))
          .all()
          .map((row) => BotId.parse(row.id)),
      ),
    trashedCount: () => {
      const row = db
        .select({ n: sql<number>`count(*)` })
        .from(bots)
        .where(and(isNotNull(bots.deletedAt), isNull(bots.purgedAt)))
        .get();
      return Promise.resolve(row?.n ?? 0);
    },
    trashedUntil: (cutoff) =>
      Promise.resolve(
        db
          .select({ id: bots.id })
          .from(bots)
          .where(and(isNotNull(bots.deletedAt), isNull(bots.purgedAt), lte(bots.deletedAt, cutoff)))
          .orderBy(asc(bots.deletedAt))
          .all()
          .map((row) => BotId.parse(row.id)),
      ),
    avatarPaths: () =>
      Promise.resolve(
        new Set(
          db
            .selectDistinct({ path: bots.avatarPath })
            .from(bots)
            .where(isNotNull(bots.avatarPath))
            .all()
            .flatMap((row) => (row.path === null ? [] : [row.path])),
        ),
      ),
    insertBot: (bot) => {
      const result = db.insert(bots).values(bot).onConflictDoNothing().run();
      return Promise.resolve(result.changes === 1);
    },
    updateBot: (id, change, expectedRowVersion) => {
      const result = db
        .update(bots)
        .set({ ...change, rowVersion: sql`${bots.rowVersion} + 1` })
        .where(
          and(
            eq(bots.id, id),
            expectedRowVersion === undefined ? undefined : eq(bots.rowVersion, expectedRowVersion),
          ),
        )
        .run();
      return Promise.resolve(result.changes === 1);
    },
    setPinnedOrder: (ids) => {
      db.update(bots).set({ pinnedPosition: null }).where(isNotNull(bots.pinnedPosition)).run();
      ids.forEach((id, index) => {
        db.update(bots)
          .set({ pinnedPosition: index + 1 })
          .where(eq(bots.id, id))
          .run();
      });
      return Promise.resolve();
    },
    upsertPin: (pin) => {
      db.insert(botSkills)
        .values(pin)
        .onConflictDoUpdate({
          target: [botSkills.botId, botSkills.skillId],
          set: {
            skillVersionId: pin.skillVersionId,
            alwaysLoad: pin.alwaysLoad,
            updatedAt: pin.updatedAt,
          },
        })
        .run();
      return Promise.resolve();
    },
    deletePin: (botId, skillId) => {
      const result = db
        .delete(botSkills)
        .where(and(eq(botSkills.botId, botId), eq(botSkills.skillId, skillId)))
        .run();
      return Promise.resolve(result.changes === 1);
    },
    deletePinsOfSkill: (skillId) => {
      const rows = db
        .delete(botSkills)
        .where(eq(botSkills.skillId, skillId))
        .returning({ botId: botSkills.botId })
        .all();
      return Promise.resolve(rows.map((row) => BotId.parse(row.botId)));
    },
    // The closed list of domain-model.md §2 Purge; every other column keeps its value.
    tombstone: (id, now) => {
      db.delete(botSkills).where(eq(botSkills.botId, id)).run();
      db.update(bots)
        .set({
          description: "",
          personaMd: "",
          toolSettings: {},
          pinnedPosition: null,
          createKey: null,
          createRequestHash: null,
          updatedAt: now,
          purgedAt: now,
        })
        .where(eq(bots.id, id))
        .run();
      return Promise.resolve();
    },
  };
}

// Parsed at the boundary: the TypeID and text columns give plain strings.
function toBot(row: typeof bots.$inferSelect): BotRecord {
  return {
    ...row,
    id: BotId.parse(row.id),
    avatarStyle: AvatarStyle.parse(row.avatarStyle),
    effort: row.effort === null ? null : Effort.parse(row.effort),
    clonedFromBotId: row.clonedFromBotId === null ? null : BotId.parse(row.clonedFromBotId),
  };
}

function toPin(row: typeof botSkills.$inferSelect): BotPinRecord {
  return {
    ...row,
    botId: BotId.parse(row.botId),
    skillId: SkillId.parse(row.skillId),
    skillVersionId: SkillVersionId.parse(row.skillVersionId),
  };
}
