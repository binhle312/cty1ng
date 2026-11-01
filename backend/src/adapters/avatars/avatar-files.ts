import { randomUUID } from "node:crypto";
import {
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  utimesSync,
  writeSync,
} from "node:fs";
import { join } from "node:path";
import { AvatarId } from "@cty1ng/shared/bots";
import type { AvatarFiles, AvatarFileTime } from "../../core/ports/avatar-files.ts";

// The avatar store on disk (domain-model.md §2 Avatar files): `<DATA_DIR>/avatars/<sha256>.webp`,
// and staged files `.staged-<uuid>.webp` in the same folder, so the rename is atomic (one file
// system). Names are checked before they become paths: an avatar id is 64 hex characters and a
// token is a UUID, so no name can leave the folder.

const STAGED = /^\.staged-([0-9a-f-]{36})\.webp$/;
const PUBLISHED = /^([0-9a-f]{64})\.webp$/;
const TOKEN = /^[0-9a-f-]{36}$/;

// Every method runs its synchronous file calls inside this, so a failure is a rejected promise,
// as the port expects, and never a synchronous throw.
function attempt<T>(work: () => T): Promise<T> {
  try {
    return Promise.resolve(work());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

export function diskAvatarFiles(folder: string): AvatarFiles {
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  const finalPath = (avatarId: string) => join(folder, `${AvatarId.parse(avatarId)}.webp`);
  const stagedPath = (token: string) => {
    if (!TOKEN.test(token)) throw new Error("bad staged avatar token");
    return join(folder, `.staged-${token}.webp`);
  };
  const timeOf = (path: string): Date | null => {
    try {
      return statSync(path).mtime;
    } catch {
      return null;
    }
  };
  const listMatching = (pattern: RegExp): AvatarFileTime[] =>
    readdirSync(folder).flatMap((file) => {
      const name = pattern.exec(file)?.[1];
      const modifiedAt = name === undefined ? null : timeOf(join(folder, file));
      return name === undefined || modifiedAt === null ? [] : [{ name, modifiedAt }];
    });

  return {
    stage: (avatarId, bytes) =>
      attempt(() => {
        AvatarId.parse(avatarId);
        const token = randomUUID();
        const fd = openSync(stagedPath(token), "wx", 0o600);
        try {
          writeSync(fd, bytes);
          fsyncSync(fd);
        } finally {
          closeSync(fd);
        }
        return { avatarId, token };
      }),
    publish: (staged, now) =>
      attempt(() => {
        const target = finalPath(staged.avatarId);
        if (timeOf(target) === null) {
          renameSync(stagedPath(staged.token), target);
          utimesSync(target, now, now);
          // The rename is durable only when the folder is synced too.
          const dir = openSync(folder, "r");
          try {
            fsyncSync(dir);
          } finally {
            closeSync(dir);
          }
        } else {
          utimesSync(target, now, now);
          rmSync(stagedPath(staged.token), { force: true });
        }
      }),
    discard: (staged) =>
      attempt(() => {
        try {
          rmSync(stagedPath(staged.token), { force: true });
        } catch {
          // The cleanup removes it later.
        }
      }),
    exists: (avatarId) => attempt(() => timeOf(finalPath(avatarId)) !== null),
    touch: (avatarId, now) =>
      attempt(() => {
        const path = finalPath(avatarId);
        if (timeOf(path) !== null) utimesSync(path, now, now);
      }),
    list: () => attempt(() => listMatching(PUBLISHED)),
    listStaged: () => attempt(() => listMatching(STAGED)),
    modifiedAt: (avatarId) => attempt(() => timeOf(finalPath(avatarId))),
    remove: (avatarId) =>
      attempt(() => {
        rmSync(finalPath(avatarId), { force: true });
      }),
    removeStaged: (token) =>
      attempt(() => {
        rmSync(stagedPath(token), { force: true });
      }),
    read: (avatarId) =>
      attempt(() => {
        const path = finalPath(avatarId);
        try {
          return new Uint8Array(readFileSync(path));
        } catch {
          return null;
        }
      }),
  };
}
