import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

export interface Connections {
  /** The one write connection; only the unit of work uses it. */
  write: { sqlite: Database.Database; db: Db };
  /** Read-only connection: in WAL mode it sees committed rows only. */
  read: { sqlite: Database.Database; db: Db };
  close(): void;
}

const BUSY_TIMEOUT_MS = 5000;

/**
 * Opens the database with the settings from architecture.md §11: WAL, foreign keys on, a busy
 * timeout. Migrations are applied on the write connection before the read one opens.
 */
export function openDatabase(input: { file: string; migrationsFolder: string }): Connections {
  if (input.file !== ":memory:") mkdirSync(dirname(input.file), { recursive: true });

  const writer = new Database(input.file);
  writer.pragma("journal_mode = WAL");
  writer.pragma("foreign_keys = ON");
  writer.pragma(`busy_timeout = ${BUSY_TIMEOUT_MS}`);
  const writeDb = drizzle(writer, { schema });
  migrate(writeDb, { migrationsFolder: input.migrationsFolder });

  const reader = new Database(input.file, { readonly: true });
  reader.pragma(`busy_timeout = ${BUSY_TIMEOUT_MS}`);
  const readDb = drizzle(reader, { schema });

  return {
    write: { sqlite: writer, db: writeDb },
    read: { sqlite: reader, db: readDb },
    close() {
      reader.close();
      writer.close();
    },
  };
}
