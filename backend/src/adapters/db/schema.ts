import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { typeIdColumn, utcTimestamp } from "./columns";

/** domain-model.md §8. `seq` is AUTOINCREMENT so it never goes back, even after pruning. */
export const events = sqliteTable("events", {
  seq: integer("seq").primaryKey({ autoIncrement: true }),
  conversationId: typeIdColumn("conversation_id", "conv"),
  type: text("type").notNull(),
  payload: text("payload", { mode: "json" }).notNull(),
  createdAt: utcTimestamp("created_at").notNull(),
});

/** domain-model.md §10. */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).notNull(),
});
