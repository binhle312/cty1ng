import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { OWNER_ID } from "../../src/core/owner.ts";
import { ORIGIN, testBackend } from "../helpers.ts";

// The bots routes (api.md §4) and the skill routes that touch pins (api.md §2): status codes,
// error codes, headers and strict bodies. The service rules have their own tests.

let backend: ReturnType<typeof testBackend>;
beforeEach(() => {
  backend = testBackend({ FAKE_MODEL: "1" });
});
afterEach(() => {
  backend.close();
});

const KEY = "0190a000-0000-7000-8000-000000000001";
const newBot = {
  name: "BA",
  description: "Writes user stories.",
  persona_md: "You are a business analyst.",
  avatar_style: "flat",
  avatar_colour: "#336699",
  model_id: "fake:effort",
  pins: [],
};

function send(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  return backend.request(`/api${path}`, {
    method,
    headers: { origin: ORIGIN, "content-type": "application/json", ...headers },
    body: body === undefined ? null : JSON.stringify(body),
  });
}

const AnyObject = z.record(z.string(), z.unknown());
const ErrorBody = z.object({
  error: z.object({
    code: z.string(),
    field: z.string().optional(),
    current: z.unknown().optional(),
  }),
});

async function json(response: Response): Promise<Record<string, unknown>> {
  return AnyObject.parse(await response.json());
}

async function errorOf(response: Response) {
  return ErrorBody.parse(await response.json()).error;
}

async function createBot(body: Record<string, unknown> = newBot, key = KEY) {
  const response = await send("POST", "/bots", body, { "idempotency-key": key });
  return { response, bot: await json(response.clone()) };
}

describe("POST /bots", () => {
  it("needs an Idempotency-Key, answers 201, and a repeat answers 200 with the same bot", async () => {
    const missing = await send("POST", "/bots", newBot);
    expect(missing.status).toBe(422);
    expect(await errorOf(missing)).toMatchObject({ field: "idempotency-key" });
    const first = await createBot();
    expect(first.response.status).toBe(201);
    const again = await createBot();
    expect(again.response.status).toBe(200);
    expect(again.bot.id).toBe(first.bot.id);
    const other = await createBot({ ...newBot, name: "Other" });
    expect(other.response.status).toBe(409);
  });

  it.each([
    [{ ...newBot, avatar_colour: "blue" }, 422, "avatar_colour"],
    [{ ...newBot, unknown: 1 }, 422, "unknown"],
    [{ ...newBot, model_id: "nobody:x" }, 422, "model_id"],
    [{ ...newBot, effort: "max" }, 422, "effort"],
  ])("refuses %j with %d on %s", async (body, status, field) => {
    const { response } = await createBot(body);
    expect(response.status).toBe(status);
    expect(await errorOf(response)).toMatchObject({ field });
  });

  it("answers 409 name_taken for a name whose key is taken", async () => {
    await createBot();
    const { response } = await createBot(
      { ...newBot, name: "ｂａ" },
      "0190a000-0000-7000-8000-000000000002",
    );
    expect(response.status).toBe(409);
    expect(await errorOf(response)).toMatchObject({ code: "name_taken", field: "name" });
  });
});

