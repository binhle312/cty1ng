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

// The purge job's loop (architecture.md §6.1): the items whose delete time `+ trash_days` is at
// or before now, one per transaction. Each transaction checks the item again: it may have been
// restored or purged, or trash_days may have gone up, since the list was read. Returns how many
// it purged.
export async function purgeDue<Id>(
  deps: { uow: UnitOfWork; readers: Readers; clock: Clock },
  kind: PurgeKind<Id>,
): Promise<number> {
  const now = deps.clock.now();
  const cutoff = async (reader: SettingsReader): Promise<Date> =>
    new Date(now.getTime() - (await readSettings(reader)).trash_days * 86_400_000);
  let purged = 0;
  for (const id of await kind.dueIds(deps.readers, await cutoff(deps.readers.settings))) {
    const done = await deps.uow.run(async (tx) => {
      const trashedAt = await kind.trashedAt(tx, id);
      if (trashedAt === null || trashedAt > (await cutoff(tx.settings))) return false;
      await kind.purge(tx, id);
      return true;
    });
    if (done) purged += 1;
  }
  return purged;
}
