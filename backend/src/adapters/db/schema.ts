import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
  uniqueIndex,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";
import { typeIdColumn, utcTimestamp } from "./columns.ts";

// The tables built so far: `events` and `settings` (M0, domain-model.md §8, §10), `skills` and
// `skill_versions` (M1, §3.1), `bots` and `bot_skills` (M2, §2, §3.1). Every primary key is NOT NULL (domain-model.md §1).

// `conversation_id` gets its foreign key with the `conversations` table (M3).
export const events = sqliteTable("events", {
  seq: integer("seq").primaryKey({ autoIncrement: true }).notNull(),
  conversationId: typeIdColumn("conv")("conversation_id"),
  type: text("type").notNull(),
  payload: text("payload", { mode: "json" }).$type<unknown>().notNull(),
  createdAt: utcTimestamp("created_at").notNull(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey().notNull(),
  value: text("value", { mode: "json" }).$type<unknown>().notNull(),
});

// No pointer to the latest version: it is the highest `version` (domain-model.md §3.1).
export const skills = sqliteTable(
  "skills",
  {
    id: typeIdColumn("skill")("id").primaryKey().notNull(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    authorId: text("author_id").notNull(),
    clonedFromSkillVersionId: typeIdColumn("skillv")("cloned_from_skill_version_id").references(
      (): AnySQLiteColumn => skillVersions.id,
    ),
    rowVersion: integer("row_version").notNull().default(1),
    createdAt: utcTimestamp("created_at").notNull(),
    updatedAt: utcTimestamp("updated_at").notNull(),
    deprecatedAt: utcTimestamp("deprecated_at"),
    trashedAt: utcTimestamp("trashed_at"),
    trashedBotIds: text("trashed_bot_ids", { mode: "json" }).$type<string[]>(),
  },
  (t) => [
    // D49: only a deprecated skill can be in Trash (M1 plan, decision 5).
    check(
      "skills_trashed_needs_deprecated",
      sql`${t.trashedAt} IS NULL OR ${t.deprecatedAt} IS NOT NULL`,
    ),
  ],
);

// Rows are never updated; only the Trash purge deletes them (invariant 2). `skill_draft_id`
// comes with `skill_drafts` in M5c.
export const skillVersions = sqliteTable(
  "skill_versions",
  {
    id: typeIdColumn("skillv")("id").primaryKey().notNull(),
    skillId: typeIdColumn("skill")("skill_id")
      .notNull()
      .references((): AnySQLiteColumn => skills.id),
    version: integer("version").notNull(),
    description: text("description").notNull(),
    bodyMd: text("body_md").notNull(),
    changelog: text("changelog"),
    createdBy: text("created_by").notNull(),
    createdAt: utcTimestamp("created_at").notNull(),
  },
  (t) => [
    unique("skill_versions_skill_version").on(t.skillId, t.version),
    // The target of the bot_skills composite foreign key (M2, invariant 3).
    unique("skill_versions_skill_id_id").on(t.skillId, t.id),
  ],
);

// Bots (M2, domain-model.md §2). A purge keeps the row as a tombstone (D50). The name key is
// unique among bots not purged, Trash included (invariant 12); a slug is unique forever.
export const bots = sqliteTable(
  "bots",
  {
    id: typeIdColumn("bot")("id").primaryKey().notNull(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    nameKey: text("name_key").notNull(),
    rowVersion: integer("row_version").notNull().default(1),
    description: text("description").notNull(),
    personaMd: text("persona_md").notNull(),
    avatarStyle: text("avatar_style").notNull().default("flat"),
    avatarColour: text("avatar_colour").notNull(),
    avatarPath: text("avatar_path"),
    // Never updated after insert (D7, invariant 1).
    modelId: text("model_id").notNull(),
    effort: text("effort"),
    requestLimit: integer("request_limit").notNull(),
    maxReplyChars: integer("max_reply_chars").notNull(),
    historySharePct: integer("history_share_pct").notNull(),
    toolSettings: text("tool_settings", { mode: "json" })
      .$type<Record<string, boolean>>()
      .notNull(),
    clonedFromBotId: typeIdColumn("bot")("cloned_from_bot_id").references(
      (): AnySQLiteColumn => bots.id,
    ),
    createKey: text("create_key").unique(),
    createRequestHash: text("create_request_hash"),
    pinnedPosition: integer("pinned_position"),
    createdBy: text("created_by").notNull(),
    createdAt: utcTimestamp("created_at").notNull(),
    updatedAt: utcTimestamp("updated_at").notNull(),
    deletedAt: utcTimestamp("deleted_at"),
    purgedAt: utcTimestamp("purged_at"),
  },
  (t) => [
    check("bots_purged_needs_deleted", sql`${t.purgedAt} IS NULL OR ${t.deletedAt} IS NOT NULL`),
    check(
      "bots_create_key_with_hash",
      sql`(${t.createKey} IS NULL) = (${t.createRequestHash} IS NULL)`,
    ),
    // M2 plan, decision 6: the service checks both first, for a useful error.
    check("bots_avatar_style", sql`${t.avatarStyle} IN ('flat', 'jelly', 'pixel', 'upload')`),
    check(
      "bots_avatar_upload_has_path",
      sql`(${t.avatarStyle} = 'upload') = (${t.avatarPath} IS NOT NULL)`,
    ),
    uniqueIndex("bots_name_kept")
      .on(t.nameKey)
      .where(sql`${t.purgedAt} IS NULL`),
    uniqueIndex("bots_pinned_position")
      .on(t.pinnedPosition)
      .where(sql`${t.pinnedPosition} IS NOT NULL`),
  ],
);

// A bot's pins, its "go.mod" (D6, domain-model.md §3.1). The composite foreign key makes the
// pinned version belong to the skill (invariant 3).
export const botSkills = sqliteTable(
  "bot_skills",
  {
    botId: typeIdColumn("bot")("bot_id")
      .notNull()
      .references((): AnySQLiteColumn => bots.id),
    skillId: typeIdColumn("skill")("skill_id")
      .notNull()
      .references((): AnySQLiteColumn => skills.id),
    skillVersionId: typeIdColumn("skillv")("skill_version_id").notNull(),
    alwaysLoad: integer("always_load", { mode: "boolean" }).notNull().default(false),
    addedAt: utcTimestamp("added_at").notNull(),
    updatedAt: utcTimestamp("updated_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.botId, t.skillId] }),
    foreignKey({
      columns: [t.skillId, t.skillVersionId],
      foreignColumns: [skillVersions.skillId, skillVersions.id],
    }),
  ],
);
