import type { CreateBotBody } from "@cty1ng/shared/bots";
import { BotId, SkillId } from "@cty1ng/shared/ids";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { manualClock, newTestId, testBackend } from "../../../test/helpers.ts";
import { DomainError } from "../errors.ts";
import { OWNER_ID } from "../owner.ts";

// The bots service on a temporary database (domain-model.md §2, api.md §4). FAKE_MODEL=1 gives
// the two fake models; the file's real models have no key in tests, so they cannot run.

const DAY = 86_400_000;
let clock: ReturnType<typeof manualClock>;
let backend: ReturnType<typeof testBackend>;
let keyCounter = 0;
beforeEach(() => {
  clock = manualClock();
  backend = testBackend({ FAKE_MODEL: "1" }, { clock });
});
afterEach(() => {
  backend.close();
});

const key = () => {
  keyCounter += 1;
  return `0190a000-0000-7000-8000-${String(keyCounter).padStart(12, "0")}`;
};

const body = (more: Partial<CreateBotBody> = {}): CreateBotBody => ({
  name: "BA",
  description: "Writes user stories.",
  persona_md: "You are a business analyst.",
  avatar_style: "flat",
  avatar_colour: "#336699",
  model_id: "fake:effort",
  pins: [],
  ...more,
});

const create = async (more: Partial<CreateBotBody> = {}) =>
  (await backend.bots.create(body(more), key(), OWNER_ID)).bot;

async function failure(promise: Promise<unknown>): Promise<DomainError> {
  const error: unknown = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  if (!(error instanceof DomainError))
    throw new Error(`expected a DomainError, got ${String(error)}`);
  return error;
}

async function events(): Promise<[string, unknown][]> {
  return (await backend.readers.events.after(0, 1000)).map((event) => [event.type, event.payload]);
}

async function skill(slug: string) {
  const skill = await backend.skills.create(
    { slug, name: `Skill ${slug}`, description: "Use it.", bodyMd: "## Steps" },
    OWNER_ID,
  );
  return SkillId.parse(skill.id);
}

