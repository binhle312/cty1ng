import fs from "node:fs";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.ts";

export type Db = BetterSQLite3Database<typeof schema>;

// SQLite settings of architecture.md §11: WAL, foreign keys on, a 5 s busy timeout.
const BUSY_TIMEOUT_MS = 5000;

// The writers open in this thread, by the identity of their file. better-sqlite3 is synchronous,
// so a second writer's write on one thread blocks the thread while it waits for the first
// writer's lock, for up to `busy_timeout`, and then fails with SQLITE_BUSY: the first writer
// cannot commit while the thread is blocked. The guard catches this programming error at once,
// at the open. A writer in another process or on a worker thread waits on its own thread and is
// not limited here.
const openWriters = new Map<string, Database.Database>();

export class WriterAlreadyOpenError extends Error {}

// The writer connection. SQLite allows one active writer per database; the unit of work
// serializes write transactions on this connection. A second writer for the same file in this
// thread is refused, also through a symlink, a hard link or another path to the same file.
// Closing the writer frees the file. `:memory:` and "" (a temporary database) have no file to
// key on, so they are refused too; the app always writes to its database file.
export function openWriter(file: string): Database.Database {
  if (file === ":memory:" || file === "") {
    throw new Error(
      `openWriter needs a database file, not ${JSON.stringify(file)}: one writer per file is checked by the file's identity`,
    );
  }
  const sqlite = new Database(file);
  // Read after the open: the file exists now, and a symlink resolves to the file SQLite opened.
  let key: string;
  try {
    key = fileIdentity(sqlite.name);
  } catch (error) {
    sqlite.close();
    throw error;
  }
  // Before the pragmas, so a refused writer fails at once instead of waiting on the lock.
  if (openWriters.has(key)) {
    sqlite.close();
    throw new WriterAlreadyOpenError(
      `A writer is already open for ${file} in this thread; open one writer per database (docs/architecture.md §11)`,
    );
  }
  try {
    // First, so that every later statement waits for a lock held by another process instead of
    // failing at once (switching to WAL needs the lock too).
    sqlite.pragma(`busy_timeout = ${BUSY_TIMEOUT_MS}`);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    sqlite.pragma("synchronous = NORMAL");
  } catch (error) {
    sqlite.close();
    throw error;
  }
  openWriters.set(key, sqlite);
  const close = sqlite.close.bind(sqlite);
  sqlite.close = () => {
    // If close throws (a statement still runs), the connection stays open and keeps the file.
    close();
    // A second close of an old writer must not free the file for a newer writer.
    if (openWriters.get(key) === sqlite) openWriters.delete(key);
    return sqlite;
  };
  return sqlite;
}

// Device and inode of the file. bigint, because an inode number can be above 2^53.
function fileIdentity(file: string): string {
  const stats = fs.statSync(file, { bigint: true });
  return `${stats.dev}:${stats.ino}`;
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
