import yazl from "yazl";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { ORIGIN, testBackend } from "../helpers.ts";

// security.md §2.8 and §3: classic injection strings in every text and query parameter are stored
// or rejected literally. Each test also checks that a skill and a bot the request has nothing to
// do with stay as they were, and that the tables are still there.
const INJECTIONS = [`' OR 1=1 --`, `"; DROP TABLE skills; --`, `'; DROP TABLE bots; --`];

const SkillRow = z.looseObject({ id: z.string(), row_version: z.number() });
const BotRow = z.looseObject({ id: z.string(), row_version: z.number() });
const ErrorBody = z.object({ error: z.object({ code: z.string(), field: z.string().optional() }) });

let backend: ReturnType<typeof testBackend>;
let otherSkill: z.infer<typeof SkillRow>;
let otherBot: z.infer<typeof BotRow>;

function send(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  return backend.request(`/api${path}`, {
    method,
    headers: { origin: ORIGIN, "content-type": "application/json", ...headers },
    body: body === undefined ? null : JSON.stringify(body),
  });
}

let keys = 0;
const nextKey = () => {
  keys += 1;
  return `0190a000-0000-7000-8000-${String(keys).padStart(12, "0")}`;
};

const newSkill = ({ slug, text }: { slug: string; text: string }) => ({
  slug,
  name: text,
  description: text,
  body_md: text,
});
const newBot = (text: string) => ({
  name: text,
  description: text,
  persona_md: text,
  avatar_style: "flat",
  avatar_colour: "#336699",
  model_id: "fake:effort",
  pins: [],
});

async function createSkill({ slug, text }: { slug: string; text: string }) {
  const response = await send("POST", "/skills", newSkill({ slug, text }));
  expect(response.status).toBe(201);
  return SkillRow.parse(await response.json());
}
async function createBot(text: string) {
  const response = await send("POST", "/bots", newBot(text), { "idempotency-key": nextKey() });
  expect(response.status).toBe(201);
  return BotRow.parse(await response.json());
}

// A refusal is a client error with a code, never a server error.
async function expectRefused(response: Response, code: string, field?: string) {
  expect(response.status).toBe(422);
  const { error } = ErrorBody.parse(await response.json());
  expect(error.code).toBe(code);
  if (field !== undefined) expect(error.field).toBe(field);
}

async function expectOthersIntact() {
  const skill = await send("GET", `/skills/${otherSkill.id}`);
  expect(skill.status).toBe(200);
  expect(await skill.json()).toMatchObject({
    name: "Bystander",
    body_md: "Bystander",
    row_version: otherSkill.row_version,
  });
  const bot = await send("GET", `/bots/${otherBot.id}`);
  expect(bot.status).toBe(200);
  expect(await bot.json()).toMatchObject({
    name: "Bystander",
    persona_md: "Bystander",
    row_version: otherBot.row_version,
  });
}

async function zipBytes(): Promise<Uint8Array> {
  const zip = new yazl.ZipFile();
  zip.addBuffer(
    Buffer.from("---\nname: fresh\ndescription: Use it.\n---\n\nBody"),
    "fresh/SKILL.md",
  );
  zip.end();
  const chunks: Uint8Array[] = [];
  for await (const chunk of zip.outputStream) chunks.push(chunk as Uint8Array);
  return new Uint8Array(Buffer.concat(chunks));
}

beforeEach(async () => {
  backend = testBackend({ FAKE_MODEL: "1" });
  otherSkill = await createSkill({ slug: "bystander", text: "Bystander" });
  otherBot = await createBot("Bystander");
});
afterEach(() => {
  backend.close();
});

