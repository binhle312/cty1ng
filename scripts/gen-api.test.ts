import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HOST, ORIGIN, testBackend } from "../backend/test/helpers.ts";
import { createClient } from "../frontend/src/lib/api/generated/client/index.ts";
import {
  applySkillImport,
  createSkill,
  exportSkills,
  previewSkillImport,
} from "../frontend/src/lib/api/generated/sdk.gen.ts";

// The generated client against the real Hono routes, with no mock responses (M1 plan, probe P6;
// review of PR #52). A mock hid that the generated Zod schema refused a File before the upload
// was sent, and that the export was declared as JSON.

let backend: ReturnType<typeof testBackend>;
let client: ReturnType<typeof createClient>;
beforeEach(() => {
  backend = testBackend();
  client = createClient({
    baseUrl: `http://${HOST}`,
    fetch: async (input, init) => {
      const request = new Request(input, init);
      const headers = new Headers(request.headers);
      headers.set("host", HOST);
      headers.set("origin", ORIGIN);
      return backend.app.request(new Request(request, { headers }));
    },
  });
});
afterEach(() => {
  backend.close();
});

describe("the generated client with the real app", () => {
  it("uploads a File, applies the preview, and downloads the export as a zip Blob", async () => {
    const exported = await exportSkills({ client });
    expect(exported.response?.status).toBe(200);

    await createSkill({
      client,
      body: { slug: "notes", name: "Notes", description: "Use it.", body_md: "## Steps" },
    });
    const zip = await exportSkills({ client });
    expect(zip.error).toBeUndefined();
    expect(zip.response?.headers.get("content-type")).toBe("application/zip");
    if (!(zip.data instanceof Blob)) throw new Error("the export is not a Blob");

    // The exported zip goes back in: the import sees the same text, so the row is unchanged.
    const bytes = Buffer.from(await zip.data.arrayBuffer());
    expect(bytes.subarray(0, 2).toString()).toBe("PK");
    const file = new File([new Uint8Array(bytes)], "notes.zip", { type: "application/zip" });

    const preview = await previewSkillImport({ client, body: { file } });
    expect(preview.error).toBeUndefined();
    expect(preview.data?.rows).toEqual([
      expect.objectContaining({ slug: "notes", status: "unchanged" }),
    ]);

    const applied = await applySkillImport({
      client,
      body: { preview_id: preview.data?.preview_id ?? "", slugs: ["notes"] },
    });
    // An unchanged row cannot be applied: the error comes back typed.
    expect(applied.response?.status).toBe(422);
  });
});
