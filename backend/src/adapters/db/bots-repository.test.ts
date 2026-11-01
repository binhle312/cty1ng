import { join } from "node:path";
import { BotId } from "@cty1ng/shared/ids";
import type Database from "better-sqlite3";
import { typeid } from "typeid-js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { tempDir } from "../../../test/helpers.ts";
import { openWriter } from "./client.ts";
import { MIGRATIONS_FOLDER, migrate } from "./migrate.ts";
import { sqliteReaders } from "./unit-of-work.ts";

// What the bots repository parses when it reads a row (frontend-conventions.md §1: every
// boundary value is parsed). The rows are written in plain SQL, so no service check hides them.

const NOW = "2026-11-01T00:00:00.000Z";

let dir: ReturnType<typeof tempDir>;
let db: Database.Database;
beforeEach(() => {
  dir = tempDir("bots-repository");
  db = openWriter(join(dir.path, "app.db"));
  migrate(db, MIGRATIONS_FOLDER);
});
afterEach(() => {
  db.close();
  dir.remove();
});

function insertBot(toolSettings: string): BotId {
  const id = typeid("bot");
  db.prepare(
    `INSERT INTO bots (id, slug, name, name_key, description, persona_md, avatar_style,
       avatar_colour, model_id, request_limit, max_reply_chars, history_share_pct, tool_settings,
       created_by, created_at, updated_at)
     VALUES (?, 'ba', 'BA', 'ba', 'd', 'p', 'flat', '#336699', 'fake:scripted', 30, 6000, 40, ?,
       'owner', ?, ?)`,
  ).run(id.toUUID(), toolSettings, NOW, NOW);
  return BotId.parse(id.toString());
}

describe("tool_settings column", () => {
  it("reads back a map of tool ids to booleans", async () => {
    const id = insertBot(JSON.stringify({ web_search: true, library_read: false }));
    const bot = await sqliteReaders(db).bots.byId(id);
    expect(bot?.toolSettings).toEqual({ web_search: true, library_read: false });
  });

  it.each([
    ["a list", "[true]"],
    ["a value that is not a boolean", JSON.stringify({ web_search: "yes" })],
    ["null", "null"],
  ])("refuses %s instead of passing it on as tool settings", async (_, stored) => {
    const id = insertBot(stored);
    const read = async () => sqliteReaders(db).bots.byId(id);
    await expect(read()).rejects.toThrow(/expected/);
  });
});
