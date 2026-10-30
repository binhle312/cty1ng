import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { typeIdColumn, utcTimestamp } from "./columns.ts";

// Tables of M0: only `events` and `settings` (domain-model.md §8, §10). Every primary key is
// NOT NULL (domain-model.md §1).

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
