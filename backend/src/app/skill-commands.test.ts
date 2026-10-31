import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { tempDir, testBackend } from "../../test/helpers.ts";
import { OWNER_ID } from "../core/owner.ts";
import { exportSkills, importSkills, listTrash, restoreSkill } from "./skill-commands.ts";

// The `skills` CLI commands (api.md §2) on a temporary database and folder.

let backend: ReturnType<typeof testBackend>;
let dir: ReturnType<typeof tempDir>;
let lines: string[];
const out = (line: string) => lines.push(line);
beforeEach(() => {
  backend = testBackend();
  dir = tempDir("skills-cli");
  lines = [];
});
afterEach(() => {
  backend.close();
  dir.remove();
});

function writeSkill(root: string, folder: string, name = folder, body = "## Steps\n\n1. Do it.") {
  mkdirSync(join(root, folder), { recursive: true });
  writeFileSync(
    join(root, folder, "SKILL.md"),
    `---\nname: ${name}\ndescription: Use it.\n---\n\n${body}`,
  );
}

describe("skills import", () => {
  it("previews without --apply and writes nothing", async () => {
    writeSkill(dir.path, "notes");
    expect(await importSkills(backend, dir.path, false, out)).toBe(0);
    expect(lines.at(-1)).toBe("Nothing written. Run again with --apply to import 1 skill.");
    expect(await backend.readers.skills.bySlug("notes")).toBeNull();
  });

  it("imports with --apply; a second run changes nothing", async () => {
    writeSkill(dir.path, "notes");
    writeFileSync(join(dir.path, "notes", "run.sh"), "echo hi");
    expect(await importSkills(backend, dir.path, true, out)).toBe(0);
    expect(lines).toEqual([
      "new       notes                        v1  (skipped: run.sh)",
      "Imported: 1 new skill, 0 new versions.",
    ]);
    lines = [];
    const events = (await backend.readers.events.after(0, 1000)).length;
    expect(await importSkills(backend, dir.path, true, out)).toBe(0);
    expect(lines.at(-1)).toBe("Nothing to import.");
    expect((await backend.readers.events.after(0, 1000)).length).toBe(events);
  });

  it("lists a linked SKILL.md as skipped and never follows it", async () => {
    const outside = join(dir.path, "..", `outside-${String(process.pid)}.md`);
    writeFileSync(outside, "---\nname: linked\ndescription: Use it.\n---\n\nbody");
    mkdirSync(join(dir.path, "linked"));
    symlinkSync(outside, join(dir.path, "linked", "SKILL.md"));
    try {
      expect(await importSkills(backend, dir.path, false, out)).toBe(1);
      expect(lines[0]).toBe(
        "invalid   linked                       The folder has no SKILL.md.  (skipped: SKILL.md)",
      );
    } finally {
      rmSync(outside);
    }
  });

  it("marks a SKILL.md over 1 MB as invalid without reading it", async () => {
    mkdirSync(join(dir.path, "big"));
    writeFileSync(join(dir.path, "big", "SKILL.md"), "x".repeat(1024 * 1024 + 1));
    expect(await importSkills(backend, dir.path, false, out)).toBe(1);
    expect(lines[0]).toBe("invalid   big                          SKILL.md is larger than 1 MB.");
  });

  it("exits 1 when a row is invalid or a conflict, and still imports the good rows", async () => {
    writeSkill(dir.path, "notes");
    writeSkill(dir.path, "import");
    writeSkill(dir.path, "leak", "leak", "password: hunter22");
    expect(await importSkills(backend, dir.path, true, out)).toBe(1);
    expect(lines.filter((line) => line.startsWith("invalid"))).toHaveLength(2);
    expect(await backend.readers.skills.bySlug("notes")).not.toBeNull();
  });
});

describe("skills export", () => {
  it("writes <slug>/SKILL.md for the named skills", async () => {
    await backend.skills.create(
      { slug: "notes", name: "Notes", description: "Use it.", bodyMd: "## Steps" },
      OWNER_ID,
    );
    const target = join(dir.path, "out");
    expect(await exportSkills(backend, target, ["notes"], out)).toBe(0);
    expect(readFileSync(join(target, "notes", "SKILL.md"), "utf8")).toBe(
      "---\nname: notes\ndescription: Use it.\n---\n\n## Steps",
    );
  });

  it("refuses a folder that is not empty, and an unknown slug", async () => {
    writeFileSync(join(dir.path, "keep.txt"), "mine");
    expect(await exportSkills(backend, dir.path, [], out)).toBe(1);
    expect(lines).toEqual([`${dir.path} is not empty. Choose an empty or new folder.`]);
    expect(await exportSkills(backend, join(dir.path, "new"), ["nope"], out)).toBe(1);
  });
});

describe("skills trash and restore (until M5b)", () => {
  it("lists a skill in Trash and restores it, still deprecated", async () => {
    const skill = await backend.skills.create(
      { slug: "notes", name: "Notes", description: "Use it.", bodyMd: "## Steps" },
      OWNER_ID,
    );
    await backend.skills.deprecate(skill.id, { removeBotIds: [], rowVersion: 1 }, OWNER_ID);
    await backend.skills.trash(skill.id, { rowVersion: 2 }, OWNER_ID);
    await listTrash(backend, out);
    expect(lines[0]).toMatch(/^notes {2}Notes {2}\(in Trash since /);
    expect(await restoreSkill(backend, "notes", out)).toBe(0);
    expect((await backend.skills.get(skill.id, OWNER_ID)).deprecated).toBe(true);
    expect(await restoreSkill(backend, "notes", out)).toBe(1);
  });
});
