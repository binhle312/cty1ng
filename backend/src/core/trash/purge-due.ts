import type { Clock } from "../ports/clock.ts";
import type { Readers, SettingsReader, Tx, UnitOfWork } from "../ports/repositories.ts";
import { readSettings } from "../settings/settings.service.ts";

// One Trash kind, as the purge job sees it.
export interface PurgeKind<Id> {
  // The items whose delete time is at or before `cutoff`.
  dueIds(readers: Readers, cutoff: Date): Promise<readonly Id[]>;
  // The item's delete time now, or null when it is no longer in Trash (restored or purged).
  trashedAt(tx: Tx, id: Id): Promise<Date | null>;
  // Purges the item, with its events.
  purge(tx: Tx, id: Id): Promise<void>;
}

// What one run of the loop did. A failed item stays in Trash; the caller logs it.
export interface PurgeResult<Id> {
  purged: number;
  failed: { id: Id; error: unknown }[];
}

// The purge job's loop (architecture.md §6.1): the items whose delete time `+ trash_days` is at
// or before now, one per transaction. Each transaction checks the item again: it may have been
// restored or purged, or trash_days may have gone up, since the list was read. An item that
// fails rolls back only its own transaction, so it writes no event; the loop goes on with the
// next item, and the next run tries the failed one again (P3 item 27).
export async function purgeDue<Id>(
  deps: { uow: UnitOfWork; readers: Readers; clock: Clock },
  kind: PurgeKind<Id>,
): Promise<PurgeResult<Id>> {
  const now = deps.clock.now();
  const cutoff = async (reader: SettingsReader): Promise<Date> =>
    new Date(now.getTime() - (await readSettings(reader)).trash_days * 86_400_000);
  const result: PurgeResult<Id> = { purged: 0, failed: [] };
  for (const id of await kind.dueIds(deps.readers, await cutoff(deps.readers.settings))) {
    try {
      const done = await deps.uow.run(async (tx) => {
        const trashedAt = await kind.trashedAt(tx, id);
        if (trashedAt === null || trashedAt > (await cutoff(tx.settings))) return false;
        await kind.purge(tx, id);
        return true;
      });
      if (done) result.purged += 1;
    } catch (error) {
      result.failed.push({ id, error });
    }
  }
  return result;
}
