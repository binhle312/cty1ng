import { utimesSync } from "node:fs";
import { join } from "node:path";
import { diskAvatarFiles } from "../src/adapters/avatars/avatar-files.ts";
import type { AvatarFiles } from "../src/core/ports/avatar-files.ts";
import type { FakeAvatarFiles } from "./fakes/avatar-files.ts";
import { tempDir } from "./helpers.ts";

// The real disk adapter in a temporary folder, with the same test controls as the memory fake,
// so the avatar service tests run on both (M2 plan §5, Avatar races and failures).
//
// - `failNext("publish" | "touch")` makes the next time change on disk inside that method
//   fail (the `DiskCalls` seam). The failure comes from the file system call, not from the
//   port, so the adapter's own failure handling runs.
// - A new staged file gets the test clock's time, as the memory fake gives it. The disk would
//   give it the wall-clock time, which a manual clock cannot compare with.
export type DiskTestAvatarFiles = AvatarFiles &
  Pick<FakeAvatarFiles, "failNext"> & { removeFolder: () => void };

type Method = "publish" | "touch";

export function diskTestAvatarFiles(now: () => Date): DiskTestAvatarFiles {
  const dir = tempDir("avatar-files");
  const folder = join(dir.path, "avatars");
  let failing: Method | null = null;
  let running: Method | null = null;
  const disk = diskAvatarFiles(folder, {
    utimesSync: (path, atime, mtime) => {
      if (failing !== null && failing === running) {
        failing = null;
        throw new Error(`injected ${running} failure`);
      }
      utimesSync(path, atime, mtime);
    },
  });
  // The disk adapter makes its file calls before it returns its promise, so `running` names
  // the method for every call the seam sees.
  const during = <T>(method: Method, call: () => Promise<T>): Promise<T> => {
    running = method;
    try {
      return call();
    } finally {
      running = null;
    }
  };

  return {
    ...disk,
    failNext: (method) => {
      if (method === "stage") throw new Error("the disk store injects publish and touch only");
      failing = method;
    },
    stage: async (avatarId, bytes) => {
      const staged = await disk.stage(avatarId, bytes);
      const time = now();
      utimesSync(join(folder, `.staged-${staged.token}.webp`), time, time);
      return staged;
    },
    publish: (staged, at) => during("publish", () => disk.publish(staged, at)),
    touch: (avatarId, at) => during("touch", () => disk.touch(avatarId, at)),
    removeFolder: () => {
      dir.remove();
    },
  };
}
