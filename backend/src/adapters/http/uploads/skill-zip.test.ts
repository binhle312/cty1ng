import yazl from "yazl";
import { describe, expect, it } from "vitest";
import { ApiFailure } from "../errors.ts";
import { readSkillZip, SKILL_ZIP, writeSkillZip } from "./skill-zip.ts";

// The skill zip checks (security.md §2.4, M1 plan P3 and decision 2).

const MB = 1024 * 1024;

async function zipOf(
  files: readonly { path: string; data: Buffer | string; store?: boolean }[],
): Promise<Buffer> {
  const zip = new yazl.ZipFile();
  for (const file of files) {
    const data = typeof file.data === "string" ? Buffer.from(file.data) : file.data;
    zip.addBuffer(data, file.path, { compress: file.store !== true });
  }
  zip.end();
  const chunks: Buffer[] = [];
  for await (const chunk of zip.outputStream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// yazl refuses `..` in a name, so the test writes a safe name of the same length and swaps the
// bytes in the local header and the central directory.
async function slipZip(): Promise<Buffer> {
  const zip = await zipOf([{ path: "xx/SKILL.md", data: "---\nname: x\n---\n" }]);
  return Buffer.from(zip.toString("latin1").replaceAll("xx/SKILL.md", "../SKILL.md"), "latin1");
}

async function failureOf(promise: Promise<unknown>): Promise<ApiFailure> {
  const error: unknown = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  if (!(error instanceof ApiFailure))
    throw new Error(`expected an ApiFailure, got ${String(error)}`);
  return error;
}

describe("readSkillZip", () => {
  it("reads each folder's SKILL.md and lists every other file without opening it", async () => {
    const zip = await zipOf([
      { path: "notes/SKILL.md", data: "---\nname: notes\n---\n" },
      { path: "notes/scripts/run.sh", data: "rm -rf /" },
      { path: "empty/README.md", data: "hi" },
      { path: "loose.txt", data: "top level" },
    ]);
    const folders = await readSkillZip(zip);
    expect(folders.map((found) => [found.folder, found.skippedFiles])).toEqual([
      ["notes", ["scripts/run.sh"]],
      ["empty", ["README.md"]],
    ]);
    const [notes, empty] = folders;
    if (!(notes?.skillMd instanceof Uint8Array)) throw new Error("SKILL.md was not read");
    expect(new TextDecoder().decode(notes.skillMd)).toBe("---\nname: notes\n---\n");
    expect(empty?.skillMd).toBe("missing");
  });

  it("marks a SKILL.md over 1 MB as too_large and does not read it", async () => {
    const zip = await zipOf([
      { path: "big/SKILL.md", data: Buffer.alloc(SKILL_ZIP.maxSkillMdBytes + 1, 0x61) },
      { path: "fits/SKILL.md", data: Buffer.alloc(SKILL_ZIP.maxSkillMdBytes, 0x61) },
    ]);
    const folders = await readSkillZip(zip);
    expect(folders.find((found) => found.folder === "big")?.skillMd).toBe("too_large");
    expect(folders.find((found) => found.folder === "fits")?.skillMd).toHaveLength(MB);
  });

  it("refuses a zip whose SKILL.md files unpack to more than 20 MB", async () => {
    const files = Array.from({ length: 21 }, (_, index) => ({
      path: `s${String(index)}/SKILL.md`,
      data: Buffer.alloc(MB, 0x61),
    }));
    const error = await failureOf(readSkillZip(await zipOf(files)));
    expect(error).toMatchObject({ code: "too_large" });
  });

  it("counts the files it does not open toward the 20 MB", async () => {
    const zip = await zipOf([
      { path: "notes/SKILL.md", data: "---\nname: notes\n---\n" },
      { path: "notes/big.bin", data: Buffer.alloc(SKILL_ZIP.maxTotalUncompressedBytes, 0) },
    ]);
    expect(await failureOf(readSkillZip(zip))).toMatchObject({ code: "too_large" });
  });

  it(`refuses a zip with more than ${String(SKILL_ZIP.maxEntries)} entries`, async () => {
    const files = Array.from({ length: SKILL_ZIP.maxEntries + 1 }, (_, index) => ({
      path: `notes/f${String(index)}.txt`,
      data: "x",
    }));
    expect(await failureOf(readSkillZip(await zipOf(files)))).toMatchObject({
      code: "invalid_import",
    });
    await readSkillZip(await zipOf(files.slice(0, SKILL_ZIP.maxEntries)));
  });

  it("refuses zip slip and imports nothing from it", async () => {
    const error = await failureOf(readSkillZip(await slipZip()));
    expect(error).toMatchObject({
      code: "invalid_import",
      message: "The zip has a file path outside its folders. The app imports nothing from it.",
    });
  });

  it("refuses a file that is not a zip", async () => {
    const error = await failureOf(readSkillZip(new TextEncoder().encode("not a zip")));
    expect(error).toMatchObject({ code: "invalid_import", message: "The file is not a zip." });
  });
});

describe("writeSkillZip", () => {
  it("writes files that readSkillZip reads back", async () => {
    const zip = await writeSkillZip([
      { path: "a/SKILL.md", text: "---\nname: a\n---\n\nbody" },
      { path: "b/SKILL.md", text: "---\nname: b\n---\n\nbody" },
    ]);
    const folders = await readSkillZip(zip);
    expect(folders.map((found) => found.folder)).toEqual(["a", "b"]);
  });
});
