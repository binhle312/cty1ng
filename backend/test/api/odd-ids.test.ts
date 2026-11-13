import { Bot } from "@cty1ng/shared/bots";
import { Skill, SkillVersionListItem } from "@cty1ng/shared/skills";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { typeIdIds } from "../../src/adapters/ids/typeid-ids.ts";
import { ORIGIN, testBackend } from "../helpers.ts";

// An id with the right prefix and the right shape whose value is no UUID (api.md §1, D36). The
// shape check lets it in, so the database layer must not fail on it. No row has such an id, so
// the answer is the answer for an id that does not exist (audit 2026-11-05, P3 "API"). Each case
// sends its request two times: with a new id that no row has, and with the odd id.

// The value 1 has the UUID version 0, which the UUID library refuses.
const ODD = "00000000000000000000000001";
type IdOf = (prefix: string) => string;
const odd: IdOf = (prefix) => `${prefix}_${ODD}`;
const unknown: IdOf = (prefix) => typeIdIds.newId(prefix);

const skillBody = {
  slug: "notes",
  name: "Notes",
  description: "Use it when you write notes.",
  body_md: "## Steps",
};
const botBody = {
  name: "BA",
  description: "Writes user stories.",
  persona_md: "You are a business analyst.",
  avatar_style: "flat",
  avatar_colour: "#336699",
  model_id: "fake:effort",
  pins: [],
};

let backend: ReturnType<typeof testBackend>;
beforeEach(() => {
  backend = testBackend({ FAKE_MODEL: "1" });
});
afterEach(() => {
  backend.close();
});

interface Request {
  method: string;
  path: string;
  body?: unknown;
}

function request({ method, path, body }: Request) {
  return backend.request(`/api${path}`, {
    method,
    headers: {
      origin: ORIGIN,
      "content-type": "application/json",
      "idempotency-key": crypto.randomUUID(),
    },
    body: body === undefined ? null : JSON.stringify(body),
  });
}

// An answer with an error (api.md §1 Errors). Any other answer has no code.
const ErrorAnswer = z.object({ error: z.object({ code: z.string() }) });

async function send(sent: Request) {
  const response = await request(sent);
  const answer = ErrorAnswer.safeParse(await response.json().catch(() => null));
  return { status: response.status, code: answer.success ? answer.data.error.code : null };
}

// Each answer of the setup is parsed with its schema, so a wrong value stops the setup.
async function read<T>(
  sent: Request,
  { status, schema }: { status: number; schema: z.ZodType<T> },
): Promise<T> {
  const response = await request(sent);
  expect(response.status, `${sent.method} ${sent.path}`).toBe(status);
  return schema.parse(await response.json());
}

async function setup() {
  const skill = await read(
    { method: "POST", path: "/skills", body: skillBody },
    { status: 201, schema: Skill },
  );
  const versions = await read(
    { method: "GET", path: `/skills/${skill.id}/versions` },
    { status: 200, schema: z.array(SkillVersionListItem) },
  );
  const first = versions.find((version) => version.version === 1);
  if (first === undefined) throw new Error("the skill has no version 1");
  const bot = await read(
    { method: "POST", path: "/bots", body: botBody },
    { status: 201, schema: Bot },
  );
  return { skill, skillv: first.id, bot };
}

// What a case gets: the id maker, the rows that exist, and 1 or 2 for a value that must be new
// in each of its two requests.
interface With {
  id: IdOf;
  skill: Skill;
  // The id of version 1 of that skill.
  skillv: string;
  bot: Bot;
  run: number;
}
type Case = (given: With) => Request;

const pin = (id: IdOf) => ({
  skill_version_id: id("skillv"),
  always_load: false,
  expected: null,
});

