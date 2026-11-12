import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

async function send(sent: Request) {
  const response = await request(sent);
  const json: unknown = await response.json().catch(() => null);
  const error = typeof json === "object" && json !== null && "error" in json ? json.error : null;
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
  return { status: response.status, code };
}

async function created(path: string, body: unknown): Promise<{ id: string; row_version: number }> {
  const response = await request({ method: "POST", path, body });
  expect(response.status, `POST ${path}`).toBe(201);
  const json: unknown = await response.json();
  if (typeof json !== "object" || json === null || !("id" in json) || !("row_version" in json)) {
    throw new Error("no row in the answer");
  }
  return { id: String(json.id), row_version: Number(json.row_version) };
}

// What a case gets: the id maker, the rows that exist, and 1 or 2 for a value that must be new
// in each of its two requests.
interface With {
  id: IdOf;
  skill: { id: string; row_version: number };
  bot: { id: string; row_version: number };
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
    const rows = {
      skill: await created("/skills", skillBody),
      bot: await created("/bots", botBody),
    };
    const expected = await send(requestOf({ id: unknown, ...rows, run: 1 }));
    // The request with a new id is a real refusal or a real success, so the comparison has a base.
    expect(expected.status, "with an id that does not exist").toBeLessThan(500);
    expect(await send(requestOf({ id: odd, ...rows, run: 2 }))).toEqual(expected);
  });
});
