import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { manualClock, testBackend } from "../../../test/helpers.ts";
import { DomainError } from "../errors.ts";
import { OWNER_ID } from "../owner.ts";
import type { ImportFolder } from "./skill-import.service.ts";

// Import preview and Apply (domain-model.md §3.5, spec gap pass #9). The zip reader has its own
// tests; here the folders come in already read.

const MINUTE = 60_000;
const skillMd = (name: string, body = "## Steps\n\n1. Do it.", description = "Use it.") =>
  new TextEncoder().encode(`---\nname: ${name}\ndescription: ${description}\n---\n\n${body}`);
const folder = (name: string, text = skillMd(name)): ImportFolder => ({
  folder: name,
  skillMd: text,
  skippedFiles: [],
});

let clock: ReturnType<typeof manualClock>;
let backend: ReturnType<typeof testBackend>;
beforeEach(() => {
  clock = manualClock();
  backend = testBackend({ IMPORT_PREVIEW_MINUTES: "15", IMPORT_PREVIEW_MAX: "2" }, { clock });
});
afterEach(() => {
  backend.close();
});

async function failure(promise: Promise<unknown>): Promise<DomainError> {
  const error: unknown = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  if (!(error instanceof DomainError))
    throw new Error(`expected a DomainError, got ${String(error)}`);
  return error;
}

const create = (slug: string, author = OWNER_ID) =>
  backend.skills.create(
    { slug, name: `Skill ${slug}`, description: "Use it.", bodyMd: "## Steps\n\n1. Do it." },
    author,
  );

describe("preview", () => {
  it("sorts rows and marks new, changed, unchanged, invalid and conflict; writes nothing", async () => {
    await create("same");
    await create("edited");
    await create("theirs", "someone-else");
    const old = await create("old");
    await backend.skills.deprecate(old.id, { removeBotIds: [], rowVersion: 1 }, OWNER_ID);
    const gone = await create("gone");
    await backend.skills.deprecate(gone.id, { removeBotIds: [], rowVersion: 1 }, OWNER_ID);
    await backend.skills.trash(gone.id, { rowVersion: 2 }, OWNER_ID);
    const eventsBefore = (await backend.readers.events.after(0, 1000)).length;

    const preview = await backend.skillImport.preview(
      "skills.zip",
      [
        folder("fresh"),
        folder("same"),
        folder("edited", skillMd("edited", "## Steps\n\n1. Do it better.")),
        folder("theirs", skillMd("theirs", "changed")),
        folder("old", skillMd("old", "changed")),
        folder("gone", skillMd("gone", "changed")),
        folder("new"),
        folder("Bad_Name"),
        { folder: "empty", skillMd: "missing", skippedFiles: ["notes.txt"] },
        { folder: "huge", skillMd: "too_large", skippedFiles: [] },
        folder("leak", skillMd("leak", "key sk-proj-abcdefghijklmnop1234")),
        folder("other", skillMd("not-other")),
      ],
      OWNER_ID,
    );

    expect(preview.file).toBe("skills.zip");
    expect(preview.rows.map((row) => [row.slug, row.status])).toEqual([
      ["Bad_Name", "invalid"],
      ["edited", "changed"],
      ["empty", "invalid"],
      ["fresh", "new"],
      ["gone", "conflict"],
      ["huge", "invalid"],
      ["leak", "invalid"],
      ["new", "invalid"],
      ["old", "conflict"],
      ["other", "invalid"],
      ["same", "unchanged"],
      ["theirs", "conflict"],
    ]);
    const row = (slug: string) => preview.rows.find((found) => found.slug === slug);
    expect(row("fresh")).toMatchObject({ name: "fresh", from_version: null, to_version: 1 });
    expect(row("edited")).toMatchObject({ name: "Skill edited", from_version: 1, to_version: 2 });
    expect(row("edited")?.diff?.body).toContainEqual({ op: "add", text: "1. Do it better." });
    expect(row("same")).toMatchObject({ from_version: 1, to_version: null, diff: null });
    expect(row("empty")).toMatchObject({
      reason: "The folder has no SKILL.md.",
      skipped_files: ["notes.txt"],
    });
    expect(row("huge")?.reason).toBe("SKILL.md is larger than 1 MB.");
    expect(row("leak")?.reason).toMatch(/looks like an API key/);
    expect(row("new")?.reason).toBe("This slug is reserved. Rename the folder.");
    expect(row("other")?.reason).toBe('The name in SKILL.md is "not-other", not the folder name.');
    expect(row("gone")?.reason).toBe("This skill is in Trash.");
    expect(row("old")?.reason).toBe("Deprecated. Make it active again to import.");
    expect(row("theirs")?.reason).toMatch(/Only the author can add a version/);

    expect((await backend.readers.events.after(0, 1000)).length).toBe(eventsBefore);
    expect(await backend.readers.skills.bySlug("fresh")).toBeNull();
  });

  it("an invalid UTF-8 file is invalid", async () => {
    const preview = await backend.skillImport.preview(
      "x.zip",
      [folder("bytes", new Uint8Array([0xff, 0xfe, 0x00]))],
      OWNER_ID,
    );
    expect(preview.rows[0]).toMatchObject({
      status: "invalid",
      reason: "SKILL.md is not UTF-8 text.",
    });
  });
});

