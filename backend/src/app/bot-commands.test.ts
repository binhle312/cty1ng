import { join } from "node:path";
import { BotId } from "@cty1ng/shared/ids";
import { afterEach, describe, expect, it } from "vitest";
import { REPO_ROOT } from "./config.ts";
import { testBackend } from "../../test/helpers.ts";
import { listBotTrash, restoreBot, seedBots } from "./bot-commands.ts";
import { importSkills } from "./skill-commands.ts";

// The `bots` CLI commands (api.md §2) and the seed (seed/README.md), on a temporary database,
// with the real seed files.

const SEED_SKILLS = join(REPO_ROOT, "seed/skills");
const SEED_BOTS = join(REPO_ROOT, "seed/bots.yaml");

let backend: ReturnType<typeof testBackend> | undefined;
let lines: string[] = [];
const out = (line: string) => lines.push(line);
afterEach(() => {
  backend?.close();
  backend = undefined;
  lines = [];
});

async function seeded(env: NodeJS.ProcessEnv) {
  backend = testBackend(env);
  await importSkills(backend, SEED_SKILLS, true, () => undefined);
  return backend;
}

describe("bots seed", () => {
  it("creates Guide, BA and Designer in order; a second run reports them and changes nothing", async () => {
    const target = await seeded({ FAKE_MODEL: "1" });
    expect(await seedBots(target, SEED_BOTS, out)).toBe(0);
    const bots = await target.bots.list();
    expect(bots.map((bot) => bot.name).sort()).toEqual(["BA", "Designer", "Guide"]);
    expect(lines).toEqual([
      "Created Guide (guide) with Fake scripted.",
      "Created BA (ba) with Fake scripted.",
      "Created Designer (designer) with Fake scripted.",
    ]);
    const guide = bots.find((bot) => bot.slug === "guide");
    expect(guide?.pins).toMatchObject([{ skill_slug: "using-the-app", always_load: true }]);
    const ba = bots.find((bot) => bot.slug === "ba");
    expect(ba?.pins.find((pin) => pin.skill_slug === "working-principles")?.always_load).toBe(true);
    const before = await target.readers.events.after(0, 10_000);
    lines = [];
    expect(await seedBots(target, SEED_BOTS, out)).toBe(0);
    expect(lines).toEqual([
      "Guide already exists.",
      "BA already exists.",
      "Designer already exists.",
    ]);
    expect(await target.readers.events.after(0, 10_000)).toEqual(before);
  });

  it("with no model that can run, creates no bot and says to set a key", async () => {
    const target = await seeded({});
    expect(await seedBots(target, SEED_BOTS, out)).toBe(0);
    expect(lines).toEqual(["Set a key to seed the bots."]);
    expect(await target.bots.list()).toEqual([]);
  });

  it("stops when a seed skill is missing", async () => {
    backend = testBackend({ FAKE_MODEL: "1" });
    expect(await seedBots(backend, SEED_BOTS, out)).toBe(1);
    expect(lines).toEqual([
      "Guide: the skill using-the-app is missing. Import the seed skills first.",
    ]);
  });
});

describe("bots trash and bots restore", () => {
  it("lists the bots in Trash and restores one by slug", async () => {
    const target = await seeded({ FAKE_MODEL: "1" });
    await seedBots(target, SEED_BOTS, () => undefined);
    expect(await listBotTrash(target, out)).toBe(0);
    expect(lines).toEqual(["Trash has no bots."]);
    const ba = (await target.bots.list()).find((bot) => bot.slug === "ba");
    if (ba === undefined) throw new Error("no BA");
    await target.bots.trash(BotId.parse(ba.id));
    lines = [];
    await listBotTrash(target, out);
    expect(lines[0]).toMatch(/^ba {2}BA {2}\(in Trash since /);
    lines = [];
    expect(await restoreBot(target, "ba", out)).toBe(0);
    expect(lines).toEqual(["Restored BA. It is not pinned."]);
    expect((await target.bots.list()).map((bot) => bot.slug)).toContain("ba");
  });
});
