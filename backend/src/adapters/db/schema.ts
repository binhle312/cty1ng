import { sql } from "drizzle-orm";
import {
  check,
  integer,
  sqliteTable,
  text,
  unique,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";
import { typeIdColumn, utcTimestamp } from "./columns.ts";

// The tables built so far: `events` and `settings` (M0, domain-model.md §8, §10), `skills` and
// `skill_versions` (M1, §3.1). Every primary key is NOT NULL (domain-model.md §1).

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
