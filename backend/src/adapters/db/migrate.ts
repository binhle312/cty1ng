import { resolve } from "node:path";
import type Database from "better-sqlite3";
import { readMigrationFiles, type MigrationMeta } from "drizzle-orm/migrator";
import { z } from "zod";

// The one migration runner, used at start and by `db:migrate` (M0b plan, decision E).
// Drizzle's own SQLite migrator reads the last applied migration before it begins its
// transaction, so two processes starting at once could both apply the same migration. Here the
// write lock comes first: BEGIN IMMEDIATE, then read, apply and record, then COMMIT. A second
// process waits for the lock and then finds nothing pending. A failure rolls everything back.
//
// Foreign keys (plan p3-migration-foreign-keys): for a change that ALTER TABLE cannot do,
// drizzle-kit rebuilds the table, and the DROP TABLE of a parent table fails or starts an
// ON DELETE action while the keys are on. SQLite ignores `PRAGMA foreign_keys` inside a
// transaction, so the PRAGMA lines of a migration file do no work: only this runner sets the
// value. It turns the keys off before BEGIN IMMEDIATE, runs `PRAGMA foreign_key_check` before
// the COMMIT when it applied a migration, and turns the keys on again. With the keys off, a
// DELETE in a migration starts no ON DELETE action: the child row stays, the check finds it,
// and the run rolls back. The app writes on this connection after the start, so the runner
// reads the value back and throws if the keys are not on.
//
// Applied migrations are recorded in drizzle-kit's table and format, so drizzle-kit tools keep
// working on the same database.
const MIGRATIONS_TABLE = "__drizzle_migrations";

// The broken references that the error of a failed check names (approved in the plan).
const SHOWN_REFERENCES = 10;

// backend/migrations: the SQL that drizzle-kit writes from schema.ts.
export const MIGRATIONS_FOLDER = resolve(import.meta.dirname, "../../../migrations");

export function migrate(sqlite: Database.Database, migrationsFolder: string): number {
  const migrations = readMigrationFiles({ migrationsFolder });
  sqlite.pragma("foreign_keys = OFF");
  let failure: unknown;
  try {
    return applyPending(sqlite, migrations);
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    keysOn(sqlite, failure);
  }
}

// Turns the keys on and reads the value back, after each end of the run. A value that is not
// 1 stops the start; the error of a failed run stays as its cause.
function keysOn(sqlite: Database.Database, failure: unknown): void {
  sqlite.pragma("foreign_keys = ON");
  const value = sqlite.pragma("foreign_keys", { simple: true });
  if (value !== 1) {
    throw new Error(
      `foreign_keys is ${String(value)} after the migrations, not 1`,
      failure === undefined ? undefined : { cause: failure },
    );
  }
}

function applyPending(sqlite: Database.Database, migrations: MigrationMeta[]): number {
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
    // Only after a change: a check at each start would be a new gate for data that is there
    // already (plan p3-migration-foreign-keys, part 2).
    if (applied > 0) {
      const broken = BrokenReferences.parse(sqlite.pragma("foreign_key_check"));
      if (broken.length > 0) throw new Error(brokenMessage(broken));
    }
    sqlite.exec("COMMIT");
    return applied;
  } catch (error) {
    if (sqlite.inTransaction) sqlite.exec("ROLLBACK");
    throw error;
  }
}

// One row of `PRAGMA foreign_key_check`. `rowid` is null for a table with no rowid.
const BrokenReferences = z.array(
  z.object({ table: z.string(), rowid: z.number().nullable(), parent: z.string() }),
);

// Names the table, the row number and the parent table of each reference; no value of a row.
function brokenMessage(broken: z.infer<typeof BrokenReferences>): string {
  const count = broken.length;
  const shown = broken
    .slice(0, SHOWN_REFERENCES)
    .map(({ table, rowid, parent }) =>
      rowid === null ? `${table} -> ${parent}` : `${table} row ${String(rowid)} -> ${parent}`,
    )
    .join(", ");
  const more =
    count > SHOWN_REFERENCES ? ` (the first ${String(SHOWN_REFERENCES)} of ${String(count)})` : "";
  return `The migrations leave ${String(count)} broken foreign key ${count === 1 ? "reference" : "references"}, so none of them is applied: ${shown}${more}`;
}