describe("apply", () => {
  it("applies the ticked rows in one transaction with the import changelog", async () => {
    await create("edited");
    const preview = await backend.skillImport.preview(
      "team.zip",
      [folder("fresh"), folder("edited", skillMd("edited", "new body")), folder("skip-me")],
      OWNER_ID,
    );
    const result = await backend.skillImport.apply(
      preview.preview_id,
      ["fresh", "edited"],
      OWNER_ID,
    );
    expect(result).toMatchObject({ created: 1, new_versions: 1 });
    expect(result.skills.map((skill) => [skill.slug, skill.latest_version.version])).toEqual([
      ["fresh", 1],
      ["edited", 2],
    ]);
    expect(result.skills[1]?.latest_version.changelog).toBe("Imported from team.zip");
    expect(await backend.readers.skills.bySlug("skip-me")).toBeNull();
  });

  it("a used preview gets preview_expired", async () => {
    const preview = await backend.skillImport.preview("a.zip", [folder("fresh")], OWNER_ID);
    await backend.skillImport.apply(preview.preview_id, ["fresh"], OWNER_ID);
    const error = await failure(backend.skillImport.apply(preview.preview_id, ["fresh"], OWNER_ID));
    expect(error.code).toBe("preview_expired");
  });

  it("an expired preview gets preview_expired", async () => {
    const preview = await backend.skillImport.preview("a.zip", [folder("fresh")], OWNER_ID);
    clock.advance(15 * MINUTE);
    const error = await failure(backend.skillImport.apply(preview.preview_id, ["fresh"], OWNER_ID));
    expect(error.code).toBe("preview_expired");
  });

  it("keeps at most IMPORT_PREVIEW_MAX previews; the oldest goes first", async () => {
    const first = await backend.skillImport.preview("1.zip", [folder("one")], OWNER_ID);
    await backend.skillImport.preview("2.zip", [folder("two")], OWNER_ID);
    const third = await backend.skillImport.preview("3.zip", [folder("three")], OWNER_ID);
    expect(
      (await failure(backend.skillImport.apply(first.preview_id, ["one"], OWNER_ID))).code,
    ).toBe("preview_expired");
    await backend.skillImport.apply(third.preview_id, ["three"], OWNER_ID);
  });

  it("refuses a row that is not new or changed", async () => {
    await create("same");
    const preview = await backend.skillImport.preview("a.zip", [folder("same")], OWNER_ID);
    const error = await failure(backend.skillImport.apply(preview.preview_id, ["same"], OWNER_ID));
    expect(error).toMatchObject({ code: "validation_error", field: "slugs" });
  });

  it("a skill that changed after the preview gives stale_write and applies nothing", async () => {
    const skill = await create("edited");
    const preview = await backend.skillImport.preview(
      "a.zip",
      [folder("fresh"), folder("edited", skillMd("edited", "import body"))],
      OWNER_ID,
    );
    await backend.skills.addVersion(
      skill.id,
      { baseVersion: 1, description: "Use it.", bodyMd: "edited in the app", upgradeBotIds: [] },
      OWNER_ID,
    );
    const error = await failure(
      backend.skillImport.apply(preview.preview_id, ["fresh", "edited"], OWNER_ID),
    );
    expect(error.code).toBe("stale_write");
    expect(await backend.readers.skills.bySlug("fresh")).toBeNull();
  });

  it("a slug taken after the preview gives stale_write", async () => {
    const preview = await backend.skillImport.preview("a.zip", [folder("fresh")], OWNER_ID);
    await create("fresh");
    const error = await failure(backend.skillImport.apply(preview.preview_id, ["fresh"], OWNER_ID));
    expect(error.code).toBe("stale_write");
  });

  it("a skill deleted and made again with the same slug gives stale_write", async () => {
    const skill = await create("edited");
    const preview = await backend.skillImport.preview(
      "a.zip",
      [folder("edited", skillMd("edited", "import body"))],
      OWNER_ID,
    );
    await backend.skills.deprecate(skill.id, { removeBotIds: [], rowVersion: 1 }, OWNER_ID);
    await backend.skills.trash(skill.id, { rowVersion: 2 }, OWNER_ID);
    await backend.skills.purge(skill.id, OWNER_ID);
    await create("edited");
    const error = await failure(
      backend.skillImport.apply(preview.preview_id, ["edited"], OWNER_ID),
    );
    expect(error.code).toBe("stale_write");
  });

  it("a stale_write keeps the preview, so it can be previewed again", async () => {
    const preview = await backend.skillImport.preview("a.zip", [folder("fresh")], OWNER_ID);
    await create("fresh");
    await failure(backend.skillImport.apply(preview.preview_id, ["fresh"], OWNER_ID));
    const again = await failure(backend.skillImport.apply(preview.preview_id, ["fresh"], OWNER_ID));
    expect(again.code).toBe("stale_write");
  });
});
