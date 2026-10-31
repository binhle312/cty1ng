import yazl from "yazl";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SKILL_ZIP } from "../../src/adapters/http/uploads/skill-zip.ts";
import { OWNER_ID } from "../../src/core/owner.ts";
import { ORIGIN, testBackend } from "../helpers.ts";

// The skills routes (api.md §2): status codes, error codes and the zip upload limits. The
// service rules have their own tests next to the services.

const SECRET = "key sk-proj-abcdefghijklmnop1234";
const newSkill = {
  slug: "notes",
  name: "Notes",
  description: "Use it when you write notes.",
  body_md: "## Steps\n\n1. Write.",
};

let backend: ReturnType<typeof testBackend>;
beforeEach(() => {
  backend = testBackend();
});
afterEach(() => {
  backend.close();
});

function send(method: string, path: string, body?: unknown) {
  return backend.request(`/api${path}`, {
    method,
    headers: { origin: ORIGIN, "content-type": "application/json" },
    body: body === undefined ? null : JSON.stringify(body),
  });
}

async function errorOf(response: Response): Promise<{ code: string; field?: string }> {
  const json: unknown = await response.json();
  if (typeof json !== "object" || json === null || !("error" in json)) throw new Error("no error");
  const { error } = json;
  if (typeof error !== "object" || error === null || !("code" in error)) throw new Error("bad");
  return { code: String(error.code), ...("field" in error ? { field: String(error.field) } : {}) };
}

async function created(): Promise<{ id: string; row_version: number }> {
  const response = await send("POST", "/skills", newSkill);
  expect(response.status).toBe(201);
  const json: unknown = await response.json();
  if (typeof json !== "object" || json === null || !("id" in json) || !("row_version" in json)) {
    throw new Error("no skill");
  }
  return { id: String(json.id), row_version: Number(json.row_version) };
}