describe("/bots/{id}", () => {
  it("PATCH refuses model_id and effort and leaves the row unchanged (D7, invariant 1)", async () => {
    const { bot } = await createBot();
    for (const field of [{ model_id: "fake:scripted" }, { effort: "low" }]) {
      const response = await send("PATCH", `/bots/${String(bot.id)}`, { row_version: 1, ...field });
      expect(response.status).toBe(422);
    }
    const now = await json(await send("GET", `/bots/${String(bot.id)}`));
    expect(now).toMatchObject({ model_id: "fake:effort", effort: "medium", row_version: 1 });
    expect(now.conversations).toEqual([]);
  });

  it("PATCH saves, and a stale row_version gets 409", async () => {
    const { bot } = await createBot();
    const saved = await send("PATCH", `/bots/${String(bot.id)}`, { row_version: 1, name: "Ana" });
    expect(saved.status).toBe(200);
    const stale = await send("PATCH", `/bots/${String(bot.id)}`, { row_version: 1, name: "X" });
    expect(stale.status).toBe(409);
    expect(await errorOf(stale)).toMatchObject({ code: "stale_write" });
  });

  it("DELETE moves to Trash; GET then gives 422 bot_deleted; a bad id gives invalid_id", async () => {
    const { bot } = await createBot();
    expect((await send("DELETE", `/bots/${String(bot.id)}`)).status).toBe(200);
    const gone = await send("GET", `/bots/${String(bot.id)}`);
    expect(gone.status).toBe(422);
    expect(await errorOf(gone)).toMatchObject({ code: "bot_deleted" });
    expect(await (await send("GET", "/bots")).json()).toEqual([]);
    expect((await errorOf(await send("GET", "/bots/skill_x"))).code).toBe("invalid_id");
  });

  it("GET /bots/{id}/clone-template gives a create body without a colour", async () => {
    const { bot } = await createBot();
    const template = await json(await send("GET", `/bots/${String(bot.id)}/clone-template`));
    expect(template).toMatchObject({ name: "BA (copy)", cloned_from_bot_id: bot.id });
    expect(template).not.toHaveProperty("avatar_colour");
  });
});

describe("PUT /bots/pins", () => {
  it("saves the pinned list, and a stale expected list gets 409 bot_list_changed", async () => {
    const { bot } = await createBot();
    const saved = await send("PUT", "/bots/pins", { bot_ids: [bot.id], expected_bot_ids: [] });
    expect(await json(saved)).toEqual({ pinned_bot_ids: [bot.id] });
    const stale = await send("PUT", "/bots/pins", { bot_ids: [], expected_bot_ids: [] });
    expect(stale.status).toBe(409);
    expect(await errorOf(stale)).toMatchObject({ code: "bot_list_changed" });
  });
});

describe("pins", () => {
  async function skillWithBot() {
    const skill = await backend.skills.create(
      { slug: "notes", name: "Notes", description: "Use it.", bodyMd: "## Steps" },
      OWNER_ID,
    );
    const { bot } = await createBot();
    const v1 = (await backend.readers.skills.latestVersion(skill.id))?.id ?? "";
    return { skill, bot, v1 };
  }

  it("PUT assigns; a stale expected gets 409 with the current pin; DELETE gives 204 twice", async () => {
    const { skill, bot, v1 } = await skillWithBot();
    const path = `/bots/${String(bot.id)}/skills/${skill.id}`;
    const pin = { skill_version_id: v1, always_load: false, expected: null };
    expect((await send("PUT", path, pin)).status).toBe(200);
    const stale = await send("PUT", path, pin);
    expect(stale.status).toBe(409);
    expect(await errorOf(stale)).toMatchObject({
      code: "stale_write",
      current: { skill_version_id: v1, always_load: false },
    });
    expect((await send("DELETE", path)).status).toBe(204);
    expect((await send("DELETE", path)).status).toBe(204);
  });

  it("POST /skills/{id}/bots moves the listed bots; the version body has no upgrade_bot_ids", async () => {
    const { skill, bot, v1 } = await skillWithBot();
    const moved = await send("POST", `/skills/${skill.id}/bots`, {
      skill_version_id: v1,
      bots: [{ bot_id: bot.id, expected_skill_version_id: null }],
    });
    expect(moved.status).toBe(200);
    expect(await moved.json()).toMatchObject([{ id: bot.id, pins: [{ version: 1 }] }]);
    const old = await send("POST", `/skills/${skill.id}/versions`, {
      base_version: 1,
      description: "d",
      body_md: "b",
      upgrade_bot_ids: [],
    });
    expect(old.status).toBe(422);
    expect(await errorOf(old)).toMatchObject({ field: "upgrade_bot_ids" });
    const candidates = await send("GET", `/skills/${skill.id}/upgrade-candidates`);
    expect(await candidates.json()).toEqual([]);
  });
});
