import { readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { diskAvatarFiles } from "../../src/adapters/avatars/avatar-files.ts";
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
