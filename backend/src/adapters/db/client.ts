import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.ts";

export type Db = BetterSQLite3Database<typeof schema>;

// SQLite settings of architecture.md §11: WAL, foreign keys on, a 5 s busy timeout.
const BUSY_TIMEOUT_MS = 5000;

// The writer connection. SQLite allows one active writer per database; the unit of work
// serializes write transactions on this connection. Open one writer per process: better-sqlite3
// is synchronous, so a second writer in the same process would wait for the lock on the only
// thread, and the first could never commit.
export function openWriter(file: string): Database.Database {
  const sqlite = new Database(file);
  // First, so that every later statement waits for a lock held by another process instead of
  // failing at once (switching to WAL needs the lock too).
  sqlite.pragma(`busy_timeout = ${BUSY_TIMEOUT_MS}`);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("synchronous = NORMAL");
  return sqlite;
}

// A read-only connection for reads outside a transaction. With WAL they never wait for a
// writer and see only committed data.
export function openReader(file: string): Database.Database {
  const sqlite = new Database(file, { readonly: true, fileMustExist: true });
  sqlite.pragma(`busy_timeout = ${BUSY_TIMEOUT_MS}`);
  return sqlite;
}

export function toDrizzle(sqlite: Database.Database): Db {
  return drizzle(sqlite, { schema });
}