describe.each(INJECTIONS)("the text %s", (text) => {
  it("is stored literally in a new skill", async () => {
    const { id } = await createSkill({ slug: "target", text });
    const read = await send("GET", `/skills/${id}`);
    expect(await read.json()).toMatchObject({ name: text, body_md: text });
    await expectOthersIntact();
  });

  it("is stored literally in a skill's rename and its new version", async () => {
    const skill = await createSkill({ slug: "target", text: "Target" });
    const renamed = await send("PATCH", `/skills/${skill.id}`, {
      name: text,
      row_version: skill.row_version,
    });
    expect(renamed.status).toBe(200);
    const saved = await send("POST", `/skills/${skill.id}/versions`, {
      base_version: 1,
      description: text,
      body_md: text,
      changelog: text,
    });
    expect(saved.status).toBe(201);
    const read = await send("GET", `/skills/${skill.id}`);
    expect(await read.json()).toMatchObject({ name: text, body_md: text });
    const versions = await send("GET", `/skills/${skill.id}/versions`);
    expect(await versions.json()).toMatchObject([{ version: 2, changelog: text }, { version: 1 }]);
    await expectOthersIntact();
  });

  it("is stored literally in a bot, new and changed", async () => {
    const bot = await createBot(text);
    expect(bot).toMatchObject({ name: text, description: text, persona_md: text });
    const other = `${text} 2`;
    const patched = await send("PATCH", `/bots/${bot.id}`, {
      row_version: bot.row_version,
      name: other,
      description: other,
      persona_md: other,
    });
    expect(patched.status).toBe(200);
    const read = await send("GET", `/bots/${bot.id}`);
    expect(await read.json()).toMatchObject({ name: other, persona_md: other });
    await expectOthersIntact();
  });

  it("is refused as a skill slug or a bot's model", async () => {
    await expectRefused(
      await send("POST", "/skills", newSkill({ slug: text, text: "Target" })),
      "validation_error",
      "slug",
    );
    await expectRefused(
      await send(
        "POST",
        "/bots",
        { ...newBot("Target"), model_id: text },
        { "idempotency-key": nextKey() },
      ),
      "model_not_available",
      "model_id",
    );
    await expectOthersIntact();
  });

  it("is refused in every query parameter and id in a path", async () => {
    const param = encodeURIComponent(text);
    const skill = otherSkill.id;
    for (const [path, code, field] of [
      [`/skills?include_deprecated=${param}`, "validation_error", "include_deprecated"],
      [`/skills/export?ids=${param}`, "invalid_id", "ids"],
      [`/skills/${skill}/diff?from=${param}&to=1`, "validation_error", "from"],
      [`/skills/${skill}/diff?from=1&to=${param}`, "validation_error", "to"],
      [`/skills?${param}=1`, "validation_error", undefined],
      [`/bots?${param}=1`, "validation_error", undefined],
      [`/skills/${param}`, "invalid_id", "id"],
      [`/bots/${param}`, "invalid_id", "id"],
      [`/skills/${skill}/versions/${param}`, "validation_error", "version"],
      [`/avatars/${param}`, "validation_error", "file"],
    ] as const) {
      await expectRefused(await send("GET", path), code, field);
    }
    await expectOthersIntact();
  });

  it("changes nothing as an import's preview id or slug, and as the zip's file name", async () => {
    const form = new FormData();
    form.set("file", new File([await zipBytes()], `${text}.zip`));
    const previewed = await backend.request("/api/skills/import/preview", {
      method: "POST",
      headers: { origin: ORIGIN },
      body: form,
    });
    expect(previewed.status).toBe(200);
    const preview = z
      .looseObject({ preview_id: z.string(), file: z.string() })
      .parse(await previewed.json());
    expect(preview.file).toBe(`${text}.zip`);

    const unknownPreview = await send("POST", "/skills/import/apply", {
      preview_id: text,
      slugs: ["fresh"],
    });
    expect(unknownPreview.status).toBeGreaterThanOrEqual(400);
    expect(unknownPreview.status).toBeLessThan(500);
    const unknownSlug = await send("POST", "/skills/import/apply", {
      preview_id: preview.preview_id,
      slugs: [text],
    });
    expect(unknownSlug.status).toBeLessThan(500);
    await expectOthersIntact();
  });
});
