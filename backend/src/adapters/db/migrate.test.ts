import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { cpSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import Database from "better-sqlite3";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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
  const [first] = readMigrationFiles({ migrationsFolder: folder });
  writeFileSync(join(folder, `${tag}.sql`), sql);
  writeFileSync(
    join(folder, "meta/_journal.json"),
    JSON.stringify({
      version: "7",
      dialect: "sqlite",
      entries: [
        { idx: 0, version: "6", when: first?.folderMillis, tag: "0000_init", breakpoints: true },
        { idx: 1, version: "6", when: (first?.folderMillis ?? 0) + 1, tag, breakpoints: true },
      ],
    }),
  );
  return folder;
}

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
    expect(migrate(sqlite, MIGRATIONS_FOLDER)).toBe(
      readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER }).length,
    );
    expect(migrate(sqlite, MIGRATIONS_FOLDER)).toBe(0);
    expect(tables(sqlite)).toEqual([
      "__drizzle_migrations",
      "events",
      "settings",
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
    expect(applied).toEqual([0, 0, 1]);
    const sqlite = new Database(file);
    expect(sqlite.prepare("SELECT count(*) AS n FROM __drizzle_migrations").get()).toEqual({
      n: 1,
    });
    sqlite.close();
  });

  it("applies a new migration once when three processes race on an existing database", async () => {
    const file = join(dir.path, "app.db");
    const sqlite = openWriter(file);
    migrate(sqlite, MIGRATIONS_FOLDER);
    sqlite.close();
    const folder = withExtraMigration("0001_extra", "CREATE TABLE extra (id integer);");
    const script = `import { migrate } from ${JSON.stringify(join(import.meta.dirname, "migrate.ts"))};
import { openWriter } from ${JSON.stringify(join(import.meta.dirname, "client.ts"))};
console.log(migrate(openWriter(${JSON.stringify(file)}), ${JSON.stringify(folder)}) + " migration(s) applied");`;
    const applied = await race(file, () =>
      spawn(process.execPath, ["--input-type=module", "-e", script]),
    );
    expect(applied).toEqual([0, 0, 1]);
    const check = new Database(file);
    expect(check.prepare("SELECT count(*) AS n FROM __drizzle_migrations").get()).toEqual({ n: 2 });
    check.close();
  });

  it("rolls back every migration of the run when one fails", () => {
    const folder = withExtraMigration(
      "0001_broken",
      "CREATE TABLE ok_table (id integer);\n--> statement-breakpoint\nNOT SQL;\n",
    );
    const sqlite = openWriter(join(dir.path, "app.db"));
    expect(() => migrate(sqlite, folder)).toThrow(/syntax error/);
    expect(sqlite.inTransaction).toBe(false);
    expect(tables(sqlite)).toEqual([]);
    sqlite.close();
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