describe("create (POST /bots)", () => {
  it("stores the normalised name, a slug, the defaults and the effective tools", async () => {
    const bot = await create({ name: "  Thiết   kế  " });
    expect(bot).toMatchObject({
      name: "Thiết kế",
      slug: "thiet-ke",
      effort: "medium",
      history_share_pct: 40,
      request_limit: 30,
      max_reply_chars: 6000,
      available: true,
      health: null,
      pinned_position: null,
      status: { state: "idle" },
      counts: { skills: 0, skill_updates: 0, projects: 0, conversations: 0 },
    });
    expect(bot.tool_settings).toEqual({
      files: true,
      view_images: true,
      skills: true,
      hand_off: true,
      memory: true,
    });
    expect((await events()).map(([type]) => type)).toEqual(["bot.created"]);
  });

  it("gives a free slug: -2 after a taken one, never new, never a purged bot's", async () => {
    expect((await create({ name: "New" })).slug).toBe("new-2");
    expect((await create({ name: "BA" })).slug).toBe("ba");
    const second = await create({ name: "B-A" });
    expect(second.slug).toBe("b-a");
    expect((await create({ name: "B A!" })).slug).toBe("b-a-2");
  });

  it("refuses a name whose key is taken, also by a bot in Trash", async () => {
    const first = await create({ name: "Bá" });
    expect((await failure(create({ name: "BÁ" }))).code).toBe("name_taken");
    await backend.bots.trash(BotId.parse(first.id));
    const error = await failure(create({ name: "bá" }));
    expect(error).toMatchObject({ code: "name_taken", field: "name" });
    expect(error.message).toBe(
      "Bá is taken by another bot, maybe one in Trash. Pick another name.",
    );
  });

  it("is idempotent: a repeat returns the first bot, even after a pinned skill was deprecated", async () => {
    const skillId = await skill("notes");
    const k = key();
    const sent = body({ pins: [{ skill_id: skillId, always_load: true }] });
    const first = await backend.bots.create(sent, k, OWNER_ID);
    expect(first.created).toBe(true);
    const summary = await backend.skills.summary(skillId, OWNER_ID);
    await backend.skills.deprecate(
      skillId,
      { removeBotIds: [], rowVersion: summary.row_version },
      OWNER_ID,
    );
    const again = await backend.bots.create(sent, k, OWNER_ID);
    expect(again.created).toBe(false);
    expect(again.bot.id).toBe(first.bot.id);
    expect((await backend.bots.list()).map((bot) => bot.id)).toEqual([first.bot.id]);
    expect(
      await failure(backend.bots.create({ ...sent, name: "Other" }, k, OWNER_ID)),
    ).toMatchObject({ code: "idempotency_key_reused" });
  });

  it("refuses a model not in the catalog, or whose key is not set", async () => {
    expect(await failure(create({ model_id: "nobody:model" }))).toMatchObject({
      code: "model_not_available",
      field: "model_id",
    });
    const error = await failure(create({ model_id: "anthropic:claude-opus-5-5" }));
    expect(error.code).toBe("model_not_available");
    expect(error.message).toContain("ANTHROPIC_API_KEY");
  });

  it("checks the effort against the model (D7, decision 4)", async () => {
    expect((await create({ effort: "high" })).effort).toBe("high");
    expect(await failure(create({ name: "X", effort: "max" }))).toMatchObject({
      code: "effort_not_supported",
    });
    expect(
      await failure(create({ name: "Y", model_id: "fake:scripted", effort: "low" })),
    ).toMatchObject({ code: "effort_not_supported" });
    expect((await create({ name: "Z", model_id: "fake:scripted" })).effort).toBeNull();
  });

  it("checks the Advanced values, the tools and the guard", async () => {
    expect(await failure(create({ history_share_pct: 85 }))).toMatchObject({
      field: "history_share_pct",
    });
    expect(await failure(create({ request_limit: 0 }))).toMatchObject({ field: "request_limit" });
    expect(
      await failure(create({ tool_settings: { files: false, hand_off: true } })),
    ).toMatchObject({ code: "validation_error", field: "tool_settings.hand_off" });
    expect(await failure(create({ tool_settings: { web_search: true } }))).toMatchObject({
      code: "tool_not_available",
    });
    expect(
      await failure(create({ persona_md: `Use key sk-ant-api03-${"a".repeat(90)}` })),
    ).toMatchObject({ code: "sensitive_data", field: "persona_md" });
    expect(await failure(create({ avatar_style: "jelly" }))).toMatchObject({
      field: "avatar_style",
    });
    expect(await failure(create({ avatar_style: "upload" }))).toMatchObject({ field: "avatar_id" });
    expect(
      await failure(create({ avatar_style: "upload", avatar_id: "a".repeat(64) })),
    ).toMatchObject({ field: "avatar_id", message: "Upload the image again." });
    expect(await events()).toEqual([]);
  });

  it("pins the latest version by default, and refuses a skill in Trash or deprecated", async () => {
    const notes = await skill("notes");
    const bot = await create({ pins: [{ skill_id: notes, always_load: true }] });
    expect(bot.pins).toMatchObject([{ skill_slug: "notes", version: 1, always_load: true }]);
    expect((await backend.skills.summary(notes, OWNER_ID)).bots_using).toBe(1);

    const old = await skill("old");
    const summary = await backend.skills.summary(old, OWNER_ID);
    await backend.skills.deprecate(
      old,
      { removeBotIds: [], rowVersion: summary.row_version },
      OWNER_ID,
    );
    expect(
      await failure(create({ name: "B2", pins: [{ skill_id: old, always_load: false }] })),
    ).toMatchObject({ code: "skill_deprecated", field: "pins[0]" });
    const deprecated = await backend.skills.summary(old, OWNER_ID);
    await backend.skills.trash(old, { rowVersion: deprecated.row_version }, OWNER_ID);
    expect(
      await failure(create({ name: "B3", pins: [{ skill_id: old, always_load: false }] })),
    ).toMatchObject({ code: "validation_error", field: "pins[0]" });
  });

  it("lets a clone keep a deprecated pin of a live source at the same version only", async () => {
    const old = await skill("old");
    const source = await create({ pins: [{ skill_id: old, always_load: false }] });
    const summary = await backend.skills.summary(old, OWNER_ID);
    await backend.skills.deprecate(
      old,
      { removeBotIds: [], rowVersion: summary.row_version },
      OWNER_ID,
    );
    const template = await backend.bots.cloneTemplate(BotId.parse(source.id));
    expect(template).toMatchObject({ name: "BA (copy)", cloned_from_bot_id: source.id });
    const clone = await backend.bots.create(
      { ...template, avatar_colour: "#112233" },
      key(),
      OWNER_ID,
    );
    expect(clone.bot.pins).toMatchObject([{ skill_slug: "old", deprecated: true }]);
    expect(clone.bot.health).toEqual({ level: "needs_attention", reason: "deprecated_skill" });
    // cloned_from_bot_id alone passes nothing.
    const other = await skill("other");
    const otherSummary = await backend.skills.summary(other, OWNER_ID);
    await backend.skills.deprecate(
      other,
      { removeBotIds: [], rowVersion: otherSummary.row_version },
      OWNER_ID,
    );
    expect(
      await failure(
        create({
          name: "C",
          cloned_from_bot_id: BotId.parse(source.id),
          pins: [{ skill_id: other, always_load: false }],
        }),
      ),
    ).toMatchObject({ code: "skill_deprecated" });
  });
});

