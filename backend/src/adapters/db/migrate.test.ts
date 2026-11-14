import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import Database from "better-sqlite3";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { sleep, tempDir } from "../../../test/helpers.ts";
import { openWriter } from "./client.ts";
import { MIGRATIONS_FOLDER, migrate } from "./migrate.ts";

// The migration runner (M0b plan, decision E): one transaction, each migration applied exactly
// once even when two processes start at the same moment, and a failure changes nothing.
const BACKEND = resolve(import.meta.dirname, "../../..");
const CLI = join(BACKEND, "src/app/cli.ts");

let dir: ReturnType<typeof tempDir>;
beforeEach(() => {
  dir = tempDir("migrate");
});
afterEach(() => {
  dir.remove();
});

// A copy of the migrations folder with one more migration after the committed ones.
function withExtraMigration(tag: string, sql: string): string {
  const folder = join(dir.path, "migrations");
  cpSync(MIGRATIONS_FOLDER, folder, { recursive: true });
  const journal = join(folder, "meta/_journal.json");
  const { entries } = JournalFile.parse(JSON.parse(readFileSync(journal, "utf8")));
  const last = entries.at(-1);
  writeFileSync(join(folder, `${tag}.sql`), sql);
  writeFileSync(
    journal,
    JSON.stringify({
      version: "7",
      dialect: "sqlite",
      entries: [
        ...entries,
        {
          idx: entries.length,
          version: "6",
          when: (last?.when ?? 0) + 1,
          tag,
          breakpoints: true,
        },
      ],
    }),
  );
  return folder;
}

const JournalFile = z.object({
  entries: z.array(z.looseObject({ when: z.number() })),
});
const COMMITTED = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER }).length;

const tables = (sqlite: Database.Database) =>
  sqlite
    .prepare<[], { name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    )
    .all()
    .map((row) => row.name);

