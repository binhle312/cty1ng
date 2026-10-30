import { StreamEvent } from "@cty1ng/shared/events";
import Database from "better-sqlite3";
import { sseBody } from "../../src/adapters/sse/sse-stream.ts";
import type { Transport } from "../../src/core/ports/transport.ts";
import { readFrames, testBackend } from "../helpers.ts";
import { transportContract, type TransportFixture } from "./transport.contract.ts";

// Runs the transport contract against the core hub directly, and over the SSE adapter with the
// frames parsed back into events (realtime-events.md §1a).

function fixture(wrap: (hub: Transport) => Transport): TransportFixture {
  const backend = testBackend();
  const append = (note: string) =>
    backend.uow.run((tx) =>
      backend.appendEvent(tx, {
        event: { type: "test.ping", data: { note } },
        conversationId: null,
      }),
    );
  return {
    transport: wrap(backend.hub),
    append,
    appendHeld: async (note, hold, outcome) => {
      await backend.uow
        .run(async (tx) => {
          await backend.appendEvent(tx, {
            event: { type: "test.ping", data: { note } },
            conversationId: null,
          });
          await hold;
          if (outcome === "rollback") throw new Error("roll back");
        })
        .catch((error: unknown) => {
          if (outcome === "commit") throw error;
        });
    },
    // Pruning comes with the first timed job; the test deletes on its own connection.
    pruneBefore: (seq) => {
      const sqlite = new Database(backend.config.databaseFile);
      sqlite.prepare("DELETE FROM events WHERE seq < ?").run(seq);
      sqlite.close();
    },
    close: backend.close,
  };
}

// The SSE adapter as a transport: write the frames, then parse them back.
function overSse(hub: Transport): Transport {
  return {
    async *subscribe(afterSeq, signal) {
      const body = sseBody(hub, afterSeq, signal, {
        heartbeatMs: 20,
        onError: (error) => {
          throw error;
        },
      });
      for await (const frame of readFrames(body)) {
        if (frame.event === undefined) continue; // `retry:` and `: ping`
        const data: unknown = JSON.parse(frame.data ?? "null");
        const isControl = frame.event === "ready" || frame.event === "reset";
        yield StreamEvent.parse(
          isControl
            ? { type: frame.event, data }
            : { type: frame.event, seq: Number(frame.id), data },
        );
      }
    },
  };
}

transportContract("event hub", () => fixture((hub) => hub));
transportContract("SSE adapter", () => fixture(overSse));
