import { fsyncSync, readdirSync, utimesSync, writeSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { diskAvatarFiles, type DiskCalls } from "../../src/adapters/avatars/avatar-files.ts";
import { memoryAvatarFiles } from "../fakes/avatar-files.ts";
import { tempDir } from "../helpers.ts";
import { avatarFilesContract } from "./avatar-files.contract.ts";

// Runs the avatar store contract against the disk adapter and the in-memory fake.

avatarFilesContract("disk", () => {
  const dir = tempDir("avatars");
  return {
    files: diskAvatarFiles(join(dir.path, "avatars")),
    close: () => {
      dir.remove();
    },
  };
});

avatarFilesContract("memory", () => ({ files: memoryAvatarFiles(), close: () => undefined }));

it("the disk adapter refuses a name that is not an avatar id", async () => {
  const dir = tempDir("avatars");
  const files = diskAvatarFiles(join(dir.path, "avatars"));
  await expect(files.exists("../app")).rejects.toThrow();
  await expect(files.read(`${"a".repeat(63)}/`)).rejects.toThrow();
  await expect(files.removeStaged("../../x")).rejects.toThrow();
  expect(readdirSync(join(dir.path, "avatars"))).toEqual([]);
  dir.remove();
});

// What each disk failure leaves behind (M2 plan §4a, Failures): a stage writes every byte or
// fails, and a publish that fails leaves the staged file and no `<id>.webp`.
describe("disk failures", () => {
  const A = "a".repeat(64);
  const T1 = new Date("2026-11-01T00:00:00.000Z");
  const image = new Uint8Array(1024).map((_, index) => index % 251);

  function diskWith(calls: Partial<DiskCalls>) {
    const dir = tempDir("avatars");
    const folder = join(dir.path, "avatars");
    return {
      files: diskAvatarFiles(folder, calls),
      folder,
      remove: () => {
        dir.remove();
      },
    };
  }
  const failing = (): never => {
    throw new Error("injected disk failure");
  };

  it("a stage writes every byte when the disk takes only a few per call", async () => {
    // writeSync may write fewer bytes than asked (a full disk, a file size limit).
    const disk = diskWith({
      writeSync: (fd, buffer, offset, length) => writeSync(fd, buffer, offset, Math.min(length, 5)),
    });
    await disk.files.publish(await disk.files.stage(A, image), T1);
    expect(await disk.files.read(A)).toEqual(image);
    disk.remove();
  });

  it("a stage whose write makes no progress fails and leaves no staged file", async () => {
    const disk = diskWith({ writeSync: () => 0 });
    await expect(disk.files.stage(A, image)).rejects.toThrow();
    expect(readdirSync(disk.folder)).toEqual([]);
    disk.remove();
  });

  it("a publish whose time step fails leaves the staged file and no published file", async () => {
    let fail = false;
    const disk = diskWith({
      utimesSync: (path, atime, mtime) => {
        if (fail) failing();
        utimesSync(path, atime, mtime);
      },
    });
    const staged = await disk.files.stage(A, image);
    fail = true;
    await expect(disk.files.publish(staged, T1)).rejects.toThrow("injected");
    expect(await disk.files.exists(A)).toBe(false);
    expect((await disk.files.listStaged()).map((file) => file.name)).toEqual([staged.token]);
    disk.remove();
  });

  it("a publish of an image already published syncs the folder after it removes the staged file", async () => {
    let syncs = 0;
    const disk = diskWith({
      fsyncSync: (fd) => {
        syncs += 1;
        fsyncSync(fd);
      },
    });
    await disk.files.publish(await disk.files.stage(A, image), T1);
    const staged = await disk.files.stage(A, image);
    syncs = 0;
    await disk.files.publish(staged, new Date("2026-11-02T00:00:00.000Z"));
    expect(syncs).toBe(1);
    expect(await disk.files.listStaged()).toEqual([]);
    expect(await disk.files.read(A)).toEqual(image);
    disk.remove();
  });

  it("a publish whose folder sync fails leaves the staged file and no published file", async () => {
    let fail = false;
    const disk = diskWith({
      fsyncSync: (fd) => {
        if (fail) failing();
        fsyncSync(fd);
      },
    });
    const staged = await disk.files.stage(A, image);
    fail = true;
    await expect(disk.files.publish(staged, T1)).rejects.toThrow("injected");
    expect(await disk.files.exists(A)).toBe(false);
    expect((await disk.files.listStaged()).map((file) => file.name)).toEqual([staged.token]);
    disk.remove();
  });
});