describe("name races (domain-model.md §2 Name key)", () => {
  it("two creates of one name at once: one wins, the other gets name_taken", async () => {
    const results = await Promise.allSettled([create({ name: "Twin" }), create({ name: "TWIN" })]);
    expect(results.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.status === "rejected" ? rejected.reason : null).toMatchObject({
      code: "name_taken",
    });
  });

  it("a rename to a name held by a bot in Trash gets name_taken", async () => {
    const held = await create({ name: "Held" });
    await backend.bots.trash(BotId.parse(held.id));
    const other = await create({ name: "Other" });
    expect(
      await failure(backend.bots.update(BotId.parse(other.id), { row_version: 1, name: "held" })),
    ).toMatchObject({ code: "name_taken" });
  });
});

describe("update (PATCH /bots/{id})", () => {
  it("saves the fields sent, raises row_version, and refuses a stale one", async () => {
    const bot = await create();
    const id = BotId.parse(bot.id);
    const saved = await backend.bots.update(id, {
      row_version: bot.row_version,
      name: "Analyst",
      tool_settings: { memory: false },
    });
    expect(saved).toMatchObject({ name: "Analyst", slug: "ba", row_version: 2 });
    expect(saved.tool_settings.memory).toBe(false);
    expect(
      await failure(backend.bots.update(id, { row_version: 1, description: "x" })),
    ).toMatchObject({ code: "stale_write" });
  });

  it("two PATCHes with one row_version at once: one saves, the other gets stale_write", async () => {
    const bot = await create();
    const id = BotId.parse(bot.id);
    const results = await Promise.allSettled([
      backend.bots.update(id, { row_version: bot.row_version, description: "From tab one." }),
      backend.bots.update(id, { row_version: bot.row_version, description: "From tab two." }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
    const saved = results.find((result) => result.status === "fulfilled");
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.status === "rejected" ? rejected.reason : null).toMatchObject({
      code: "stale_write",
    });
    const stored = await backend.bots.get(id);
    expect(stored.row_version).toBe(2);
    expect(stored.description).toBe(
      saved?.status === "fulfilled" ? saved.value.description : "no save",
    );
    expect((await events()).filter(([type]) => type === "bot.updated")).toHaveLength(1);
  });

  it("keeps its own name key free to itself, and refuses another bot's", async () => {
    const a = await create({ name: "Alpha" });
    await create({ name: "Beta" });
    const id = BotId.parse(a.id);
    expect((await backend.bots.update(id, { row_version: 1, name: "ALPHA" })).name).toBe("ALPHA");
    expect(await failure(backend.bots.update(id, { row_version: 2, name: "beta" }))).toMatchObject({
      code: "name_taken",
    });
  });
});

describe("pinned order, Trash and restore", () => {
  it("rewrites the pinned list, refuses a stale one, and Trash closes the gap", async () => {
    const [a, b, c] = await Promise.all([
      create({ name: "A" }),
      create({ name: "B" }),
      create({ name: "C" }),
    ]).then((bots) => bots.map((bot) => BotId.parse(bot.id)));
    if (a === undefined || b === undefined || c === undefined) throw new Error("three bots");
    expect(await backend.bots.setPinned([c, a, b], [])).toEqual([c, a, b]);
    expect(await failure(backend.bots.setPinned([a], []))).toMatchObject({
      code: "bot_list_changed",
    });
    expect(await failure(backend.bots.setPinned([a, a], [c, a, b]))).toMatchObject({
      code: "bot_list_changed",
    });
    await backend.bots.trash(a);
    expect(await backend.readers.bots.pinnedIds()).toEqual([c, b]);
    expect((await backend.bots.list()).map((bot) => bot.id)).toEqual([c, b]);
    expect((await events()).map(([type]) => type).slice(-3)).toEqual([
      "bot.deleted",
      "bots.reordered",
      "trash.changed",
    ]);
    expect(await failure(backend.bots.get(a))).toMatchObject({ code: "bot_deleted" });
    expect(await failure(backend.bots.setPinned([a], [c, b]))).toMatchObject({
      code: "bot_list_changed",
    });
    const restored = await backend.bots.restoreBySlug("a");
    expect(restored).toMatchObject({ pinned_position: null, row_version: 3 });
    const last = (await events()).slice(-2);
    expect(last).toEqual([
      ["bot.restored", { bot: restored }],
      ["trash.changed", { counts: { skill: 0, bot: 0 } }],
    ]);
  });
});

describe("pinned order races (architecture.md §11)", () => {
  it("two pinned-order changes from two tabs at once: one wins, the other gets bot_list_changed", async () => {
    const a = BotId.parse((await create({ name: "A" })).id);
    const b = BotId.parse((await create({ name: "B" })).id);
    const results = await Promise.allSettled([
      backend.bots.setPinned([a, b], []),
      backend.bots.setPinned([b], []),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
    const won = results.find((result) => result.status === "fulfilled");
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.status === "rejected" ? rejected.reason : null).toMatchObject({
      code: "bot_list_changed",
    });
    expect(await backend.readers.bots.pinnedIds()).toEqual(
      won?.status === "fulfilled" ? won.value : [],
    );
    expect((await events()).filter(([type]) => type === "bots.reordered")).toHaveLength(1);
  });
});

describe("pins (PUT and DELETE /bots/{id}/skills/{skill_id})", () => {
  it("assigns, toggles and removes; a stale expected gets the current pin", async () => {
    const notes = await skill("notes");
    const bot = await create();
    const id = BotId.parse(bot.id);
    const v1 = (await backend.readers.skills.latestVersion(notes))?.id;
    if (v1 === undefined) throw new Error("v1");
    await backend.bots.setPin(id, notes, {
      skill_version_id: v1,
      always_load: false,
      expected: null,
    });
    const error = await failure(
      backend.bots.setPin(id, notes, { skill_version_id: v1, always_load: true, expected: null }),
    );
    expect(error).toMatchObject({
      code: "stale_write",
      current: { skill_version_id: v1, always_load: false },
    });
    const toggled = await backend.bots.setPin(id, notes, {
      skill_version_id: v1,
      always_load: true,
      expected: { skill_version_id: v1, always_load: false },
    });
    expect(toggled.pins).toMatchObject([{ always_load: true }]);
    expect(toggled.row_version).toBe(1);
    await backend.bots.removePin(id, notes);
    await backend.bots.removePin(id, notes);
    expect((await backend.bots.get(id)).pins).toEqual([]);
    expect((await events()).filter(([type]) => type === "bot.updated")).toHaveLength(3);
  });
});

describe("skill pin races (architecture.md §11)", () => {
  it("two pin changes from two tabs at once: one wins, the other gets stale_write and the current pin", async () => {
    const notes = await skill("notes");
    const id = BotId.parse((await create()).id);
    const v1 = (await backend.readers.skills.latestVersion(notes))?.id;
    if (v1 === undefined) throw new Error("v1");
    const results = await Promise.allSettled([
      backend.bots.setPin(id, notes, { skill_version_id: v1, always_load: true, expected: null }),
      backend.bots.setPin(id, notes, { skill_version_id: v1, always_load: false, expected: null }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
    const won = results.find((result) => result.status === "fulfilled");
    const rejected = results.find((result) => result.status === "rejected");
    const kept = won?.status === "fulfilled" ? won.value.pins[0]?.always_load : undefined;
    expect(rejected?.status === "rejected" ? rejected.reason : null).toMatchObject({
      code: "stale_write",
      current: { skill_version_id: v1, always_load: kept },
    });
    expect((await backend.bots.get(id)).pins).toMatchObject([{ always_load: kept }]);
    expect((await events()).filter(([type]) => type === "bot.updated")).toHaveLength(1);
  });
});

describe("skills that touch pins (api.md §2)", () => {
  it("counts live bots, lists upgrade candidates, and moves pins with POST /skills/{id}/bots", async () => {
    const notes = await skill("notes");
    const bot = await create({ pins: [{ skill_id: notes, always_load: true }] });
    const id = BotId.parse(bot.id);
    const v1 = bot.pins[0]?.skill_version_id ?? null;
    await backend.skills.addVersion(
      notes,
      { baseVersion: 1, description: "v2", bodyMd: "## v2" },
      OWNER_ID,
    );
    expect(await backend.skills.summary(notes, OWNER_ID)).toMatchObject({
      bots_using: 1,
      bots_outdated: 1,
    });
    expect(await backend.skills.upgradeCandidates(notes)).toMatchObject([
      { bot_id: id, version: 1 },
    ]);
    const v2 = (await backend.readers.skills.latestVersion(notes))?.id;
    if (v2 === undefined) throw new Error("v2");
    expect(
      await failure(
        backend.bots.pinSkillToBots(notes, v2, [{ botId: id, expectedSkillVersionId: null }]),
      ),
    ).toMatchObject({ code: "stale_write" });
    const [moved] = await backend.bots.pinSkillToBots(notes, v2, [
      { botId: id, expectedSkillVersionId: v1 },
    ]);
    expect(moved?.pins).toMatchObject([{ version: 2, always_load: true }]);
    expect(await backend.skills.summary(notes, OWNER_ID)).toMatchObject({ bots_outdated: 0 });
  });

  it("moves no pin and writes no event when a later bot in the batch fails", async () => {
    const notes = await skill("notes");
    const first = await create({ name: "A", pins: [{ skill_id: notes, always_load: false }] });
    const second = await create({ name: "B", pins: [{ skill_id: notes, always_load: false }] });
    const v1 = first.pins[0]?.skill_version_id ?? null;
    await backend.skills.addVersion(
      notes,
      { baseVersion: 1, description: "v2", bodyMd: "## v2" },
      OWNER_ID,
    );
    const v2 = (await backend.readers.skills.latestVersion(notes))?.id;
    if (v1 === null || v2 === undefined) throw new Error("versions");
    const before = (await events()).length;
    // The first change is valid and is written before the second one fails its check.
    const error = await failure(
      backend.bots.pinSkillToBots(notes, v2, [
        { botId: BotId.parse(first.id), expectedSkillVersionId: v1, alwaysLoad: true },
        { botId: BotId.parse(second.id), expectedSkillVersionId: null },
      ]),
    );
    expect(error).toMatchObject({ code: "stale_write", field: "bots[1]" });
    for (const bot of [first, second]) {
      expect((await backend.bots.get(BotId.parse(bot.id))).pins).toMatchObject([
        { skill_version_id: v1, version: 1, always_load: false },
      ]);
    }
    expect((await events()).length).toBe(before);
    expect(await backend.skills.summary(notes, OWNER_ID)).toMatchObject({ bots_outdated: 2 });
  });

  it("deprecate removes the ticked pins; Trash removes the rest; restore suggests live bots", async () => {
    const notes = await skill("notes");
    const a = await create({ name: "A", pins: [{ skill_id: notes, always_load: false }] });
    const b = await create({ name: "B", pins: [{ skill_id: notes, always_load: false }] });
    const c = await create({ name: "C", pins: [{ skill_id: notes, always_load: false }] });
    const ids = [a, b, c].map((bot) => BotId.parse(bot.id));
    const [aId, bId, cId] = ids;
    if (aId === undefined || bId === undefined || cId === undefined) throw new Error("ids");
    let summary = await backend.skills.summary(notes, OWNER_ID);
    expect(
      await failure(
        backend.skills.deprecate(
          notes,
          {
            removeBotIds: [BotId.parse(newTestId("bot"))],
            rowVersion: summary.row_version,
          },
          OWNER_ID,
        ),
      ),
    ).toMatchObject({ code: "validation_error", field: "remove_bot_ids" });
    await backend.skills.deprecate(
      notes,
      { removeBotIds: [aId], rowVersion: summary.row_version },
      OWNER_ID,
    );
    expect((await backend.bots.get(aId)).pins).toEqual([]);
    expect((await backend.bots.get(bId)).health).toEqual({
      level: "needs_attention",
      reason: "deprecated_skill",
    });
    await backend.bots.trash(cId);
    summary = await backend.skills.summary(notes, OWNER_ID);
    expect(summary.bots_using).toBe(1);
    const trashed = await backend.skills.trash(
      notes,
      { rowVersion: summary.row_version },
      OWNER_ID,
    );
    expect(new Set(trashed.removed_bot_ids)).toEqual(new Set([bId, cId]));
    expect((await backend.bots.get(bId)).pins).toEqual([]);
    const restored = await backend.skills.restore(notes, OWNER_ID);
    expect(restored.suggested_bot_ids).toEqual([bId]);
  });
});

describe("purge (D50)", () => {
  it("turns a bot in Trash into a tombstone after trash_days, freeing the name, not the slug", async () => {
    const notes = await skill("notes");
    const bot = await create({ pins: [{ skill_id: notes, always_load: false }] });
    const id = BotId.parse(bot.id);
    await backend.bots.setPinned([id], []);
    await backend.bots.trash(id);
    clock.advance(29 * DAY);
    expect(await backend.bots.purgeDue()).toBe(0);
    clock.advance(DAY);
    expect(await backend.bots.purgeDue()).toBe(1);
    const row = await backend.readers.bots.byId(id);
    expect(row).toMatchObject({
      name: "BA",
      slug: "ba",
      description: "",
      personaMd: "",
      toolSettings: {},
      createKey: null,
      createRequestHash: null,
      pinnedPosition: null,
    });
    expect(row?.purgedAt).not.toBeNull();
    expect(await backend.readers.bots.pins(id)).toEqual([]);
    expect(await failure(backend.bots.get(id))).toMatchObject({ code: "bot_purged" });
    expect((await create({ name: "ba" })).slug).toBe("ba-2");
    const last = (await events()).filter(([type]) => type === "bot.purged");
    expect(last).toEqual([["bot.purged", { bot_id: id }]]);
  });
});