async function zipOf(files: readonly { path: string; data: Buffer; store?: boolean }[]) {
  const zip = new yazl.ZipFile();
  for (const file of files) zip.addBuffer(file.data, file.path, { compress: file.store !== true });
  zip.end();
  const chunks: Buffer[] = [];
  for await (const chunk of zip.outputStream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// A zip of exactly `size` bytes: one SKILL.md and one stored padding file.
async function zipOfSize(size: number): Promise<Buffer> {
  const skill = { path: "notes/SKILL.md", data: Buffer.from(skillMdText("notes")) };
  const empty = await zipOf([skill, { path: "notes/pad.bin", data: Buffer.alloc(0), store: true }]);
  const zip = await zipOf([
    skill,
    { path: "notes/pad.bin", data: Buffer.alloc(size - empty.length, 0x61), store: true },
  ]);
  expect(zip.length).toBe(size);
  return zip;
}

const skillMdText = (name: string, body = "## Steps\n\n1. Do it.") =>
  `---\nname: ${name}\ndescription: Use it.\n---\n\n${body}`;

function upload(zip: Buffer, name = "skills.zip") {
  const form = new FormData();
  form.set("file", new File([new Uint8Array(zip)], name, { type: "application/zip" }));
  return backend.request("/api/skills/import/preview", {
    method: "POST",
    headers: { origin: ORIGIN },
    body: form,
  });
}

describe("create, read, list", () => {
  it("POST /skills gives 201; GET lists and reads it", async () => {
    const { id } = await created();
    const list = await send("GET", "/skills");
    expect(list.status).toBe(200);
    expect(await list.json()).toMatchObject([{ id, slug: "notes" }]);
    const one = await send("GET", `/skills/${id}`);
    expect(await one.json()).toMatchObject({ id, body_md: "## Steps\n\n1. Write." });
  });

  it("a taken slug gives 409 slug_taken", async () => {
    await created();
    const response = await send("POST", "/skills", newSkill);
    expect(response.status).toBe(409);
    expect(await errorOf(response)).toEqual({ code: "slug_taken", field: "slug" });
  });

  it.each(["new", "import", "Bad", "a--b"])("the slug %j gives 422 on field slug", async (slug) => {
    const response = await send("POST", "/skills", { ...newSkill, slug });
    expect(response.status).toBe(422);
    expect(await errorOf(response)).toEqual({ code: "validation_error", field: "slug" });
  });

  it("an unknown field gives 422", async () => {
    const response = await send("POST", "/skills", { ...newSkill, extra: 1 });
    expect(response.status).toBe(422);
  });

  it("a malformed or wrong-prefix id gives 422 invalid_id; an unknown one 404", async () => {
    expect(await errorOf(await send("GET", "/skills/nope"))).toMatchObject({ code: "invalid_id" });
    const wrongPrefix = await send("GET", "/skills/bot_01jbzb0000000000000000000a");
    expect(wrongPrefix.status).toBe(422);
    const { id } = await created();
    const unknown = id.slice(0, -1) + (id.endsWith("a") ? "b" : "a");
    const missing = await send("GET", `/skills/${unknown}`);
    expect(missing.status).toBe(404);
  });
});

describe("edits", () => {
  it("PATCH renames without a version; a stale row_version gives 409 stale_write", async () => {
    const { id } = await created();
    const renamed = await send("PATCH", `/skills/${id}`, { name: "Meeting notes", row_version: 1 });
    expect(renamed.status).toBe(200);
    expect(await renamed.json()).toMatchObject({
      name: "Meeting notes",
      latest_version: { version: 1 },
    });
    const stale = await send("PATCH", `/skills/${id}`, { name: "Again", row_version: 1 });
    expect(stale.status).toBe(409);
    expect((await errorOf(stale)).code).toBe("stale_write");
  });

  it("PATCH with a secret in the name gives 422 sensitive_data", async () => {
    const { id } = await created();
    const response = await send("PATCH", `/skills/${id}`, {
      name: "password: hunter22",
      row_version: 1,
    });
    expect(response.status).toBe(422);
    expect(await errorOf(response)).toEqual({ code: "sensitive_data", field: "name" });
  });

  it("POST /skills with a secret in the body gives 422 sensitive_data", async () => {
    const response = await send("POST", "/skills", { ...newSkill, body_md: SECRET });
    expect(await errorOf(response)).toEqual({ code: "sensitive_data", field: "body_md" });
  });

  it("POST /versions: 201, then 409 stale_write on the same base version", async () => {
    const { id } = await created();
    const body = { base_version: 1, description: "d", body_md: "b", upgrade_bot_ids: [] };
    const first = await send("POST", `/skills/${id}/versions`, body);
    expect(first.status).toBe(201);
    const second = await send("POST", `/skills/${id}/versions`, body);
    expect(second.status).toBe(409);
  });

  it("POST /versions with name and no row_version gives 422", async () => {
    const { id } = await created();
    const response = await send("POST", `/skills/${id}/versions`, {
      base_version: 1,
      description: "d",
      body_md: "b",
      upgrade_bot_ids: [],
      name: "X",
    });
    expect(response.status).toBe(422);
  });

  it("restore, versions, version and diff", async () => {
    const { id } = await created();
    await send("POST", `/skills/${id}/versions`, {
      base_version: 1,
      description: "d2",
      body_md: "b2",
      upgrade_bot_ids: [],
    });
    const restored = await send("POST", `/skills/${id}/versions/1/restore`, {});
    expect(restored.status).toBe(201);
    expect(await restored.json()).toMatchObject({ latest_version: { version: 3 } });
    expect(await (await send("GET", `/skills/${id}/versions`)).json()).toHaveLength(3);
    expect(await (await send("GET", `/skills/${id}/versions/2`)).json()).toMatchObject({
      body_md: "b2",
    });
    expect((await send("GET", `/skills/${id}/versions/9`)).status).toBe(404);
    const diff = await send("GET", `/skills/${id}/diff?from=1&to=2`);
    const lines: unknown = await diff.json();
    expect(lines).toMatchObject({ description: [{ op: "del" }, { op: "add", text: "d2" }] });
    expect(lines).toHaveProperty("body", expect.arrayContaining([{ op: "add", text: "b2" }]));
    expect(await (await send("GET", `/skills/${id}/upgrade-candidates`)).json()).toEqual([]);
  });

  it("a skill made by someone else gives 403 not_author", async () => {
    const skill = await backend.skills.create(
      { slug: "theirs", name: "Theirs", description: "d", bodyMd: "b" },
      "someone-else",
    );
    const response = await send("POST", `/skills/${skill.id}/versions`, {
      base_version: 1,
      description: "d",
      body_md: "mine",
      upgrade_bot_ids: [],
    });
    expect(response.status).toBe(403);
    expect((await errorOf(response)).code).toBe("not_author");
    expect(OWNER_ID).not.toBe("someone-else");
  });
});

describe("Deprecate, Trash, restore, delete", () => {
  it("runs the whole cycle with the right codes", async () => {
    const { id } = await created();
    const active = await send("POST", `/skills/${id}/trash`, { row_version: 1 });
    expect(active.status).toBe(409);
    expect((await errorOf(active)).code).toBe("not_deprecated");

    expect(
      (await send("POST", `/skills/${id}/deprecate`, { remove_bot_ids: [], row_version: 1 }))
        .status,
    ).toBe(200);
    const readOnly = await send("POST", `/skills/${id}/versions`, {
      base_version: 1,
      description: "d",
      body_md: "b",
      upgrade_bot_ids: [],
    });
    expect((await errorOf(readOnly)).code).toBe("skill_deprecated");
    expect(await (await send("GET", "/skills")).json()).toEqual([]);
    expect(await (await send("GET", "/skills?include_deprecated=true")).json()).toHaveLength(1);

    const trashed = await send("POST", `/skills/${id}/trash`, { row_version: 2 });
    expect(await trashed.json()).toEqual({ skill_id: id, removed_bot_ids: [] });
    expect((await send("GET", `/skills/${id}`)).status).toBe(404);

    const restored = await send("POST", `/skills/${id}/restore`);
    expect(await restored.json()).toMatchObject({
      skill: { deprecated: true },
      suggested_bot_ids: [],
    });

    expect((await send("POST", `/skills/${id}/trash`, { row_version: 4 })).status).toBe(200);
    expect((await send("DELETE", `/skills/${id}`)).status).toBe(204);
    expect((await send("POST", "/skills", newSkill)).status).toBe(201);
  });

  it("DELETE of a skill not in Trash gives 404", async () => {
    const { id } = await created();
    expect((await send("DELETE", `/skills/${id}`)).status).toBe(404);
  });
});

describe("import and export", () => {
  it("preview then apply", async () => {
    const zip = await zipOf([{ path: "fresh/SKILL.md", data: Buffer.from(skillMdText("fresh")) }]);
    const preview = await upload(zip, "team.zip");
    expect(preview.status).toBe(200);
    const json: unknown = await preview.json();
    expect(json).toMatchObject({ file: "team.zip", rows: [{ slug: "fresh", status: "new" }] });
    const previewId =
      typeof json === "object" && json !== null && "preview_id" in json ? json.preview_id : null;
    const applied = await send("POST", "/skills/import/apply", {
      preview_id: previewId,
      slugs: ["fresh"],
    });
    expect(await applied.json()).toMatchObject({ created: 1, new_versions: 0 });
    const again = await send("POST", "/skills/import/apply", {
      preview_id: previewId,
      slugs: ["fresh"],
    });
    expect(again.status).toBe(409);
    expect((await errorOf(again)).code).toBe("preview_expired");
  });

  it("a zip of exactly 5 MB passes; one byte more gives 413", async () => {
    expect((await upload(await zipOfSize(SKILL_ZIP.maxZipBytes))).status).toBe(200);
    const over = await upload(await zipOfSize(SKILL_ZIP.maxZipBytes + 1));
    expect(over.status).toBe(413);
    expect((await errorOf(over)).code).toBe("too_large");
  });

  it("a request over 5 MB + 64 KB is refused before it is read", async () => {
    const response = await upload(
      await zipOfSize(SKILL_ZIP.maxZipBytes + SKILL_ZIP.multipartOverheadBytes + 1),
    );
    expect(response.status).toBe(413);
  });

  it("other routes keep the 1 MB body limit", async () => {
    const response = await send("POST", "/skills", {
      ...newSkill,
      body_md: "x".repeat(1024 * 1024),
    });
    expect(response.status).toBe(413);
  });

  it("a text part where the file belongs gives 422", async () => {
    const form = new FormData();
    form.set("file", "not a file");
    const response = await backend.request("/api/skills/import/preview", {
      method: "POST",
      headers: { origin: ORIGIN },
      body: form,
    });
    expect(response.status).toBe(422);
  });

  it("a damaged zip gives 400 invalid_import", async () => {
    const response = await upload(Buffer.from("not a zip"));
    expect(response.status).toBe(400);
    expect((await errorOf(response)).code).toBe("invalid_import");
  });

  it("export gives a zip named with the count and the UTC time", async () => {
    await created();
    const response = await send("GET", "/skills/export");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("content-disposition")).toMatch(
      /^attachment; filename="1-skills-\d{8}T\d{6}Z\.zip"$/,
    );
    const zip = Buffer.from(await response.arrayBuffer());
    expect(zip.subarray(0, 2).toString()).toBe("PK");
  });

  it("export of an unknown id gives 404; a malformed id 422", async () => {
    expect((await send("GET", "/skills/export?ids=nope")).status).toBe(422);
    const { id } = await created();
    const unknown = id.slice(0, -1) + (id.endsWith("a") ? "b" : "a");
    expect((await send("GET", `/skills/export?ids=${unknown}`)).status).toBe(404);
  });
});