const CASES: [name: string, requestOf: Case][] = [
  ["GET /skills/{id}", ({ id }) => ({ method: "GET", path: `/skills/${id("skill")}` })],
  [
    "GET /skills/{id}/versions",
    ({ id }) => ({ method: "GET", path: `/skills/${id("skill")}/versions` }),
  ],
  [
    "GET /skills/{id}/versions/{version}",
    ({ id }) => ({ method: "GET", path: `/skills/${id("skill")}/versions/1` }),
  ],
  [
    "GET /skills/{id}/diff",
    ({ id }) => ({ method: "GET", path: `/skills/${id("skill")}/diff?from=1&to=2` }),
  ],
  [
    "GET /skills/{id}/upgrade-candidates",
    ({ id }) => ({ method: "GET", path: `/skills/${id("skill")}/upgrade-candidates` }),
  ],
  [
    "GET /skills/export?ids=",
    ({ id }) => ({ method: "GET", path: `/skills/export?ids=${id("skill")}` }),
  ],
  ["GET /bots/{id}", ({ id }) => ({ method: "GET", path: `/bots/${id("bot")}` })],
  [
    "GET /bots/{id}/clone-template",
    ({ id }) => ({ method: "GET", path: `/bots/${id("bot")}/clone-template` }),
  ],
  ["DELETE /bots/{id}", ({ id }) => ({ method: "DELETE", path: `/bots/${id("bot")}` })],
  [
    "PATCH /skills/{id}",
    ({ id }) => ({
      method: "PATCH",
      path: `/skills/${id("skill")}`,
      body: { name: "New", row_version: 1 },
    }),
  ],
  [
    "PATCH /bots/{id}",
    ({ id }) => ({
      method: "PATCH",
      path: `/bots/${id("bot")}`,
      body: { name: "New", row_version: 1 },
    }),
  ],
  [
    "PUT /bots/{id}/skills/{skill_id}, the bot id",
    ({ id, skill }) => ({
      method: "PUT",
      path: `/bots/${id("bot")}/skills/${skill.id}`,
      body: pin(id),
    }),
  ],
  [
    "PUT /bots/{id}/skills/{skill_id}, the skill id",
    ({ id, bot }) => ({
      method: "PUT",
      path: `/bots/${bot.id}/skills/${id("skill")}`,
      body: pin(id),
    }),
  ],
  [
    "DELETE /bots/{id}/skills/{skill_id}, the skill id",
    ({ id, bot }) => ({ method: "DELETE", path: `/bots/${bot.id}/skills/${id("skill")}` }),
  ],
  [
    "POST /bots, the skill id of a pin",
    ({ id, run }) => ({
      method: "POST",
      path: "/bots",
      body: {
        ...botBody,
        name: `Other ${String(run)}`,
        pins: [{ skill_id: id("skill"), always_load: false }],
      },
    }),
  ],
  [
    "POST /bots, cloned_from_bot_id",
    ({ id, run }) => ({
      method: "POST",
      path: "/bots",
      body: { ...botBody, name: `Other ${String(run)}`, cloned_from_bot_id: id("bot") },
    }),
  ],
  [
    "POST /bots, the skill version id of a pin",
    ({ id, skill, run }) => ({
      method: "POST",
      path: "/bots",
      body: {
        ...botBody,
        name: `Other ${String(run)}`,
        pins: [{ skill_id: skill.id, skill_version_id: id("skillv"), always_load: false }],
      },
    }),
  ],
  [
    "PUT /bots/{id}/skills/{skill_id}, the skill version id of the body",
    ({ id, bot, skill }) => ({
      method: "PUT",
      path: `/bots/${bot.id}/skills/${skill.id}`,
      body: pin(id),
    }),
  ],
  [
    "DELETE /bots/{id}/skills/{skill_id}, the bot id",
    ({ id, skill }) => ({ method: "DELETE", path: `/bots/${id("bot")}/skills/${skill.id}` }),
  ],
  [
    "POST /skills/{id}/versions",
    ({ id }) => ({
      method: "POST",
      path: `/skills/${id("skill")}/versions`,
      body: { base_version: 1, description: "Use it.", body_md: "## Steps" },
    }),
  ],
  [
    "POST /skills/{id}/versions/{version}/restore",
    ({ id }) => ({ method: "POST", path: `/skills/${id("skill")}/versions/1/restore`, body: {} }),
  ],
  [
    "POST /skills/{id}/bots, the skill id",
    ({ id, skillv, bot }) => ({
      method: "POST",
      path: `/skills/${id("skill")}/bots`,
      body: {
        skill_version_id: skillv,
        bots: [{ bot_id: bot.id, expected_skill_version_id: null }],
      },
    }),
  ],
  [
    "POST /skills/{id}/bots, the skill version id",
    ({ id, skill, bot }) => ({
      method: "POST",
      path: `/skills/${skill.id}/bots`,
      body: {
        skill_version_id: id("skillv"),
        bots: [{ bot_id: bot.id, expected_skill_version_id: null }],
      },
    }),
  ],
  [
    "POST /skills/{id}/bots, a bot id of the list",
    ({ id, skill, skillv }) => ({
      method: "POST",
      path: `/skills/${skill.id}/bots`,
      body: {
        skill_version_id: skillv,
        bots: [{ bot_id: id("bot"), expected_skill_version_id: null }],
      },
    }),
  ],
  [
    "POST /skills/{id}/deprecate, the skill id",
    ({ id }) => ({
      method: "POST",
      path: `/skills/${id("skill")}/deprecate`,
      body: { remove_bot_ids: [], row_version: 1 },
    }),
  ],
  [
    "POST /skills/{id}/undeprecate",
    ({ id }) => ({
      method: "POST",
      path: `/skills/${id("skill")}/undeprecate`,
      body: { row_version: 1 },
    }),
  ],
  [
    "POST /skills/{id}/trash",
    ({ id }) => ({
      method: "POST",
      path: `/skills/${id("skill")}/trash`,
      body: { row_version: 1 },
    }),
  ],
  [
    "POST /skills/{id}/restore",
    ({ id }) => ({ method: "POST", path: `/skills/${id("skill")}/restore` }),
  ],
  ["DELETE /skills/{id}", ({ id }) => ({ method: "DELETE", path: `/skills/${id("skill")}` })],
  [
    "GET /skills/export?ids=, after a real id",
    ({ id, skill }) => ({
      method: "GET",
      path: `/skills/export?ids=${skill.id},${id("skill")}`,
    }),
  ],
  [
    "POST /skills, cloned_from_skill_version_id",
    ({ id, run }) => ({
      method: "POST",
      path: "/skills",
      body: {
        ...skillBody,
        slug: `copy-${String(run)}`,
        name: `Copy ${String(run)}`,
        cloned_from_skill_version_id: id("skillv"),
      },
    }),
  ],
];

