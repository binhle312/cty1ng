import type Database from "better-sqlite3";
import { sql } from "drizzle-orm";
import type { Readers, Tx, UnitOfWork } from "../../core/ports/repositories.ts";
import { toDrizzle } from "./client.ts";
import { eventsRepository, settingsRepository, skillsRepository } from "./repositories.ts";

// The unit of work on SQLite (architecture.md §2, §11). SQLite allows one active writer per
// database, and better-sqlite3 has one connection: an `await` inside a transaction would let
// other code run on it. So each whole write transaction waits for the one before it to end,
// then starts with BEGIN IMMEDIATE (the write lock up front). Reads inside a transaction use
// its own repositories; independent reads use the reader connection.
export function sqliteUnitOfWork(
  writer: Database.Database,
  onAfterCommitError: (error: unknown) => void,
): UnitOfWork {
  const db = toDrizzle(writer);
  let tail: Promise<void> = Promise.resolve();

  return {
    async run(work) {
      const previous = tail;
      let release = (): void => undefined;
      tail = new Promise((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        return await transaction(work);
      } finally {
        release();
      }
    },
  };

  async function transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    const callbacks: (() => void)[] = [];
    const tx: Tx = {
      events: eventsRepository(db),
      settings: settingsRepository(db),
      skills: skillsRepository(db),
      afterCommit: (callback) => callbacks.push(callback),
    };
    begin();
    let result: T;
    try {
      result = await work(tx);
      writer.exec("COMMIT");
    } catch (error) {
      if (writer.inTransaction) writer.exec("ROLLBACK");
      throw error;
    }
    for (const callback of callbacks) {
      try {
        callback();
      } catch (error) {
        // The transaction is committed; a failed callback must not report it as failed.
        onAfterCommitError(error);
      }
    }
    return result;
  }

  // One retry when another process holds the write lock longer than busy_timeout
  // (architecture.md §11: retry on a busy error happens once, inside the unit of work).
  function begin(): void {
    try {
      writer.exec("BEGIN IMMEDIATE");
    } catch (error) {
      if (!isBusy(error)) throw error;
      writer.exec("BEGIN IMMEDIATE");
    }
  }
}

function isBusy(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "SQLITE_BUSY";
}

export function sqliteReaders(reader: Database.Database): Readers {
  const db = toDrizzle(reader);
  return {
    events: eventsRepository(db),
    settings: settingsRepository(db),
    skills: skillsRepository(db),
    ping: () => {
      try {
        db.get(sql`SELECT 1`);
        return Promise.resolve(true);
      } catch {
        return Promise.resolve(false);
      }
    },
  };
}
