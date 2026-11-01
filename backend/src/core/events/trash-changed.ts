import type { Tx } from "../ports/repositories.ts";
import type { AppendEvent } from "./append-event.ts";

// `trash.changed` with one count per Trash kind that exists (D62, realtime-events.md §4): skills
// (M1) and bots (M2). Every service that moves an item into or out of Trash calls it in the same
// transaction.
export async function appendTrashChanged(tx: Tx, appendEvent: AppendEvent): Promise<void> {
  const counts = {
    skill: await tx.skills.trashedCount(),
    bot: await tx.bots.trashedCount(),
  };
  await appendEvent(tx, {
    event: { type: "trash.changed", data: { counts } },
    conversationId: null,
  });
}
