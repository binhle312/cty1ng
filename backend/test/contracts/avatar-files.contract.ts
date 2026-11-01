import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AvatarFiles } from "../../src/core/ports/avatar-files.ts";

// The avatar store contract (M2 plan, decision 1): every adapter runs it.
export interface AvatarFilesFixture {
  files: AvatarFiles;
  close(): void;
}

const A = "a".repeat(64);
const B = "b".repeat(64);
const bytes = (text: string) => new TextEncoder().encode(text);
const T1 = new Date("2026-11-01T00:00:00.000Z");
const T2 = new Date("2026-11-02T00:00:00.000Z");

export function avatarFilesContract(name: string, setup: () => AvatarFilesFixture) {
  describe(`avatar files contract: ${name}`, () => {
    let fixture: AvatarFilesFixture;
    let files: AvatarFiles;
    beforeEach(() => {
      fixture = setup();
      files = fixture.files;
    });
    afterEach(() => {
      fixture.close();
    });

    it("a staged file is not published until publish", async () => {
      const staged = await files.stage(A, bytes("one"));
      expect(await files.exists(A)).toBe(false);
      expect(await files.read(A)).toBeNull();
      expect((await files.listStaged()).map((file) => file.name)).toEqual([staged.token]);
      await files.publish(staged, T1);
      expect(await files.exists(A)).toBe(true);
      expect(await files.read(A)).toEqual(bytes("one"));
      expect(await files.listStaged()).toEqual([]);
      expect(await files.modifiedAt(A)).toEqual(T1);
    });

    it("publishing the same image again refreshes the time and drops the staged copy", async () => {
      await files.publish(await files.stage(A, bytes("one")), T1);
      await files.publish(await files.stage(A, bytes("one")), T2);
      expect(await files.modifiedAt(A)).toEqual(T2);
      expect(await files.listStaged()).toEqual([]);
      expect((await files.list()).map((file) => file.name)).toEqual([A]);
    });

    it("discard removes a staged file, and never throws", async () => {
      const staged = await files.stage(B, bytes("two"));
      await files.discard(staged);
      await files.discard(staged);
      expect(await files.listStaged()).toEqual([]);
      expect(await files.exists(B)).toBe(false);
    });

    it("touch sets the time, and does nothing for a missing file", async () => {
      await files.publish(await files.stage(A, bytes("one")), T1);
      await files.touch(A, T2);
      expect(await files.modifiedAt(A)).toEqual(T2);
      await files.touch(B, T2);
      expect(await files.exists(B)).toBe(false);
    });

    it("remove and removeStaged delete, and a second delete is not an error", async () => {
      await files.publish(await files.stage(A, bytes("one")), T1);
      const staged = await files.stage(B, bytes("two"));
      await files.remove(A);
      await files.remove(A);
      await files.removeStaged(staged.token);
      await files.removeStaged(staged.token);
      expect(await files.list()).toEqual([]);
      expect(await files.listStaged()).toEqual([]);
      expect(await files.modifiedAt(A)).toBeNull();
    });
  });
}
