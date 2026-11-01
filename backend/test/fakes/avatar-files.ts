import type { AvatarFiles } from "../../src/core/ports/avatar-files.ts";

// The avatar store in memory, for service tests (M2 plan, decision 1). It passes the same
// contract suite as the disk adapter. `failNext` makes the next call of one method throw, so
// tests can prove what a file failure leaves behind.

export interface FakeAvatarFiles extends AvatarFiles {
  failNext(method: "publish" | "touch" | "stage"): void;
  // Sets a file's time, as the clock moving on would.
  setTime(name: string, time: Date, staged?: boolean): void;
}

// `now` gives a staged file its time, as the disk gives a new file the current time.
export function memoryAvatarFiles(now: () => Date = () => new Date()): FakeAvatarFiles {
  const published = new Map<string, { bytes: Uint8Array; time: Date }>();
  const staged = new Map<string, { avatarId: string; bytes: Uint8Array; time: Date }>();
  const failing = new Set<string>();
  let counter = 0;
  const check = (method: string) => {
    if (failing.delete(method)) throw new Error(`fake ${method} failure`);
  };

  return {
    failNext: (method) => failing.add(method),
    setTime: (name, time, isStaged = false) => {
      const entry = isStaged ? staged.get(name) : published.get(name);
      if (entry !== undefined) entry.time = time;
    },
    stage: (avatarId, bytes) => {
      check("stage");
      counter += 1;
      const token = `staged-${String(counter)}`;
      staged.set(token, { avatarId, bytes, time: now() });
      return Promise.resolve({ avatarId, token });
    },
    publish: (file, now) => {
      check("publish");
      const entry = staged.get(file.token);
      if (entry === undefined) throw new Error("no such staged file");
      const existing = published.get(file.avatarId);
      if (existing === undefined) published.set(file.avatarId, { bytes: entry.bytes, time: now });
      else existing.time = now;
      staged.delete(file.token);
      return Promise.resolve();
    },
    discard: (file) => {
      staged.delete(file.token);
      return Promise.resolve();
    },
    exists: (avatarId) => Promise.resolve(published.has(avatarId)),
    touch: (avatarId, now) => {
      check("touch");
      const entry = published.get(avatarId);
      if (entry !== undefined) entry.time = now;
      return Promise.resolve();
    },
    list: () =>
      Promise.resolve([...published].map(([name, entry]) => ({ name, modifiedAt: entry.time }))),
    listStaged: () =>
      Promise.resolve([...staged].map(([name, entry]) => ({ name, modifiedAt: entry.time }))),
    modifiedAt: (avatarId) => Promise.resolve(published.get(avatarId)?.time ?? null),
    remove: (avatarId) => {
      published.delete(avatarId);
      return Promise.resolve();
    },
    removeStaged: (token) => {
      staged.delete(token);
      return Promise.resolve();
    },
    read: (avatarId) => Promise.resolve(published.get(avatarId)?.bytes ?? null),
  };
}