describe("an id of the right shape that is no UUID", () => {
  it.each(CASES)("%s: answers as for an id that does not exist", async (_name, requestOf) => {
    const rows = await setup();
    const expected = await send(requestOf({ id: unknown, ...rows, run: 1 }));
    // The request with a new id is a real refusal or a real success, so the comparison has a base.
    expect(expected.status, "with an id that does not exist").toBeLessThan(500);
    expect(await send(requestOf({ id: odd, ...rows, run: 2 }))).toEqual(expected);
  });
});

// The pinned list in header order (domain-model.md §2), read from the bots.
async function pinnedIds(): Promise<string[]> {
  const bots = await read({ method: "GET", path: "/bots" }, { status: 200, schema: z.array(Bot) });
  return bots
    .flatMap((bot) =>
      bot.pinned_position === null ? [] : [[bot.pinned_position, bot.id] as const],
    )
    .sort(([a], [b]) => a - b)
    .map(([, id]) => id);
}

// The answer of PUT /bots/pins.
const PinnedAnswer = z.object({ pinned_bot_ids: z.array(z.string()) }).strict();
const pins = (botIds: string[], expected: string[]): Request => ({
  method: "PUT",
  path: "/bots/pins",
  body: { bot_ids: botIds, expected_bot_ids: expected },
});

// PUT /bots/pins compares expected_bot_ids with the pinned list before it looks up each bot id.
// So the case sends the pinned list that it reads, and runs from each start state (DQ-283).
describe("PUT /bots/pins, a bot id of bot_ids that is no UUID", () => {
  it.each([
    ["no bot is pinned", false],
    ["a bot is pinned", true],
  ] as const)("when %s: answers as for an id that does not exist", async (_name, pinFirst) => {
    const bot = await read(
      { method: "POST", path: "/bots", body: botBody },
      { status: 201, schema: Bot },
    );
    if (pinFirst) await read(pins([bot.id], []), { status: 200, schema: PinnedAnswer });
    const pinned = await pinnedIds();
    expect(pinned).toEqual(pinFirst ? [bot.id] : []);
    const pinsWith = (id: IdOf) => pins([...pinned, id("bot")], pinned);
    const expected = await send(pinsWith(unknown));
    expect(expected.status, "with an id that does not exist").toBeLessThan(500);
    expect(await send(pinsWith(odd))).toEqual(expected);
    // The list check passes with this list, so the two requests above got to the id lookup.
    const kept = await read(pins(pinned, pinned), { status: 200, schema: PinnedAnswer });
    expect(kept.pinned_bot_ids).toEqual(pinned);
  });
});
