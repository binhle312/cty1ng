import { BotId } from "@cty1ng/shared/ids";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { memoryAvatarFiles, type FakeAvatarFiles } from "../../../test/fakes/avatar-files.ts";
import { manualClock, testBackend, testIds } from "../../../test/helpers.ts";
import { DomainError } from "../errors.ts";
import { OWNER_ID } from "../owner.ts";
import { createAvatarsService } from "./avatars.service.ts";
import { createBotsService } from "./bots.service.ts";

// The avatar file contract of the M2 plan §4a: upload and cleanup under one write lock, the
// grace period, and what each failure leaves behind.

const HOUR = 3_600_000;
let clock: ReturnType<typeof manualClock>;
let backend: ReturnType<typeof testBackend>;
let files: FakeAvatarFiles;
let avatars: ReturnType<typeof createAvatarsService>;
let bots: ReturnType<typeof createBotsService>;
let n = 0;
beforeEach(() => {
  clock = manualClock();
  backend = testBackend({ FAKE_MODEL: "1" }, { clock });
  files = memoryAvatarFiles(() => clock.now());
  avatars = createAvatarsService({ uow: backend.uow, clock, files, orphanHours: 24 });
  bots = createBotsService({
    uow: backend.uow,
    readers: backend.readers,
    appendEvent: backend.appendEvent,
    clock,
    ids: testIds,
    catalog: backend.catalog,
    avatarFiles: files,
  });
});
afterEach(() => {
  backend.close();
});

const image = (text: string) => new TextEncoder().encode(text);
const published = async () => (await files.list()).map((file) => file.name);

// Runs `step` after the cleanup lists the files and before its locked recheck: the window in
// which an upload or a save can come between them.
function betweenListAndRecheck(step: () => Promise<unknown>) {
  const list = files.list.bind(files);
  vi.spyOn(files, "list").mockImplementationOnce(async () => {
    const listed = await list();
    await step();
    return listed;
  });
}

async function botWith(avatarId: string) {
  n += 1;
  const { bot } = await bots.create(
    {
      name: `Bot ${String(n)}`,
      description: "d",
      persona_md: "p",
      avatar_style: "upload",
      avatar_id: avatarId,
      avatar_colour: "#336699",
      model_id: "fake:scripted",
      pins: [],
    },
    `0190a000-0000-7000-8000-${String(n).padStart(12, "0")}`,
    OWNER_ID,
  );
  return bot;
}

describe("upload", () => {
  it("names the file by the SHA-256 of the image and gives its URL", async () => {
    const result = await avatars.upload(image("one"));
    expect(result.avatar_id).toMatch(/^[0-9a-f]{64}$/);
    expect(result.url).toBe(`/api/avatars/${result.avatar_id}.webp`);
    expect(await published()).toEqual([result.avatar_id]);
    expect(await files.listStaged()).toEqual([]);
  });

  it("a failed publish leaves no published file and discards the staged one", async () => {
    files.failNext("publish");
    await expect(avatars.upload(image("one"))).rejects.toThrow();
    expect(await published()).toEqual([]);
    expect(await files.listStaged()).toEqual([]);
  });
});