describe("migrate", () => {
  it("applies the pending migrations, then nothing on a second run", () => {
    const sqlite = openWriter(join(dir.path, "app.db"));
    expect(migrate(sqlite, MIGRATIONS_FOLDER)).toBe(COMMITTED);
    expect(migrate(sqlite, MIGRATIONS_FOLDER)).toBe(0);
    expect(tables(sqlite)).toEqual([
      "__drizzle_migrations",
      "bot_skills",
      "bots",
      "events",
      "settings",
      "skill_versions",
      "skills",
      "sqlite_sequence",
    ]);
    sqlite.close();
  });

  // Each runner is a separate process, started while this test holds the write lock, so all of
  // them are waiting when the lock comes free: the race always happens.
  async function race(file: string, start: (index: number) => ChildProcess): Promise<number[]> {
    // Opened as the app opens it (WAL), as the first process to start would hold it.
    const lock = openWriter(file);
    lock.exec("BEGIN IMMEDIATE");
    const runs = [0, 1, 2].map((index) => {
      const child = start(index);
      let out = "";
      child.stdout?.on("data", (chunk: Buffer) => (out += chunk.toString()));
      child.stderr?.on("data", (chunk: Buffer) => (out += chunk.toString()));
      return new Promise<string>((done) =>
        child.on("close", (code) => {
          done(`${code ?? "?"} ${out}`);
        }),
      );
    });
    await sleep(1500);
    lock.exec("COMMIT");
    lock.close();
    const outputs = await Promise.all(runs);
    for (const output of outputs) expect(output).toMatch(/^0 /);
    return outputs.map((output) => Number(/(\d+) migration/.exec(output)?.[1] ?? -1)).sort();
  }

  it("applies each migration once when three `db migrate` processes race on a new database", async () => {
    const file = join(dir.path, "app.db");
    const applied = await race(file, () =>
      spawn(process.execPath, [CLI, "db", "migrate"], {
        env: { PATH: process.env.PATH, DATA_DIR: dir.path },
      }),
    );
    // The `db migrate` CLI prints how many migrations it applied: one process applies all.
    expect(applied).toEqual([0, 0, COMMITTED]);
    const sqlite = new Database(file);
    expect(sqlite.prepare("SELECT count(*) AS n FROM __drizzle_migrations").get()).toEqual({
      n: COMMITTED,
    });
    sqlite.close();
  });

  it("applies a new migration once when three processes race on an existing database", async () => {
    const file = join(dir.path, "app.db");
    const sqlite = openWriter(file);
    migrate(sqlite, MIGRATIONS_FOLDER);
    sqlite.close();
    const folder = withExtraMigration("9999_extra", "CREATE TABLE extra (id integer);");
    const script = `import { migrate } from ${JSON.stringify(join(import.meta.dirname, "migrate.ts"))};
import { openWriter } from ${JSON.stringify(join(import.meta.dirname, "client.ts"))};
console.log(migrate(openWriter(${JSON.stringify(file)}), ${JSON.stringify(folder)}) + " migration(s) applied");`;
    const applied = await race(file, () =>
      spawn(process.execPath, ["--input-type=module", "-e", script]),
    );
    expect(applied).toEqual([0, 0, 1]);
    const check = new Database(file);
    expect(check.prepare("SELECT count(*) AS n FROM __drizzle_migrations").get()).toEqual({
      n: COMMITTED + 1,
    });
    check.close();
  });

  it("rolls back every migration of the run when one fails", () => {
    const folder = withExtraMigration(
      "9999_broken",
      "CREATE TABLE ok_table (id integer);\n--> statement-breakpoint\nNOT SQL;\n",
    );
    const sqlite = openWriter(join(dir.path, "app.db"));
    expect(() => migrate(sqlite, folder)).toThrow(/syntax error/);
    expect(sqlite.inTransaction).toBe(false);
    expect(tables(sqlite)).toEqual([]);
    sqlite.close();
  });

  // Foreign keys during the run (plan p3-migration-foreign-keys): the runner turns them off
  // before its transaction, checks the references before the commit, and turns them on again.
  describe("foreign keys", () => {
    // A migration folder in drizzle-kit's format, one SQL text for each migration, in order.
    // Each call writes the same folder again, so a test can add a migration after a first run.
    function writeMigrations(...sqls: string[]): string {
      const folder = join(dir.path, "own-migrations");
      mkdirSync(join(folder, "meta"), { recursive: true });
      const entries = sqls.map((sql, idx) => {
        const tag = `${String(idx).padStart(4, "0")}_step`;
        writeFileSync(join(folder, `${tag}.sql`), sql);
        return { idx, version: "6", when: 1000 + idx, tag, breakpoints: true };
      });
      writeFileSync(
        join(folder, "meta/_journal.json"),
        JSON.stringify({ version: "7", dialect: "sqlite", entries }),
      );
      return folder;
    }

    const parentAndChild = (action: string) =>
      [
        "CREATE TABLE `parent` (`id` text PRIMARY KEY NOT NULL, `name` text NOT NULL);",
        `CREATE TABLE \`child\` (\`id\` text PRIMARY KEY NOT NULL, \`parent_id\` text REFERENCES \`parent\`(\`id\`) ON DELETE ${action});`,
      ].join("\n--> statement-breakpoint\n");

    // A rebuild of `parent` in the shape that drizzle-kit writes (REAL_REBUILD below): `name`
    // loses its NOT NULL, which ALTER TABLE cannot do.
    const REBUILD_PARENT = [
      "PRAGMA foreign_keys=OFF;",
      "CREATE TABLE `__new_parent` (`id` text PRIMARY KEY NOT NULL, `name` text);",
      'INSERT INTO `__new_parent`("id", "name") SELECT "id", "name" FROM `parent`;',
      "DROP TABLE `parent`;",
      "ALTER TABLE `__new_parent` RENAME TO `parent`;",
      "PRAGMA foreign_keys=ON;",
    ].join("--> statement-breakpoint\n");

    // The statements of drizzle-kit itself: `pnpm --filter backend db:generate` after
    // `skills.author_id` lost its NOT NULL (2026-11-15, a scratch change that was not kept).
    // `skill_versions` points to `skills`, so `skills` is a parent table.
    const REAL_REBUILD = `PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE \`__new_skills\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`slug\` text NOT NULL,
	\`name\` text NOT NULL,
	\`author_id\` text,
	\`cloned_from_skill_version_id\` text,
	\`row_version\` integer DEFAULT 1 NOT NULL,
	\`created_at\` text NOT NULL,
	\`updated_at\` text NOT NULL,
	\`deprecated_at\` text,
	\`trashed_at\` text,
	\`trashed_bot_ids\` text,
	FOREIGN KEY (\`cloned_from_skill_version_id\`) REFERENCES \`skill_versions\`(\`id\`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "skills_trashed_needs_deprecated" CHECK("__new_skills"."trashed_at" IS NULL OR "__new_skills"."deprecated_at" IS NOT NULL)
);
--> statement-breakpoint
INSERT INTO \`__new_skills\`("id", "slug", "name", "author_id", "cloned_from_skill_version_id", "row_version", "created_at", "updated_at", "deprecated_at", "trashed_at", "trashed_bot_ids") SELECT "id", "slug", "name", "author_id", "cloned_from_skill_version_id", "row_version", "created_at", "updated_at", "deprecated_at", "trashed_at", "trashed_bot_ids" FROM \`skills\`;--> statement-breakpoint
DROP TABLE \`skills\`;--> statement-breakpoint
ALTER TABLE \`__new_skills\` RENAME TO \`skills\`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX \`skills_slug_unique\` ON \`skills\` (\`slug\`);`;

    const SKILL_WITH_VERSION = `INSERT INTO skills (id, slug, name, author_id, created_at, updated_at)
  VALUES ('s1', 'one', 'One', 'owner', '2026-11-15T00:00:00.000Z', '2026-11-15T00:00:00.000Z');
INSERT INTO skill_versions (id, skill_id, version, description, body_md, created_by, created_at)
  VALUES ('v1', 's1', 1, 'd', 'b', 'owner', '2026-11-15T00:00:00.000Z');`;

    // The committed migrations, then one skill with one version.
    function realDatabaseWithRows(file: string) {
      const sqlite = openWriter(file);
      migrate(sqlite, MIGRATIONS_FOLDER);
      sqlite.exec(SKILL_WITH_VERSION);
      return sqlite;
    }

    // Migration 0 makes `parent` and `child`; then one child row points to one parent row.
    function withParentAndChild(action: string) {
      const sqlite = openWriter(join(dir.path, "app.db"));
      migrate(sqlite, writeMigrations(parentAndChild(action)));
      sqlite.exec(
        "INSERT INTO parent VALUES ('p1', 'one'); INSERT INTO child VALUES ('c1', 'p1');",
      );
      return sqlite;
    }

    const rows = (sqlite: Database.Database, table: "parent" | "child") =>
      sqlite.prepare(`SELECT * FROM ${table} ORDER BY id`).all();
    const recorded = (sqlite: Database.Database) =>
      sqlite.prepare<[], { n: number }>("SELECT count(*) AS n FROM __drizzle_migrations").get()?.n;
    const foreignKeys = (sqlite: Database.Database) =>
      sqlite.pragma("foreign_keys", { simple: true });
    // 1 when the column is NOT NULL; the column as "table.column".
    const notNull = (sqlite: Database.Database, column: "skills.author_id" | "parent.name") => {
      const [table = "", name = ""] = column.split(".");
      return sqlite
        .prepare<[string, string], { notnull: number }>(
          'SELECT "notnull" FROM pragma_table_info(?) WHERE name = ?',
        )
        .get(table, name)?.notnull;
    };
    const errorOf = (run: () => unknown): string => {
      try {
        run();
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
      return "no error";
    };
    // A migration that leaves a child row with no parent row.
    const BROKEN_REFERENCE = "INSERT INTO child VALUES ('private-child', 'private-parent');";

    it("rebuilds a parent table that has a child row (drizzle-kit's statements, ON DELETE no action)", () => {
      const sqlite = realDatabaseWithRows(join(dir.path, "app.db"));
      const folder = withExtraMigration("9999_rebuild_skills", REAL_REBUILD);
      expect(migrate(sqlite, folder)).toBe(1);
      expect(sqlite.prepare("SELECT id, skill_id FROM skill_versions").all()).toEqual([
        { id: "v1", skill_id: "s1" },
      ]);
      expect(notNull(sqlite, "skills.author_id")).toBe(0);
      sqlite.close();
    });

    it("keeps the child row of an ON DELETE cascade key when it rebuilds the parent table", () => {
      const sqlite = withParentAndChild("cascade");
      expect(migrate(sqlite, writeMigrations(parentAndChild("cascade"), REBUILD_PARENT))).toBe(1);
      expect(rows(sqlite, "child")).toEqual([{ id: "c1", parent_id: "p1" }]);
      expect(notNull(sqlite, "parent.name")).toBe(0);
      sqlite.close();
    });

    it("keeps the parent id of an ON DELETE set null key when it rebuilds the parent table", () => {
      const sqlite = withParentAndChild("set null");
      expect(migrate(sqlite, writeMigrations(parentAndChild("set null"), REBUILD_PARENT))).toBe(1);
      expect(rows(sqlite, "child")).toEqual([{ id: "c1", parent_id: "p1" }]);
      sqlite.close();
    });

    it("ignores a PRAGMA foreign_keys=ON line of the migration file before its rebuild", () => {
      const sqlite = withParentAndChild("cascade");
      const folder = writeMigrations(
        parentAndChild("cascade"),
        `PRAGMA foreign_keys=ON;--> statement-breakpoint\n${REBUILD_PARENT}`,
      );
      expect(migrate(sqlite, folder)).toBe(1);
      expect(rows(sqlite, "child")).toEqual([{ id: "c1", parent_id: "p1" }]);
      sqlite.close();
    });

    it("stops a migration that deletes a parent row of an ON DELETE cascade key", () => {
      const sqlite = withParentAndChild("cascade");
      const folder = writeMigrations(
        parentAndChild("cascade"),
        "DELETE FROM parent WHERE id = 'p1';",
      );
      expect(() => migrate(sqlite, folder)).toThrow(/broken foreign key reference/);
      expect(rows(sqlite, "parent")).toEqual([{ id: "p1", name: "one" }]);
      expect(rows(sqlite, "child")).toEqual([{ id: "c1", parent_id: "p1" }]);
      expect(recorded(sqlite)).toBe(1);
      sqlite.close();
    });

    it("names the table, the row number and the parent table of a broken reference, and no value of the row", () => {
      const sqlite = withParentAndChild("no action");
      const folder = writeMigrations(parentAndChild("no action"), BROKEN_REFERENCE);
      const message = errorOf(() => migrate(sqlite, folder));
      expect(message).toBe(
        "The migrations leave 1 broken foreign key reference, so none of them is applied: child row 2 -> parent",
      );
      expect(message).not.toContain("private");
      expect(recorded(sqlite)).toBe(1);
      sqlite.close();
    });

    it("rolls back an applied migration of the run when the check fails after a later one", () => {
      const sqlite = withParentAndChild("no action");
      const folder = writeMigrations(
        parentAndChild("no action"),
        "CREATE TABLE first_table (id integer);",
        BROKEN_REFERENCE,
      );
      expect(() => migrate(sqlite, folder)).toThrow(/broken foreign key reference/);
      expect(tables(sqlite)).not.toContain("first_table");
      expect(recorded(sqlite)).toBe(1);
      sqlite.close();
    });

    it("shows the first 10 broken references and the full count", () => {
      const sqlite = withParentAndChild("no action");
      const folder = writeMigrations(
        parentAndChild("no action"),
        "WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 12) INSERT INTO child SELECT 'x' || i, 'gone' || i FROM n;",
      );
      const message = errorOf(() => migrate(sqlite, folder));
      expect(message).toMatch(/^The migrations leave 12 broken foreign key references/);
      expect(message.match(/child row \d+ -> parent/g)).toHaveLength(10);
      expect(message).toMatch(/child row 11 -> parent \(the first 10 of 12\)$/);
      sqlite.close();
    });

    it("applies a rebuild once and loses no row when three processes race on a database with rows", async () => {
      const file = join(dir.path, "app.db");
      realDatabaseWithRows(file).close();
      const folder = withExtraMigration("9999_rebuild_skills", REAL_REBUILD);
      const script = `import { migrate } from ${JSON.stringify(join(import.meta.dirname, "migrate.ts"))};
import { openWriter } from ${JSON.stringify(join(import.meta.dirname, "client.ts"))};
console.log(migrate(openWriter(${JSON.stringify(file)}), ${JSON.stringify(folder)}) + " migration(s) applied");`;
      const applied = await race(file, () =>
        spawn(process.execPath, ["--input-type=module", "-e", script]),
      );
      expect(applied).toEqual([0, 0, 1]);
      const check = new Database(file);
      expect(check.prepare("SELECT id, skill_id FROM skill_versions").all()).toEqual([
        { id: "v1", skill_id: "s1" },
      ]);
      expect(check.prepare("SELECT id FROM skills").all()).toEqual([{ id: "s1" }]);
      expect(notNull(check, "skills.author_id")).toBe(0);
      check.close();
    });

    it("does not check old references when no migration waits", () => {
      const sqlite = withParentAndChild("no action");
      sqlite.pragma("foreign_keys = OFF");
      sqlite.exec(BROKEN_REFERENCE);
      sqlite.pragma("foreign_keys = ON");
      let applied = -1;
      expect(() => {
        applied = migrate(sqlite, writeMigrations(parentAndChild("no action")));
      }).not.toThrow();
      expect(applied).toBe(0);
      sqlite.close();
    });

    it("leaves foreign_keys on after a successful run", () => {
      const sqlite = withParentAndChild("no action");
      const folder = writeMigrations(
        parentAndChild("no action"),
        "CREATE TABLE extra (id integer);",
      );
      expect(migrate(sqlite, folder)).toBe(1);
      expect(foreignKeys(sqlite), "after a success").toBe(1);
      sqlite.close();
    });

    it("leaves foreign_keys on after a failed statement", () => {
      const sqlite = withParentAndChild("no action");
      const folder = writeMigrations(parentAndChild("no action"), "NOT SQL;");
      expect(() => migrate(sqlite, folder)).toThrow(/syntax error/);
      expect(foreignKeys(sqlite), "after a failed statement").toBe(1);
      sqlite.close();
    });

    it("leaves foreign_keys on after a failed foreign_key_check", () => {
      const sqlite = withParentAndChild("no action");
      const folder = writeMigrations(parentAndChild("no action"), BROKEN_REFERENCE);
      expect(() => migrate(sqlite, folder)).toThrow();
      expect(foreignKeys(sqlite), "after a failed check").toBe(1);
      sqlite.close();
    });

    it("stops when foreign_keys does not read back as 1 after the run", () => {
      const sqlite = withParentAndChild("no action");
      const pragma = sqlite.pragma.bind(sqlite);
      // Only the read-back gets a wrong value; each other pragma runs on the database.
      sqlite.pragma = (source: string, options?: Database.PragmaOptions): unknown =>
        source === "foreign_keys" && options?.simple === true ? 0 : pragma(source, options);
      const folder = writeMigrations(
        parentAndChild("no action"),
        "CREATE TABLE extra (id integer);",
      );
      expect(() => migrate(sqlite, folder)).toThrow(
        "foreign_keys is 0 after the migrations, not 1",
      );
      sqlite.close();
    });
  });
});

describe("startup with a failing migration", () => {
  it("exits non-zero before it listens", () => {
    // `events` already exists, so the first migration fails.
    const sqlite = new Database(join(dir.path, "app.db"));
    sqlite.exec("CREATE TABLE events (x integer)");
    sqlite.close();
    const run = spawnSync(process.execPath, [join(BACKEND, "src/app/main.ts")], {
      env: { PATH: process.env.PATH, DATA_DIR: dir.path, PORT: "8798", LOG_LEVEL: "info" },
      encoding: "utf8",
      timeout: 10_000,
    });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("startup failed");
    expect(run.stdout).toContain("already exists");
    expect(run.stdout).not.toContain('"msg":"listening"');
  });
});
