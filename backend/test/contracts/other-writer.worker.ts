import { parentPort, workerData } from "node:worker_threads";
import { z } from "zod";
import { openWriter } from "../../src/adapters/db/client.ts";
import { sqliteUnitOfWork } from "../../src/adapters/db/unit-of-work.ts";

// A second writer on its own thread, as a second process would be. In one thread a second
// SQLite writer would block the thread while it waits for the first, then fail with
// SQLITE_BUSY, and `openWriter` refuses it.
const Request = z.object({
  id: z.number(),
  key: z.string(),
  expected: z.unknown(),
  next: z.unknown(),
});

const port = parentPort;
if (port === null) throw new Error("Run as a worker");
const writer = openWriter(z.string().parse(workerData));
const uow = sqliteUnitOfWork(writer, () => undefined);

port.on("message", (message: unknown) => {
  const { id, key, expected, next } = Request.parse(message);
  void uow
    .run((tx) => tx.settings.setIf(key, expected, next))
    .then((won) => {
      port.postMessage({ id, won });
    });
});