describe("cleanup", () => {
  it("keeps a used file, and removes an unused one only after the grace period", async () => {
    const used = (await avatars.upload(image("used"))).avatar_id;
    await avatars.upload(image("unused"));
    await botWith(used);
    clock.advance(24 * HOUR - 1);
    expect(await avatars.cleanup()).toBe(0);
    clock.advance(1);
    expect(await avatars.cleanup()).toBe(1);
    expect(await published()).toEqual([used]);
  });

  it("an upload of the same image between the list and the recheck keeps the file", async () => {
    const id = (await avatars.upload(image("one"))).avatar_id;
    clock.advance(30 * HOUR);
    // The cleanup lists the file as expired; before its locked recheck, the same image comes
    // again. The recheck reads the new time and keeps the file.
    betweenListAndRecheck(() => avatars.upload(image("one")));
    expect(await avatars.cleanup()).toBe(0);
    expect(await published()).toEqual([id]);
    expect(await files.modifiedAt(id)).toEqual(clock.now());
  });

  it("an upload of the same image after the cleanup removed it publishes it again", async () => {
    const id = (await avatars.upload(image("one"))).avatar_id;
    clock.advance(30 * HOUR);
    expect(await avatars.cleanup()).toBe(1);
    expect((await avatars.upload(image("one"))).avatar_id).toBe(id);
    expect(await published()).toEqual([id]);
    expect(await files.modifiedAt(id)).toEqual(clock.now());
  });

  it("a file that a tombstone names stays", async () => {
    const id = (await avatars.upload(image("one"))).avatar_id;
    const bot = await botWith(id);
    await bots.trash(BotId.parse(bot.id));
    clock.advance(31 * 24 * HOUR);
    expect(await bots.purgeDue()).toBe(1);
    expect(await avatars.cleanup()).toBe(0);
    expect(await published()).toEqual([id]);
  });

  it("removes staged leftovers after the grace period", async () => {
    await files.stage("c".repeat(64), image("crash"));
    expect(await avatars.cleanup()).toBe(0);
    clock.advance(24 * HOUR);
    expect(await avatars.cleanup()).toBe(1);
    expect(await files.listStaged()).toEqual([]);
  });

  it("removes a staged file only in the write lock, so a publish queued first still succeeds", async () => {
    const staged = await files.stage("e".repeat(64), image("slow upload"));
    clock.advance(24 * HOUR);
    // Another write holds the lock; the publish waits behind it, then the cleanup.
    let release: () => void = () => undefined;
    const holder = backend.uow.run(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const publishing = backend.uow.run(() => files.publish(staged, clock.now()));
    const cleaning = avatars.cleanup();
    // Let every step that does not need the lock finish.
    await new Promise((resolve) => setTimeout(resolve, 0));
    release();
    await holder;
    await publishing;
    expect(await cleaning).toBe(0);
    expect(await published()).toEqual(["e".repeat(64)]);
    expect(await files.listStaged()).toEqual([]);
  });

  it("an upload whose publish comes after the grace period fails and leaves nothing", async () => {
    // A stage older than the grace period counts as abandoned (avatars.service.ts, cleanup).
    const stage = files.stage.bind(files);
    vi.spyOn(files, "stage").mockImplementationOnce(async (avatarId, bytes) => {
      const staged = await stage(avatarId, bytes);
      clock.advance(24 * HOUR);
      expect(await avatars.cleanup()).toBe(1);
      return staged;
    });
    await expect(avatars.upload(image("too slow"))).rejects.toThrow();
    expect(await published()).toEqual([]);
    expect(await files.listStaged()).toEqual([]);
  });

  it("a file published in a transaction that rolled back is unused, and goes after the grace period", async () => {
    const staged = await files.stage("d".repeat(64), image("rolled back"));
    await expect(
      backend.uow.run(async () => {
        await files.publish(staged, clock.now());
        throw new Error("the save failed after publish");
      }),
    ).rejects.toThrow();
    expect(await published()).toEqual(["d".repeat(64)]);
    clock.advance(24 * HOUR);
    expect(await avatars.cleanup()).toBe(1);
    expect(await published()).toEqual([]);
  });
});

describe("bot saves", () => {
  it("a save that drops the last row naming a file restarts its grace period", async () => {
    const first = (await avatars.upload(image("first"))).avatar_id;
    const second = (await avatars.upload(image("second"))).avatar_id;
    const bot = await botWith(first);
    clock.advance(48 * HOUR);
    await bots.update(BotId.parse(bot.id), { row_version: 1, avatar_id: second });
    // The old file stopped being used just now: it gets the full grace period from here.
    expect(await avatars.cleanup()).toBe(0);
    clock.advance(24 * HOUR);
    expect(await avatars.cleanup()).toBe(1);
    expect(await published()).toEqual([second]);
  });

  it("a failed touch rolls the save back, so the old row still names the file", async () => {
    const first = (await avatars.upload(image("first"))).avatar_id;
    const second = (await avatars.upload(image("second"))).avatar_id;
    const bot = await botWith(first);
    files.failNext("touch");
    await expect(
      bots.update(BotId.parse(bot.id), { row_version: 1, avatar_id: second }),
    ).rejects.toThrow();
    expect((await bots.get(BotId.parse(bot.id))).avatar_id).toBe(first);
  });

  it("a save that names the file between the cleanup's list and recheck keeps it", async () => {
    const id = (await avatars.upload(image("one"))).avatar_id;
    clock.advance(30 * HOUR);
    let bot: Awaited<ReturnType<typeof botWith>> | undefined;
    betweenListAndRecheck(async () => {
      bot = await botWith(id);
    });
    expect(await avatars.cleanup()).toBe(0);
    expect(bot?.avatar_id).toBe(id);
    expect(await published()).toEqual([id]);
  });

  it("a save and a cleanup started together never leave a row naming a missing file", async () => {
    const id = (await avatars.upload(image("one"))).avatar_id;
    clock.advance(30 * HOUR);
    const [cleanup, save] = await Promise.allSettled([avatars.cleanup(), botWith(id)]);
    expect(cleanup.status).toBe("fulfilled");
    if (save.status === "fulfilled") {
      expect(await published()).toEqual([id]);
    } else {
      expect(save.reason).toMatchObject({ field: "avatar_id" });
      expect(await published()).toEqual([]);
    }
  });

  it("a save naming a file that the cleanup removed gets 422 on avatar_id", async () => {
    const id = (await avatars.upload(image("one"))).avatar_id;
    clock.advance(24 * HOUR);
    await avatars.cleanup();
    const error: unknown = await botWith(id).then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toMatchObject({ field: "avatar_id", message: "Upload the image again." });
  });
});
