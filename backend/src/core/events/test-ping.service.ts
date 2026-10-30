import type { UnitOfWork } from "../ports/repositories.ts";
import type { AppendEvent } from "./append-event.ts";

// Appends a `test.ping` event (realtime-events.md §4). Only `POST /api/_test/events` calls it,
// and that route exists only when APP_ENV=test.
export function createTestPingService(deps: { uow: UnitOfWork; appendEvent: AppendEvent }) {
  return (note: string): Promise<number> =>
    deps.uow.run((tx) =>
      deps.appendEvent(tx, { event: { type: "test.ping", data: { note } }, conversationId: null }),
    );
}
