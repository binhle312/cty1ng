import { AsyncLocalStorage } from "node:async_hooks";
import type { DatabaseProbe, Repositories, UnitOfWork } from "../../core/ports/repositories";
import type { Connections } from "./connection";
import { createEventsRepository } from "./events-repository";
import { createSettingsRepository } from "./settings-repository";

/**
 * The unit of work on SQLite (architecture.md §2, §11).
 *
 * better-sqlite3 is synchronous, but the port is async (Postgres later), so a transaction stays
 * open across awaits. Two transactions on one connection would then interleave, so `run` holds
 * an in-process lock: one write transaction at a time per process, which is what SQLite allows
 * anyway. `BEGIN IMMEDIATE` takes the database write lock up front, which also serialises us
 * against other processes (the CLI); `busy_timeout` makes them wait instead of failing.
 */
export function createUnitOfWork(deps: {
  connections: Connections;
  /** Runs after each commit; the app wires the event hub's `notify` here. */
  onCommit: () => void;
}): UnitOfWork {
  const { sqlite, db } = deps.connections.write;
  const repositories: Repositories = {
    events: createEventsRepository(db),
    settings: createSettingsRepository(db),
  };
  const insideWork = new AsyncLocalStorage<true>();
  let queue: Promise<unknown> = Promise.resolve();

  async function once<T>(work: (tx: Repositories) => Promise<T>): Promise<T> {
    // Reviewed exception to the raw-SQL ban (security.md §2.8): constant statements, no input.
    // eslint-disable-next-line no-restricted-syntax
    sqlite.exec("BEGIN IMMEDIATE");
    try {
      const result = await insideWork.run(true, () => work(repositories));
      // eslint-disable-next-line no-restricted-syntax
      sqlite.exec("COMMIT");
      return result;
    } catch (error) {
      // eslint-disable-next-line no-restricted-syntax
      if (sqlite.inTransaction) sqlite.exec("ROLLBACK");
      throw error;
    }
  }

  async function withRetry<T>(work: (tx: Repositories) => Promise<T>): Promise<T> {
    try {
      return await once(work);
    } catch (error) {
      // One retry on a busy database, never on business errors (architecture.md §11).
      if (!isBusy(error)) throw error;
      return once(work);
    }
  }

  return {
    run<T>(work: (tx: Repositories) => Promise<T>): Promise<T> {
      if (insideWork.getStore()) {
        return Promise.reject(new Error("units of work do not nest"));
      }
      const result = queue.then(() => withRetry(work));
      queue = result.then(
        () => undefined,
        () => undefined,
      );
      return result.then((value) => {
        deps.onCommit();
        return value;
      });
    },
  };
}

export function createDatabaseProbe(connections: Connections): DatabaseProbe {
  return {
    async ping() {
      connections.read.sqlite.prepare("SELECT 1").get();
    },
  };
}

function isBusy(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "SQLITE_BUSY" || error.code === "SQLITE_BUSY_SNAPSHOT")
  );
}
