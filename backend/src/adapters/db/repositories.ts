import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  max,
  min,
  notExists,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { ConversationId, SkillId, SkillVersionId } from "@cty1ng/shared/ids";
import type {
  EventsWriter,
  PersistedEvent,
  SettingsWriter,
  SkillRecord,
  SkillVersionRecord,
  SkillsWriter,
} from "../../core/ports/repositories.ts";
import type { Db } from "./client.ts";
import { events, settings, skills, skillVersions } from "./schema.ts";

// Repositories over one Drizzle connection: the writer inside a transaction, or the reader
// outside one (the reader never calls the write methods; its connection is read-only).

export function eventsRepository(db: Db): EventsWriter {
  return {
    append: (event) => {
      const row = db
        .insert(events)
        .values({
          type: event.type,
          conversationId: event.conversationId,
          payload: event.payload,
          createdAt: event.createdAt,
        })
        .returning({ seq: events.seq })
        .get();
      return Promise.resolve(row.seq);
    },
    // `created_at` is ISO-8601 UTC text, so text order is time order.
    deleteBefore: (cutoff) => {
      const result = db.delete(events).where(lt(events.createdAt, cutoff)).run();
      return Promise.resolve(result.changes);
    },
    after: (seq, limit) => {
      const rows = db
        .select()
        .from(events)
        .where(gt(events.seq, seq))
        .orderBy(asc(events.seq))
        .limit(limit)
        .all();
      return Promise.resolve(rows.map(toPersistedEvent));
    },
    bounds: () => {
      const row = db
        .select({ oldest: min(events.seq), newest: max(events.seq) })
        .from(events)
        .get();
      return Promise.resolve({ oldest: row?.oldest ?? null, newest: row?.newest ?? null });
    },
    // AUTOINCREMENT keeps the highest seq in `sqlite_sequence`, also after every row is gone.
    lastSeq: () => {
      const row = db.get<{ seq: number } | undefined>(
        sql`SELECT seq FROM sqlite_sequence WHERE name = ${"events"}`,
      );
      return Promise.resolve(row?.seq ?? null);
    },
  };
}

function toPersistedEvent(row: typeof events.$inferSelect): PersistedEvent {
  return {
    seq: row.seq,
    type: row.type,
    // Parsed at the boundary: the column type gives a plain string.
    conversationId: row.conversationId === null ? null : ConversationId.parse(row.conversationId),
    payload: row.payload,
    createdAt: row.createdAt,
  };
}

export function settingsRepository(db: Db): SettingsWriter {
  return {
    get: (key) => {
      const row = db.select().from(settings).where(eq(settings.key, key)).get();
      return Promise.resolve(row?.value);
    },
    set: (key, value) => {
      db.insert(settings)
        .values({ key, value })
        .onConflictDoUpdate({ target: settings.key, set: { value } })
        .run();
      return Promise.resolve();
    },
    // Compares the stored JSON text, so `expected` must serialise the same way it was written.
    // `expected === undefined` means "no row yet".
    setIf: (key, expected, next) => {
      const result =
        expected === undefined
          ? db.insert(settings).values({ key, value: next }).onConflictDoNothing().run()
          : db
              .update(settings)
              .set({ value: next })
              .where(and(eq(settings.key, key), eq(settings.value, expected)))
              .run();
      return Promise.resolve(result.changes === 1);
    },
  };
}

