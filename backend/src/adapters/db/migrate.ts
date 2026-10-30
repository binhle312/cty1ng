import { resolve } from "node:path";
import type Database from "better-sqlite3";
import { readMigrationFiles } from "drizzle-orm/migrator";

// The one migration runner, used at start and by `db:migrate` (M0b plan, decision E).
// Drizzle's own SQLite migrator reads the last applied migration before it begins its
// transaction, so two processes starting at once could both apply the same migration. Here the
// write lock comes first: BEGIN IMMEDIATE, then read, apply and record, then COMMIT. A second
// process waits for the lock and then finds nothing pending. A failure rolls everything back.
//
// Applied migrations are recorded in drizzle-kit's table and format, so drizzle-kit tools keep
// working on the same database.
const MIGRATIONS_TABLE = "__drizzle_migrations";

// backend/migrations: the SQL that drizzle-kit writes from schema.ts.
export const MIGRATIONS_FOLDER = resolve(import.meta.dirname, "../../../migrations");

export function migrate(sqlite: Database.Database, migrationsFolder: string): number {
  const migrations = readMigrationFiles({ migrationsFolder });
  sqlite.exec("BEGIN IMMEDIATE");
  try {
    sqlite.exec(
      `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (id INTEGER PRIMARY KEY, hash text NOT NULL, created_at numeric)`,
    );
    const last = sqlite
      .prepare<[], { created_at: number }>(
        `SELECT created_at FROM ${MIGRATIONS_TABLE} ORDER BY created_at DESC LIMIT 1`,
      )
      .get();
    const record = sqlite.prepare<[string, number]>(
      `INSERT INTO ${MIGRATIONS_TABLE} (hash, created_at) VALUES (?, ?)`,
    );
    let applied = 0;
    for (const migration of migrations) {
      if (last !== undefined && last.created_at >= migration.folderMillis) continue;
      // Reviewed SQL from the committed migration files (architecture.md §10 guardrail 3).
      for (const statement of migration.sql) sqlite.exec(statement);
      record.run(migration.hash, migration.folderMillis);
      applied += 1;
    }
    sqlite.exec("COMMIT");
    return applied;
  } catch (error) {
    if (sqlite.inTransaction) sqlite.exec("ROLLBACK");
    throw error;
  }
}
