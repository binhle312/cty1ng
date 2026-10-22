import { lte } from "drizzle-orm";
import { events } from "../../src/adapters/db/schema";
import { makeTestApp, OWN_ORIGIN, ping } from "../support/test-app";
import { SseReader } from "../support/sse-client";
import { runContract } from "./runner";
import { transportContract, type TransportSubject } from "./transport.contract";

runContract(transportContract, "SSE (adapters/sse) over the Hono app", () => {
  const app = makeTestApp();
  const open: SseReader[] = [];
  const subject: TransportSubject = {
    append: (note) => ping(app, note),
    async connect(cursor) {
      const lastEventId =
        cursor.kind === "fresh"
          ? undefined
          : cursor.kind === "after"
            ? String(cursor.seq)
            : "not-a-seq";
      const response = await app.request("/api/stream", {
        headers: {
          origin: OWN_ORIGIN,
          ...(lastEventId === undefined ? {} : { "last-event-id": lastEventId }),
        },
      });
      const reader = new SseReader(response);
      open.push(reader);
      return { next: () => reader.nextEvent(), close: () => reader.close() };
    },
    async pruneThrough(seq) {
      app.connections.write.db.delete(events).where(lte(events.seq, seq)).run();
    },
  };
  return {
    subject,
    async teardown() {
      await Promise.allSettled(open.map((reader) => reader.close()));
      app.dispose();
    },
  };
});
