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

// The file system calls that can fail part way. Tests replace them to prove what each failure
// leaves behind; the app uses node:fs.
export interface DiskCalls {
  writeSync(fd: number, buffer: Uint8Array, offset: number, length: number): number;
  fsyncSync(fd: number): void;
  utimesSync(path: string, atime: Date, mtime: Date): void;
  renameSync(from: string, to: string): void;
}

const NODE_CALLS: DiskCalls = { writeSync, fsyncSync, utimesSync, renameSync };

export function diskAvatarFiles(folder: string, calls: Partial<DiskCalls> = {}): AvatarFiles {
  const fs: DiskCalls = { ...NODE_CALLS, ...calls };
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
  const syncFolder = () => {
    const dir = openSync(folder, "r");
    try {
      fs.fsyncSync(dir);
    } finally {
      closeSync(dir);
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
        const path = stagedPath(token);
        const fd = openSync(path, "wx", 0o600);
        try {
          // A write may store fewer bytes than asked (a full disk, a file size limit), so write
          // the rest until every byte is stored. A short file must never be published: its name
          // is the hash of the whole image, so a later upload of that image would keep it.
          let offset = 0;
          while (offset < bytes.length) {
            const written = fs.writeSync(fd, bytes, offset, bytes.length - offset);
            if (written <= 0) throw new Error("avatar write stored no bytes");
            offset += written;
          }
          fs.fsyncSync(fd);
        } catch (error) {
          closeSync(fd);
          rmSync(path, { force: true });
          throw error;
        }
        closeSync(fd);
        return { avatarId, token };
      }),
    publish: (staged, now) =>
      attempt(() => {
        const target = finalPath(staged.avatarId);
        const source = stagedPath(staged.token);
        if (timeOf(target) !== null) {
          // The same image is already published: a fresh time, and the staged copy goes. The
          // folder sync makes the removal durable (M2 plan §4a, `publish`).
          fs.utimesSync(target, now, now);
          rmSync(source, { force: true });
          syncFolder();
          return;
        }
        // A failed publish leaves the staged file and no `<id>.webp` (M2 plan §4a, Failures):
        // the time is set before the rename (a rename keeps it), and a failed folder sync moves
        // the file back.
        fs.utimesSync(source, now, now);
        fs.renameSync(source, target);
        try {
          // The rename is durable only when the folder is synced too.
          syncFolder();
        } catch (error) {
          try {
            fs.renameSync(target, source);
          } catch {
            // The final file stays: complete, and named by no row, so the cleanup removes it
            // after the grace period.
          }
          throw error;
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
        if (timeOf(path) !== null) fs.utimesSync(path, now, now);
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
