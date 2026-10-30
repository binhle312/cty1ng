import { Worker } from "node:worker_threads";
import { z } from "zod";
import { openReader, openWriter } from "../../src/adapters/db/client.ts";
import { MIGRATIONS_FOLDER, migrate } from "../../src/adapters/db/migrate.ts";
import { sqliteReaders, sqliteUnitOfWork } from "../../src/adapters/db/unit-of-work.ts";
import { tempDir } from "../helpers.ts";
import { unitOfWorkContract } from "./unit-of-work.contract.ts";

// The Drizzle unit of work on SQLite, on a migrated temporary database file (not :memory:, so
// WAL, the reader connection and the second writer behave as in the app).
const Reply = z.object({ id: z.number(), won: z.boolean() });

unitOfWorkContract("Drizzle on SQLite", () => {
  const dir = tempDir("uow");
  const file = `${dir.path}/app.db`;
  const writer = openWriter(file);
  migrate(writer, MIGRATIONS_FOLDER);
  const reader = openReader(file);
  const worker = new Worker(new URL("./other-writer.worker.ts", import.meta.url), {
    workerData: file,
  });
  const waiting = new Map<number, (won: boolean) => void>();
  worker.on("message", (message: unknown) => {
    const { id, won } = Reply.parse(message);
    waiting.get(id)?.(won);
  });
  let nextId = 0;
  return {
    uow: sqliteUnitOfWork(writer, () => undefined),
    readers: sqliteReaders(reader),
    otherSetIf: (key, expected, next) =>
      new Promise((resolve) => {
        nextId += 1;
        waiting.set(nextId, resolve);
        worker.postMessage({ id: nextId, key, expected, next });
      }),
    close: async () => {
      await worker.terminate();
      reader.close();
      writer.close();
      dir.remove();
    },
  };
});
