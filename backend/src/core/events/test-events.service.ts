import type { Clock } from "../ports/clock";
import type { UnitOfWork } from "../ports/repositories";
import { appendEvent } from "./append-event";

/**
 * Appends a `test.ping` event (realtime-events.md §4, test only). Wired only when
 * `APP_ENV=test`, for the stream's end-to-end tests.
 */
export function createTestEventsService(deps: { uow: UnitOfWork; clock: Clock }) {
  return {
    ping(note: string): Promise<{ seq: number }> {
      return deps.uow.run(async (tx) => {
        const seq = await appendEvent(tx, {
          type: "test.ping",
          data: { note },
          conversationId: null,
          at: deps.clock.now(),
        });
        return { seq };
      });
    },
  };
}

export type TestEventsService = ReturnType<typeof createTestEventsService>;
