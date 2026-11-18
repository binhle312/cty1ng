import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { OWNER_ID } from "../../src/core/owner.ts";
import { ORIGIN, testBackend } from "../helpers.ts";
import { fastestRunAsync } from "../timed.ts";

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

// The guard's own test password (sensitive-data.rules.test.ts), short enough for the name limit.
const SECRET = "password: hunter22";

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
    message: z.string(),
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
    [{ ...newBot, description: "first\nsecond" }, 422, "description"],
  ])("refuses %j with %d on %s", async (body, status, field) => {
    const { response } = await createBot(body);
    expect(response.status).toBe(status);
    expect(await errorOf(response)).toMatchObject({ field });
  });

  // Item 32 of the P3 list: one format for `field` (api.md §1): `[i]` for an index of a list,
  // a dot before a key of an object.
  it("names a list item in a 422 with [i]: pins[0].skill_id", async () => {
    const { response } = await createBot({
      ...newBot,
      pins: [{ skill_id: "not-an-id", always_load: false }],
    });
    expect(response.status).toBe(422);
    expect(await errorOf(response)).toMatchObject({
      code: "validation_error",
      field: "pins[0].skill_id",
    });
  });

  // DQ-385 (api.md §1): `field` is the first unknown key, never the keys joined with a dot, which
  // the format reads as a key inside a key. The message names every unknown key.
  it("names one unknown key in field and message", async () => {
    const { response } = await createBot({ ...newBot, nmae: "x" });
    expect(response.status).toBe(422);
    expect(await errorOf(response)).toMatchObject({
      code: "validation_error",
      field: "nmae",
      message: "Unknown field: nmae.",
    });
  });

  it("names the first of two unknown keys in field and both in the message", async () => {
    const { response } = await createBot({ ...newBot, nmae: "x", colr: "y" });
    expect(response.status).toBe(422);
    expect(await errorOf(response)).toMatchObject({
      code: "validation_error",
      field: "nmae",
      message: "Unknown fields: nmae, colr.",
    });
  });

  it("names the full path to an unknown key inside a list item", async () => {
    const { response } = await createBot({
      ...newBot,
      pins: [{ skill_id: "skill_01jb8x6p0afqz8r2m3k5t7v9wx", always_load: false, extra: 1 }],
    });
    expect(response.status).toBe(422);
    expect(await errorOf(response)).toMatchObject({
      code: "validation_error",
      field: "pins[0].extra",
      message: "Unknown field: extra.",
    });
  });

  // R1-1 of PR 134: an empty key at the root names no field, so the answer has no `field`
  // (api.md §1). Inside an object the answer is not covered here.
  it("gives no field for an unknown key that is empty", async () => {
    const { response } = await createBot({ ...newBot, "": 1 });
    expect(response.status).toBe(422);
    const error = await errorOf(response);
    expect(error).toMatchObject({ code: "validation_error" });
    expect(error).not.toHaveProperty("field");
  });

  // DQ-735 (the chief's decision inside the owner's answer q4 Q4 A): a key with a character
  // outside letters, digits, `_`, `$` and `-` is written as a JSON string in the message, so a
  // comma or a quote in a key is not read as a separator. `field` keeps the raw key.
  it("writes an empty unknown key as an empty JSON string in the message", async () => {
    const { response } = await createBot({ ...newBot, "": 1 });
    expect(await errorOf(response)).toMatchObject({ message: 'Unknown field: "".' });
  });

  it("writes an unknown key with a comma as a JSON string in the message", async () => {
    const { response } = await createBot({ ...newBot, "a, b": 1, c: 2 });
    expect(await errorOf(response)).toMatchObject({
      field: "a, b",
      message: 'Unknown fields: "a, b", c.',
    });
  });

  it("writes an unknown key with a quote as a JSON string in the message", async () => {
    const { response } = await createBot({ ...newBot, 'c"d': 1 });
    expect(await errorOf(response)).toMatchObject({ message: 'Unknown field: "c\\"d".' });
  });

  // Item 34 of the P3 list: a key of tool_settings has the shape of a catalog tool id.
  it("refuses a tool_settings key that is not a tool id with 422", async () => {
    const { response } = await createBot({ ...newBot, tool_settings: { "Not An Id": false } });
    expect(response.status).toBe(422);
    expect(await errorOf(response)).toMatchObject({
      code: "validation_error",
      field: "tool_settings.Not An Id",
    });
  });

  it("accepts a turned-off tool id that the model does not offer", async () => {
    const { response } = await createBot({ ...newBot, tool_settings: { not_offered: false } });
    expect(response.status).toBe(201);
  });

  // Review of #115 (R1-6): a wrong type inside a list item gets the same format.
  it("names a wrong type in a list item with [i]: pins[0].always_load", async () => {
    const { response } = await createBot({
      ...newBot,
      pins: [{ skill_id: "skill_01jb8x6p0afqz8r2m3k5t7v9wx", always_load: "yes" }],
    });
    expect(response.status).toBe(422);
    expect(await errorOf(response)).toMatchObject({
      code: "validation_error",
      field: "pins[0].always_load",
    });
  });

  it("names a key of an object in a 422 after a dot: tool_settings.web_fetch", async () => {
    const { response } = await createBot({ ...newBot, tool_settings: { web_fetch: "on" } });
    expect(response.status).toBe(422);
    expect(await errorOf(response)).toMatchObject({
      code: "validation_error",
      field: "tool_settings.web_fetch",
    });
  });

  // The guard on the name and the description (D39), through the route: 422 with the field.
  it.each([
    ["name", { ...newBot, name: `BA ${SECRET}` }],
    ["description", { ...newBot, description: `Logs in with ${SECRET}.` }],
  ])("refuses a secret in the %s with 422 sensitive_data", async (field, body) => {
    const { response } = await createBot(body);
    expect(response.status, "the create is refused").toBe(422);
    expect(await errorOf(response)).toMatchObject({ code: "sensitive_data", field });
    expect(await (await send("GET", "/bots")).json()).toEqual([]);
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

  it.each([
    ["name", { name: `BA ${SECRET}` }],
    ["description", { description: `Logs in with ${SECRET}.` }],
    ["persona_md", { persona_md: `You log in with ${SECRET}.` }],
  ])("PATCH refuses a secret in the %s with 422 sensitive_data", async (field, change) => {
    const { bot } = await createBot();
    const response = await send("PATCH", `/bots/${String(bot.id)}`, {
      row_version: 1,
      ...change,
    });
    expect(response.status, "the PATCH is refused").toBe(422);
    expect(await errorOf(response)).toMatchObject({ code: "sensitive_data", field });
    expect(await json(await send("GET", `/bots/${String(bot.id)}`))).toMatchObject({
      name: newBot.name,
      description: newBot.description,
      persona_md: newBot.persona_md,
      row_version: 1,
    });
  });

  it("PATCH refuses a description with a line break and leaves the row unchanged", async () => {
    const { bot } = await createBot();
    const response = await send("PATCH", `/bots/${String(bot.id)}`, {
      row_version: 1,
      description: "first\r\nsecond",
    });
    expect(response.status).toBe(422);
    expect(await errorOf(response)).toMatchObject({
      code: "validation_error",
      field: "description",
    });
    const now = await json(await send("GET", `/bots/${String(bot.id)}`));
    expect(now).toMatchObject({ description: newBot.description, row_version: 1 });
  });

  it("PATCH refuses a 1 MB description on its length, fast, after the guard scan", async () => {
    // The guard runs before the limits (M2 plan §4), so the scan must stay linear.
    // The time is the fastest of up to 3 runs of the same request (backend/test/timed.ts): a busy
    // machine slows one run, a slow scan is slow on every run. The request is refused before any
    // write, so a run changes no state; the check after the runs proves that.
    const { bot } = await createBot();
    const responses: Response[] = [];
    const fastest = await fastestRunAsync(async () => {
      const response = await send("PATCH", `/bots/${String(bot.id)}`, {
        row_version: 1,
        // Just under the 1 MB body limit (security.md §2.7).
        description: "ABC123 ".repeat(140_000),
      });
      expect(response.status).toBe(422);
      responses.push(response);
    }, 2_000);
    expect(fastest, "the PATCH of 1 MB: the fastest of up to 3 runs").toBeLessThan(2_000);
    for (const response of responses) {
      expect(await errorOf(response)).toMatchObject({
        code: "validation_error",
        field: "description",
      });
    }
    const now = await json(await send("GET", `/bots/${String(bot.id)}`));
    expect(now).toMatchObject({ description: newBot.description, row_version: 1 });
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

  it("GET /bots/{id}/clone-template gives form defaults and display data", async () => {
    const { bot } = await createBot();
    const template = await json(await send("GET", `/bots/${String(bot.id)}/clone-template`));
    expect(template).toMatchObject({ name: "BA (copy)", cloned_from_bot_id: bot.id });
    expect(template).not.toHaveProperty("avatar_colour");
    // The source bot's pins, as GET /bots shows them, for the page to name the copied versions.
    expect(template).toHaveProperty("copied_pins", []);
    // Not a create body as it is (api.md): with only a colour added, POST /bots refuses it.
    const asIs = await send(
      "POST",
      "/bots",
      { ...template, avatar_colour: "#112233" },
      { "idempotency-key": crypto.randomUUID() },
    );
    expect(asIs.status).toBe(422);
    expect(await errorOf(asIs)).toMatchObject({ code: "validation_error" });
    // Without `copied_pins`, the same body creates the clone.
    const defaults = Object.fromEntries(
      Object.entries(template).filter(([field]) => field !== "copied_pins"),
    );
    const created = await send(
      "POST",
      "/bots",
      { ...defaults, avatar_colour: "#112233" },
      { "idempotency-key": crypto.randomUUID() },
    );
    expect(created.status).toBe(201);
    // A bot in Trash has no clone template (domain-model.md §2 Clone).
    await send("DELETE", `/bots/${String(bot.id)}`);
    const trashed = await send("GET", `/bots/${String(bot.id)}/clone-template`);
    expect(trashed.status).toBe(422);
    expect(await errorOf(trashed)).toMatchObject({ code: "bot_deleted" });
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

  // Owner, 2026-11-13 (P3 item 37): a new assign pins the version that the request names.
  it("PUT pins an older version on a new assign", async () => {
    const { skill, bot } = await skillWithBot();
    for (const base of [1, 2, 3]) {
      await backend.skills.addVersion(
        skill.id,
        { baseVersion: base, description: "Use it.", bodyMd: `## Steps v${String(base + 1)}` },
        OWNER_ID,
      );
    }
    const v2 = (await backend.readers.skills.version(skill.id, 2))?.id ?? "";
    const path = `/bots/${String(bot.id)}/skills/${skill.id}`;
    const response = await send("PUT", path, {
      skill_version_id: v2,
      always_load: false,
      expected: null,
    });
    expect(await response.json()).toMatchObject({
      pins: [{ skill_version_id: v2, version: 2, latest_version: 4 }],
    });
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

  it("GET /skills/{id}/upgrade-candidates lists a live bot on an older version", async () => {
    const { skill, bot, v1 } = await skillWithBot();
    const path = `/bots/${String(bot.id)}/skills/${skill.id}`;
    await send("PUT", path, { skill_version_id: v1, always_load: true, expected: null });
    await backend.skills.addVersion(
      skill.id,
      { baseVersion: 1, description: "Use it.", bodyMd: "## Steps v2" },
      OWNER_ID,
    );
    const candidates = await send("GET", `/skills/${skill.id}/upgrade-candidates`);
    expect(candidates.status).toBe(200);
    expect(await candidates.json()).toEqual([
      { bot_id: bot.id, skill_version_id: v1, version: 1, always_load: true },
    ]);
  });

  it("POST /skills/{id}/bots refuses restore_suggestion in M2 and a bot in Trash", async () => {
    const { skill, bot, v1 } = await skillWithBot();
    const suggestion = await send("POST", `/skills/${skill.id}/bots`, {
      skill_version_id: v1,
      bots: [{ bot_id: bot.id, expected_skill_version_id: null }],
      restore_suggestion: true,
    });
    expect(suggestion.status).toBe(422);
    expect(await errorOf(suggestion)).toMatchObject({
      code: "validation_error",
      field: "restore_suggestion",
    });
    expect((await send("DELETE", `/bots/${String(bot.id)}`)).status).toBe(200);
    const trashed = await send("POST", `/skills/${skill.id}/bots`, {
      skill_version_id: v1,
      bots: [{ bot_id: bot.id, expected_skill_version_id: null }],
    });
    expect(trashed.status).toBe(409);
    expect(await errorOf(trashed)).toMatchObject({ code: "place_in_trash" });
  });

  it("POST /skills/{id}/deprecate removes the listed pins; a bot without the pin gets 422", async () => {
    const { skill, bot, v1 } = await skillWithBot();
    const path = `/bots/${String(bot.id)}/skills/${skill.id}`;
    await send("PUT", path, { skill_version_id: v1, always_load: false, expected: null });
    const { bot: other } = await createBot(
      { ...newBot, name: "Other" },
      "0190a000-0000-7000-8000-000000000002",
    );
    const { row_version } = await backend.skills.summary(skill.id, OWNER_ID);
    const stale = await send("POST", `/skills/${skill.id}/deprecate`, {
      remove_bot_ids: [other.id],
      row_version,
    });
    expect(stale.status).toBe(422);
    expect(await errorOf(stale)).toMatchObject({
      code: "validation_error",
      field: "remove_bot_ids",
    });
    const deprecated = await send("POST", `/skills/${skill.id}/deprecate`, {
      remove_bot_ids: [bot.id],
      row_version,
    });
    expect(deprecated.status).toBe(200);
    expect(await deprecated.json()).toMatchObject({ deprecated: true, bots_using: 0 });
    expect(await json(await send("GET", `/bots/${String(bot.id)}`))).toMatchObject({ pins: [] });
  });
});
