import { join } from "node:path";
import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { tempDir } from "../../../test/helpers.ts";
import { openWriter } from "./client.ts";
import { migrate } from "./migrate.ts";

// The database rules of `bots` and `bot_skills` (domain-model.md §2, §3.1; M2 plan P4 and
// decision 6), proven on the migrated schema with plain SQL, so no service check hides them.

const MIGRATIONS = join(import.meta.dirname, "../../../migrations");
const NOW = "2026-11-01T00:00:00.000Z";

let dir: ReturnType<typeof tempDir>;
let db: Database.Database;
beforeEach(() => {
  dir = tempDir("bots-schema");
  db = openWriter(join(dir.path, "app.db"));
  migrate(db, MIGRATIONS);
  for (const [skill, versions] of [
    ["s1", ["s1v1", "s1v2"]],
    ["s2", ["s2v1"]],
  ] as const) {
    db.prepare(
      `INSERT INTO skills (id, slug, name, author_id, created_at, updated_at) VALUES (?, ?, ?, 'owner', ?, ?)`,
    ).run(skill, skill, skill, NOW, NOW);
    versions.forEach((id, index) => {
      db.prepare(
        `INSERT INTO skill_versions (id, skill_id, version, description, body_md, created_by, created_at) VALUES (?, ?, ?, 'd', 'b', 'owner', ?)`,
      ).run(id, skill, index + 1, NOW);
    });
  }
});
afterEach(() => {
  db.close();
  dir.remove();
});

function insertBot(id: string, fields: Record<string, unknown> = {}): void {
  const row: Record<string, unknown> = {
    id,
    slug: id,
    name: id,
    name_key: id,
    description: "d",
    persona_md: "p",
    avatar_style: "flat",
    avatar_colour: "#336699",
    avatar_path: null,
    model_id: "fake:scripted",
    effort: null,
    request_limit: 30,
    max_reply_chars: 6000,
    history_share_pct: 40,
    tool_settings: "{}",
    create_key: null,
    create_request_hash: null,
    pinned_position: null,
    created_by: "owner",
    created_at: NOW,
    updated_at: NOW,
    deleted_at: null,
    purged_at: null,
    ...fields,
  };
  const columns = Object.keys(row);
  db.prepare(
    `INSERT INTO bots (${columns.join(", ")}) VALUES (${columns.map((c) => `@${c}`).join(", ")})`,
  ).run(row);
}

function pin(bot: string, skill: string, version: string): void {
  db.prepare(
    `INSERT INTO bot_skills (bot_id, skill_id, skill_version_id, added_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(bot, skill, version, NOW, NOW);
}

describe("bot_skills (invariant 3)", () => {
  it("refuses a pin to another skill's version, on insert and on update", () => {
    insertBot("b1");
    expect(() => {
      pin("b1", "s1", "s2v1");
    }).toThrow(/FOREIGN KEY/);
    pin("b1", "s1", "s1v1");
    expect(() =>
      db.prepare(`UPDATE bot_skills SET skill_version_id = 's2v1' WHERE bot_id = 'b1'`).run(),
    ).toThrow(/FOREIGN KEY/);
    db.prepare(`UPDATE bot_skills SET skill_version_id = 's1v2' WHERE bot_id = 'b1'`).run();
  });

  it("holds one version of a skill per bot", () => {
    insertBot("b1");
    pin("b1", "s1", "s1v1");
    expect(() => {
      pin("b1", "s1", "s1v2");
    }).toThrow(/UNIQUE|PRIMARY KEY/);
  });
});

describe("bots", () => {
  it("refuses two live bots with one name key, also while one is in Trash", () => {
    insertBot("b1", { name_key: "ba" });
    expect(() => {
      insertBot("b2", { name_key: "ba" });
    }).toThrow(/UNIQUE/);
    db.prepare(`UPDATE bots SET deleted_at = ? WHERE id = 'b1'`).run(NOW);
    expect(() => {
      insertBot("b2", { name_key: "ba" });
    }).toThrow(/UNIQUE/);
  });

  it("frees the name key after a purge, but never the slug", () => {
    insertBot("b1", { name_key: "ba", slug: "ba" });
    db.prepare(`UPDATE bots SET deleted_at = ?, purged_at = ? WHERE id = 'b1'`).run(NOW, NOW);
    insertBot("b2", { name_key: "ba", slug: "ba-2" });
    expect(() => {
      insertBot("b3", { name_key: "ba-other", slug: "ba" });
    }).toThrow(/UNIQUE/);
  });

  // SQLite checks uniqueness row by row, so a shift such as "pinned_position - 1" can fail
  // halfway, depending on row order (P4). Every write of the order does this instead.
  it("rewrites the pinned order as all NULL, then 1…n, in one transaction", () => {
    insertBot("b1", { pinned_position: 1 });
    insertBot("b2", { pinned_position: 2 });
    insertBot("b3", { pinned_position: 3 });
    db.transaction(() => {
      db.prepare(`UPDATE bots SET pinned_position = NULL WHERE pinned_position IS NOT NULL`).run();
      db.prepare(`UPDATE bots SET pinned_position = 1 WHERE id = 'b3'`).run();
      db.prepare(`UPDATE bots SET pinned_position = 2 WHERE id = 'b1'`).run();
    })();
    expect(
      db
        .prepare(`SELECT id FROM bots WHERE pinned_position IS NOT NULL ORDER BY pinned_position`)
        .all(),
    ).toEqual([{ id: "b3" }, { id: "b1" }]);
  });

  it.each([
    ["purged_at without deleted_at", { purged_at: NOW }],
    ["create_key without its hash", { create_key: "k" }],
    ["a hash without create_key", { create_request_hash: "h" }],
    ["an unknown avatar style", { avatar_style: "round" }],
    ["upload without a file", { avatar_style: "upload" }],
    ["a file without upload", { avatar_path: "avatars/x.webp" }],
  ])("refuses %s (CHECK)", (_label, fields) => {
    expect(() => {
      insertBot("b1", fields);
    }).toThrow(/CHECK/);
  });

  it("accepts an uploaded avatar with its file", () => {
    insertBot("b1", { avatar_style: "upload", avatar_path: "avatars/x.webp" });
  });
});
