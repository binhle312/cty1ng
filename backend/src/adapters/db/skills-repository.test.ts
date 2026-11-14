import { join } from "node:path";
import { BotId, SkillId } from "@cty1ng/shared/ids";
import type Database from "better-sqlite3";
import { typeid } from "typeid-js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { tempDir } from "../../../test/helpers.ts";
import { openWriter } from "./client.ts";
import { MIGRATIONS_FOLDER, migrate } from "./migrate.ts";
import { sqliteReaders } from "./unit-of-work.ts";

// What the skills repository parses when it reads a row (frontend-conventions.md §1: every
// boundary value is parsed). The rows are written in plain SQL, so no service check hides them.

const NOW = "2026-11-01T00:00:00.000Z";
const BOT = typeid("bot").toString();

let dir: ReturnType<typeof tempDir>;
let db: Database.Database;
beforeEach(() => {
  dir = tempDir("skills-repository");
  db = openWriter(join(dir.path, "app.db"));
  migrate(db, MIGRATIONS_FOLDER);
});
afterEach(() => {
  db.close();
  dir.remove();
});

// A skill in Trash with this stored `trashed_bot_ids` (SQL NULL for null).
function insertTrashedSkill(trashedBotIds: string | null): SkillId {
  const id = typeid("skill");
  db.prepare(
    `INSERT INTO skills (id, slug, name, author_id, created_at, updated_at, deprecated_at,
       trashed_at, trashed_bot_ids)
     VALUES (?, 'notes', 'Notes', 'owner', ?, ?, ?, ?, ?)`,
  ).run(id.toUUID(), NOW, NOW, NOW, NOW, trashedBotIds);
  return SkillId.parse(id.toString());
}

describe("trashed_bot_ids column (P3 item 28)", () => {
  it.each([
    { kind: "no value", stored: null, expected: null },
    { kind: "an empty list", stored: "[]", expected: [] },
    { kind: "a list of bot ids", stored: JSON.stringify([BOT]), expected: [BotId.parse(BOT)] },
  ])("reads back $kind", async ({ stored, expected }) => {
    const id = insertTrashedSkill(stored);
    const skill = await sqliteReaders(db).skills.byId(id);
    expect(skill?.trashedBotIds).toEqual(expected);
  });

  it.each([
    ["an object", "{}"],
    ["a list of numbers", "[1]"],
    ["a string that is not a bot id", JSON.stringify(["not-a-typeid"])],
  ])("refuses %s instead of passing it on as bot ids", async (_, stored) => {
    const id = insertTrashedSkill(stored);
    const read = async () => sqliteReaders(db).skills.byId(id);
    await expect(read()).rejects.toThrow(/expected|Expected/);
  });
});
