import { createHash } from "node:crypto";
import { avatarUrl } from "@cty1ng/shared/bots";
import type { AvatarFiles } from "../ports/avatar-files.ts";
import type { Clock } from "../ports/clock.ts";
import type { UnitOfWork } from "../ports/repositories.ts";
import { avatarPathOf } from "./bots.service.ts";

// Avatar files (domain-model.md §2 Avatar files; M2 plan §4a). The image is already decoded and
// re-encoded by the HTTP adapter (security.md §2.4); this service hashes it, stages it outside
// the write lock, and publishes it inside the lock. The cleanup lists the files, checks the rows
// and deletes in one locked transaction, so an upload or a bot save can never run between its
// check and its delete.
//
// What a failure leaves behind, and why it is safe:
// - stage fails: no file, or a partial staged file; staged files are never served and the
//   cleanup removes them after the grace period.
// - publish fails: the staged file stays (discard tries to remove it); no row names it.
// - the transaction rolls back after publish: the published file stays, unused; it has a fresh
//   time, so it gets the full grace period, then the cleanup removes it.
// - touch fails in a bot save: the save rolls back, so the old row still names the file.

export interface AvatarsDeps {
  uow: UnitOfWork;
  clock: Clock;
  files: AvatarFiles;
  orphanHours: number;
}

export function createAvatarsService(deps: AvatarsDeps) {
  const { uow, clock, files } = deps;
  const graceMs = deps.orphanHours * 3_600_000;
  const expired = (time: Date) => time.getTime() <= clock.now().getTime() - graceMs;

  return {
    async upload(webp: Uint8Array): Promise<{ avatar_id: string; url: string }> {
      const avatarId = createHash("sha256").update(webp).digest("hex");
      const staged = await files.stage(avatarId, webp);
      try {
        await uow.run(async () => {
          await files.publish(staged, clock.now());
        });
      } catch (error) {
        await files.discard(staged);
        throw error;
      }
      return { avatar_id: avatarId, url: avatarUrl(avatarId) };
    },

    read: (avatarId: string): Promise<Uint8Array | null> => files.read(avatarId),

    // Part of the purge job. Returns how many files it removed. Everything runs in one write
    // transaction (M2 plan §4a, Cleanup): the list, the rows that name a file and each delete.
    // So an upload of the same image or a save that names the file comes wholly before the
    // cleanup (the file has a fresh time or a row names it, and it stays) or wholly after (it
    // finds the file gone: the upload publishes it again, the save gets 422). A staged file
    // is removed the same way, so a removal never runs between a publish's check and its move.
    //
    // Assumption, not proof: a staged file older than the grace period is abandoned (a crash
    // or a failed upload). No row names a staged file, and the lock only orders the removal
    // against a publish; nothing limits how long an upload may take between its stage and
    // its publish. An upload slower than the grace period loses its staged file: its publish
    // fails, the request gets 500, no published file is left, and the owner uploads again.
    cleanup: (): Promise<number> =>
      uow.run(async (tx) => {
        const used = await tx.bots.avatarPaths();
        let removed = 0;
        for (const file of await files.list()) {
          if (!expired(file.modifiedAt) || used.has(avatarPathOf(file.name))) continue;
          await files.remove(file.name);
          removed += 1;
        }
        for (const file of await files.listStaged()) {
          if (!expired(file.modifiedAt)) continue;
          await files.removeStaged(file.name);
          removed += 1;
        }
        return removed;
      }),
  };
}

export type AvatarsService = ReturnType<typeof createAvatarsService>;