export function skillsRepository(db: Db): SkillsWriter {
  // The latest version of a skill is its highest `version` (domain-model.md §3.1).
  const newer = alias(skillVersions, "newer");
  const isLatest = notExists(
    db
      .select({ one: sql`1` })
      .from(newer)
      .where(
        and(eq(newer.skillId, skillVersions.skillId), gt(newer.version, skillVersions.version)),
      ),
  );

  return {
    list: ({ includeDeprecated }) => {
      const rows = db
        .select({ skill: skills, latest: skillVersions })
        .from(skills)
        .innerJoin(skillVersions, and(eq(skillVersions.skillId, skills.id), isLatest))
        .where(
          and(
            isNull(skills.trashedAt),
            includeDeprecated ? undefined : isNull(skills.deprecatedAt),
          ),
        )
        .orderBy(desc(skills.updatedAt), desc(skills.id))
        .all();
      return Promise.resolve(
        rows.map((row) => ({ skill: toSkill(row.skill), latest: toVersion(row.latest) })),
      );
    },
    byId: (id) =>
      Promise.resolve(oneSkill(db.select().from(skills).where(eq(skills.id, id)).get())),
    bySlug: (slug) =>
      Promise.resolve(oneSkill(db.select().from(skills).where(eq(skills.slug, slug)).get())),
    trashed: () => {
      const rows = db
        .select()
        .from(skills)
        .where(isNotNull(skills.trashedAt))
        .orderBy(desc(skills.trashedAt))
        .all();
      return Promise.resolve(rows.map(toSkill));
    },
    trashedCount: () => {
      const row = db
        .select({ n: sql<number>`count(*)` })
        .from(skills)
        .where(isNotNull(skills.trashedAt))
        .get();
      return Promise.resolve(row?.n ?? 0);
    },
    trashedUntil: (cutoff) => {
      const rows = db
        .select({ id: skills.id })
        .from(skills)
        .where(and(isNotNull(skills.trashedAt), lte(skills.trashedAt, cutoff)))
        .orderBy(asc(skills.trashedAt))
        .all();
      return Promise.resolve(rows.map((row) => SkillId.parse(row.id)));
    },
    latestVersion: (skillId) => {
      const row = db
        .select()
        .from(skillVersions)
        .where(eq(skillVersions.skillId, skillId))
        .orderBy(desc(skillVersions.version))
        .limit(1)
        .get();
      return Promise.resolve(row === undefined ? null : toVersion(row));
    },
    version: (skillId, version) => {
      const row = db
        .select()
        .from(skillVersions)
        .where(and(eq(skillVersions.skillId, skillId), eq(skillVersions.version, version)))
        .get();
      return Promise.resolve(row === undefined ? null : toVersion(row));
    },
    versionById: (id) => {
      const row = db.select().from(skillVersions).where(eq(skillVersions.id, id)).get();
      return Promise.resolve(row === undefined ? null : toVersion(row));
    },
    versions: (skillId) => {
      const rows = db
        .select()
        .from(skillVersions)
        .where(eq(skillVersions.skillId, skillId))
        .orderBy(desc(skillVersions.version))
        .all();
      return Promise.resolve(rows.map(toVersion));
    },
    insertSkill: (skill) => {
      const result = db
        .insert(skills)
        .values(skill)
        .onConflictDoNothing({ target: skills.slug })
        .run();
      return Promise.resolve(result.changes === 1);
    },
    insertVersion: (version) => {
      const result = db.insert(skillVersions).values(version).onConflictDoNothing().run();
      return Promise.resolve(result.changes === 1);
    },
    updateSkill: (id, change, expectedRowVersion) => {
      const result = db
        .update(skills)
        .set({ ...change, rowVersion: sql`${skills.rowVersion} + 1` })
        .where(
          and(
            eq(skills.id, id),
            expectedRowVersion === undefined
              ? undefined
              : eq(skills.rowVersion, expectedRowVersion),
          ),
        )
        .run();
      return Promise.resolve(result.changes === 1);
    },
    purge: (id) => {
      const versionIds = db
        .select({ id: skillVersions.id })
        .from(skillVersions)
        .where(eq(skillVersions.skillId, id))
        .all()
        .map((row) => row.id);
      // Clones keep their text; only the link to the purged version goes (domain-model.md §3.4).
      const clones =
        versionIds.length === 0
          ? []
          : db
              .update(skills)
              .set({ clonedFromSkillVersionId: null, rowVersion: sql`${skills.rowVersion} + 1` })
              .where(inArray(skills.clonedFromSkillVersionId, versionIds))
              .returning({ id: skills.id })
              .all();
      db.delete(skillVersions).where(eq(skillVersions.skillId, id)).run();
      db.delete(skills).where(eq(skills.id, id)).run();
      return Promise.resolve(clones.map((row) => SkillId.parse(row.id)));
    },
  };
}

function oneSkill(row: typeof skills.$inferSelect | undefined): SkillRecord | null {
  return row === undefined ? null : toSkill(row);
}

// Parsed at the boundary: the TypeID columns give plain strings.
function toSkill(row: typeof skills.$inferSelect): SkillRecord {
  return {
    ...row,
    id: SkillId.parse(row.id),
    clonedFromSkillVersionId:
      row.clonedFromSkillVersionId === null
        ? null
        : SkillVersionId.parse(row.clonedFromSkillVersionId),
  };
}

function toVersion(row: typeof skillVersions.$inferSelect): SkillVersionRecord {
  return { ...row, id: SkillVersionId.parse(row.id), skillId: SkillId.parse(row.skillId) };
}
