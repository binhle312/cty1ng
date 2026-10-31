import { SkillVersionId } from "@cty1ng/shared/ids";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { manualClock, newTestId, testBackend } from "../../../test/helpers.ts";
import { DomainError } from "../errors.ts";
import { OWNER_ID } from "../owner.ts";

// The skill service on a temporary database (testing.md §3, domain-model.md §3, §12).

const SECRET = "key sk-proj-abcdefghijklmnop1234";
const DAY = 86_400_000;
const input = (slug: string, more: Partial<Record<string, string>> = {}) => ({
  slug,
  name: more.name ?? `Skill ${slug}`,
  description: more.description ?? "Use it when you write notes.",
  bodyMd: more.bodyMd ?? "## Steps\n\n1. Write.",
});

let clock: ReturnType<typeof manualClock>;
let backend: ReturnType<typeof testBackend>;
beforeEach(() => {
  clock = manualClock();
  backend = testBackend({}, { clock });
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

async function eventTypes(): Promise<string[]> {
  return (await backend.readers.events.after(0, 1000)).map((event) => event.type);
}

describe("create and versions", () => {
  it("creates a skill with v1 and a skill.created event", async () => {
    const skill = await backend.skills.create(input("notes"), OWNER_ID);
    expect(skill).toMatchObject({ slug: "notes", row_version: 1, is_author: true });
    expect(skill.latest_version.version).toBe(1);
    expect(await eventTypes()).toEqual(["skill.created"]);
  });

  it("refuses a taken slug with 409 slug_taken", async () => {
    await backend.skills.create(input("notes"), OWNER_ID);
    const error = await failure(backend.skills.create(input("notes"), OWNER_ID));
    expect(error).toMatchObject({ code: "slug_taken", field: "slug" });
  });

  it.each(["new", "import", "Notes", "a--b", "-a", "a".repeat(65)])(
    "refuses the reserved or malformed slug %j",
    async (slug) => {
      const error = await failure(backend.skills.create(input(slug), OWNER_ID));
      expect(error).toMatchObject({ code: "validation_error", field: "slug" });
      expect(await backend.readers.skills.list({ includeDeprecated: true })).toEqual([]);
    },
  );

  it("saves version N+1 and moves the latest version", async () => {
    const skill = await backend.skills.create(input("notes"), OWNER_ID);
    const saved = await backend.skills.addVersion(
      skill.id,
      { baseVersion: 1, description: "New.", bodyMd: "## Steps\n\n2.", upgradeBotIds: [] },
      OWNER_ID,
    );
    expect(saved.latest_version).toMatchObject({ version: 2, description: "New." });
    expect((await backend.skills.versions(skill.id)).map((v) => v.version)).toEqual([2, 1]);
  });

  it("a rename creates no version and raises row_version", async () => {
    const skill = await backend.skills.create(input("notes"), OWNER_ID);
    const renamed = await backend.skills.rename(
      skill.id,
      { name: "Meeting notes", rowVersion: 1 },
      OWNER_ID,
    );
    expect(renamed).toMatchObject({ name: "Meeting notes", row_version: 2 });
    expect(renamed.latest_version.version).toBe(1);
  });

  it("a rename with new text is one transaction: a bad body keeps the old name", async () => {
    const skill = await backend.skills.create(input("notes"), OWNER_ID);
    const error = await failure(
      backend.skills.addVersion(
        skill.id,
        {
          baseVersion: 1,
          description: "New.",
          bodyMd: "",
          upgradeBotIds: [],
          rename: { name: "Renamed", rowVersion: 1 },
        },
        OWNER_ID,
      ),
    );
    expect(error.code).toBe("validation_error");
    expect(await backend.skills.get(skill.id, OWNER_ID)).toMatchObject({
      name: "Skill notes",
      row_version: 1,
    });

    const saved = await backend.skills.addVersion(
      skill.id,
      {
        baseVersion: 1,
        description: "New.",
        bodyMd: "## Steps",
        upgradeBotIds: [],
        rename: { name: "Renamed", rowVersion: 1 },
      },
      OWNER_ID,
    );
    expect(saved).toMatchObject({ name: "Renamed", row_version: 2 });
    expect(saved.latest_version.version).toBe(2);
  });

  it("restore of v2 when the latest is v5 creates v6 with v2's text", async () => {
    const skill = await backend.skills.create(input("notes"), OWNER_ID);
    for (let base = 1; base <= 4; base += 1) {
      await backend.skills.addVersion(
        skill.id,
        {
          baseVersion: base,
          description: `d${String(base + 1)}`,
          bodyMd: `body ${String(base + 1)}`,
          upgradeBotIds: [],
        },
        OWNER_ID,
      );
    }
    const restored = await backend.skills.restoreVersion(skill.id, 2, undefined, OWNER_ID);
    expect(restored.latest_version).toMatchObject({
      version: 6,
      description: "d2",
      changelog: "Restored v2",
    });
    expect((await backend.skills.version(skill.id, 6)).body_md).toBe("body 2");
  });

  it("diff lists added and removed lines, and null for an equal description", async () => {
    const skill = await backend.skills.create(input("notes", { bodyMd: "a\nb" }), OWNER_ID);
    await backend.skills.addVersion(
      skill.id,
      {
        baseVersion: 1,
        description: "Use it when you write notes.",
        bodyMd: "a\nc",
        upgradeBotIds: [],
      },
      OWNER_ID,
    );
    const diff = await backend.skills.diff(skill.id, 1, 2);
    expect(diff.description).toBeNull();
    expect(diff.body).toEqual([
      { op: "same", text: "a" },
      { op: "del", text: "b" },
      { op: "add", text: "c" },
    ]);
  });
});

describe("limits come from the settings", () => {
  it("a lowered skill_name_max refuses a name that fitted before", async () => {
    await backend.settings.update({ skill_name_max: 16 });
    const error = await failure(
      backend.skills.create(input("notes", { name: "A name with 17 ch" }), OWNER_ID),
    );
    expect(error).toMatchObject({ code: "validation_error", field: "name" });
    await backend.skills.create(input("notes", { name: "A name with 16 c" }), OWNER_ID);
  });

  // Review of PR #52: a Save without a rename checked no name, so it passed over a lowered limit.
  it("a lowered skill_name_max refuses a Save of a skill whose saved name is now too long", async () => {
    const skill = await backend.skills.create(
      input("notes", { name: "A name of thirty-four characters!" }),
      OWNER_ID,
    );
    await backend.settings.update({ skill_name_max: 16 });
    const save = (rename?: { name: string; rowVersion: number }) =>
      backend.skills.addVersion(
        skill.id,
        { baseVersion: 1, description: "d", bodyMd: "b", upgradeBotIds: [], rename },
        OWNER_ID,
      );
    expect(await failure(save())).toMatchObject({ code: "validation_error", field: "name" });
    expect(
      await failure(backend.skills.restoreVersion(skill.id, 1, undefined, OWNER_ID)),
    ).toMatchObject({
      field: "name",
    });
    const saved = await save({ name: "Short name", rowVersion: 1 });
    expect(saved.latest_version.version).toBe(2);
  });

  it("a lowered skill_body_max refuses a longer body", async () => {
    await backend.settings.update({ skill_body_max: 1_000 });
    const error = await failure(
      backend.skills.create(input("notes", { bodyMd: "x".repeat(1_001) }), OWNER_ID),
    );
    expect(error).toMatchObject({ code: "validation_error", field: "body_md" });
  });
});

describe("the sensitive data guard on every write path (D39, no override)", () => {
  it("create", async () => {
    const error = await failure(
      backend.skills.create(input("notes", { bodyMd: SECRET }), OWNER_ID),
    );
    expect(error).toMatchObject({ code: "sensitive_data", field: "body_md" });
  });

  it("Clone", async () => {
    const source = await backend.skills.create(input("notes"), OWNER_ID);
    const [v1] = await backend.skills.versions(source.id);
    const error = await failure(
      backend.skills.create(
        {
          ...input("notes-copy", { description: `Use it. ${SECRET}` }),
          clonedFromSkillVersionId: v1?.id,
        },
        OWNER_ID,
      ),
    );
    expect(error).toMatchObject({ code: "sensitive_data", field: "description" });
  });

  it("rename", async () => {
    const skill = await backend.skills.create(input("notes"), OWNER_ID);
    const error = await failure(
      backend.skills.rename(skill.id, { name: "password: hunter22", rowVersion: 1 }, OWNER_ID),
    );
    expect(error).toMatchObject({ code: "sensitive_data", field: "name" });
  });

  it("new version", async () => {
    const skill = await backend.skills.create(input("notes"), OWNER_ID);
    const error = await failure(
      backend.skills.addVersion(
        skill.id,
        { baseVersion: 1, description: "Use it.", bodyMd: SECRET, upgradeBotIds: [] },
        OWNER_ID,
      ),
    );
    expect(error.code).toBe("sensitive_data");
  });

  // Review of PR #52: the changelog and the slug are saved and shown, so the guard reads them.
  it("a changelog of a new version or a version restore", async () => {
    const skill = await backend.skills.create(input("notes"), OWNER_ID);
    const error = await failure(
      backend.skills.addVersion(
        skill.id,
        {
          baseVersion: 1,
          description: "Use it.",
          bodyMd: "## Steps",
          changelog: "password: hunter22",
          upgradeBotIds: [],
        },
        OWNER_ID,
      ),
    );
    expect(error).toMatchObject({ code: "sensitive_data", field: "changelog" });
    expect(
      await failure(backend.skills.restoreVersion(skill.id, 1, "password: hunter22", OWNER_ID)),
    ).toMatchObject({ code: "sensitive_data", field: "changelog" });
    expect(await backend.skills.versions(skill.id)).toHaveLength(1);
  });

  it("a slug", async () => {
    const error = await failure(
      backend.skills.create(input("sk-proj-abcdefghijklmnop1234"), OWNER_ID),
    );
    expect(error).toMatchObject({ code: "sensitive_data", field: "slug" });
  });

  it("restore of an old version that holds a secret", async () => {
    const skill = await backend.skills.create(input("notes"), OWNER_ID);
    // A version saved before a guard rule existed.
    await backend.uow.run((tx) =>
      tx.skills.insertVersion({
        id: SkillVersionId.parse(newTestId("skillv")),
        skillId: skill.id,
        version: 2,
        description: "Use it.",
        bodyMd: SECRET,
        changelog: null,
        createdBy: OWNER_ID,
        createdAt: clock.now(),
      }),
    );
    await backend.skills.restoreVersion(skill.id, 1, undefined, OWNER_ID);
    const error = await failure(backend.skills.restoreVersion(skill.id, 2, undefined, OWNER_ID));
    expect(error.code).toBe("sensitive_data");
  });
});

describe("Clone", () => {
  it("records the source version and starts at v1", async () => {
    const source = await backend.skills.create(input("notes"), OWNER_ID);
    await backend.skills.addVersion(
      source.id,
      { baseVersion: 1, description: "v2.", bodyMd: "## v2", upgradeBotIds: [] },
      OWNER_ID,
    );
    const v2 = await backend.skills.version(source.id, 2);
    const clone = await backend.skills.create(
      { ...input("notes-copy"), clonedFromSkillVersionId: v2.id },
      "someone-else",
    );
    expect(clone.latest_version.version).toBe(1);
    expect(clone.cloned_from).toEqual({ skill_id: source.id, slug: "notes", version: 2 });
    expect(clone.author_id).toBe("someone-else");
  });
});

describe("authorship (invariant 05)", () => {
  it("invariant 05: only the author can create versions, deprecate, delete or restore a skill", async () => {
    const skill = await backend.skills.create(input("notes"), "someone-else");
    const notAuthor = { code: "not_author" };
    expect(
      await failure(
        backend.skills.addVersion(
          skill.id,
          { baseVersion: 1, description: "x", bodyMd: "x", upgradeBotIds: [] },
          OWNER_ID,
        ),
      ),
    ).toMatchObject(notAuthor);
    expect(
      await failure(backend.skills.rename(skill.id, { name: "X", rowVersion: 1 }, OWNER_ID)),
    ).toMatchObject(notAuthor);
    expect(
      await failure(backend.skills.restoreVersion(skill.id, 1, undefined, OWNER_ID)),
    ).toMatchObject(notAuthor);
    expect(
      await failure(
        backend.skills.deprecate(skill.id, { removeBotIds: [], rowVersion: 1 }, OWNER_ID),
      ),
    ).toMatchObject(notAuthor);

    await backend.skills.deprecate(skill.id, { removeBotIds: [], rowVersion: 1 }, "someone-else");
    expect(
      await failure(backend.skills.undeprecate(skill.id, { rowVersion: 2 }, OWNER_ID)),
    ).toMatchObject(notAuthor);
    expect(
      await failure(backend.skills.trash(skill.id, { rowVersion: 2 }, OWNER_ID)),
    ).toMatchObject(notAuthor);
    await backend.skills.trash(skill.id, { rowVersion: 2 }, "someone-else");
    expect(await failure(backend.skills.restore(skill.id, OWNER_ID))).toMatchObject(notAuthor);
    expect(await failure(backend.skills.purge(skill.id, OWNER_ID))).toMatchObject(notAuthor);
  });
});

describe("Deprecate, Trash, restore, purge (D49)", () => {
  async function deprecated(slug: string) {
    const skill = await backend.skills.create(input(slug), OWNER_ID);
    return backend.skills.deprecate(skill.id, { removeBotIds: [], rowVersion: 1 }, OWNER_ID);
  }

  it("a deprecated skill is read-only and hidden from the default list", async () => {
    const skill = await deprecated("notes");
    expect(skill.deprecated).toBe(true);
    expect(
      await failure(
        backend.skills.addVersion(
          skill.id,
          { baseVersion: 1, description: "x", bodyMd: "x", upgradeBotIds: [] },
          OWNER_ID,
        ),
      ),
    ).toMatchObject({ code: "skill_deprecated" });
    expect(await backend.skills.list({ includeDeprecated: false }, OWNER_ID)).toEqual([]);
    expect(await backend.skills.list({ includeDeprecated: true }, OWNER_ID)).toHaveLength(1);
    // The page of a deprecated skill still opens (a reload with Show deprecated off).
    expect((await backend.skills.get(skill.id, OWNER_ID)).deprecated).toBe(true);
  });

  it("invariant 19: only a deprecated skill can be deleted; an active one gets not_deprecated", async () => {
    const skill = await backend.skills.create(input("notes"), OWNER_ID);
    expect(
      await failure(backend.skills.trash(skill.id, { rowVersion: 1 }, OWNER_ID)),
    ).toMatchObject({ code: "not_deprecated" });
    // The database refuses it too (the CHECK of the M1 plan, decision 5).
    await expect(
      backend.uow.run((tx) => tx.skills.updateSkill(skill.id, { trashedAt: clock.now() })),
    ).rejects.toThrow(/CHECK constraint failed/);
  });

  it("Trash hides the skill, keeps its slug, and emits skill.trashed and trash.changed", async () => {
    const skill = await deprecated("notes");
    const result = await backend.skills.trash(skill.id, { rowVersion: 2 }, OWNER_ID);
    expect(result).toEqual({ skill_id: skill.id, removed_bot_ids: [] });
    expect(await failure(backend.skills.get(skill.id, OWNER_ID))).toMatchObject({
      code: "not_found",
    });
    expect(await failure(backend.skills.create(input("notes"), OWNER_ID))).toMatchObject({
      code: "slug_taken",
    });
    const events = await backend.readers.events.after(0, 1000);
    expect(events.slice(-2).map((event) => [event.type, event.payload])).toEqual([
      ["skill.trashed", { skill_id: skill.id }],
      ["trash.changed", { counts: { skill: 1 } }],
    ]);
  });

  it("restore brings it back still deprecated and suggests no bot", async () => {
    const skill = await deprecated("notes");
    await backend.skills.trash(skill.id, { rowVersion: 2 }, OWNER_ID);
    const restored = await backend.skills.restore(skill.id, OWNER_ID);
    expect(restored.suggested_bot_ids).toEqual([]);
    expect(restored.skill.deprecated).toBe(true);
    expect((await eventTypes()).slice(-2)).toEqual(["skill.restored", "trash.changed"]);
  });

  it("invariant 20: a purge frees the slug; a new skill with the same slug is a new skill", async () => {
    const old = await deprecated("notes");
    await backend.skills.trash(old.id, { rowVersion: 2 }, OWNER_ID);
    await backend.skills.purge(old.id, OWNER_ID);
    expect(await backend.readers.skills.byId(old.id)).toBeNull();
    expect(await backend.readers.skills.versions(old.id)).toEqual([]);
    const again = await backend.skills.create(input("notes"), OWNER_ID);
    expect(again.id).not.toBe(old.id);
    expect(again.latest_version.version).toBe(1);
  });

  it("purging a source skill keeps its clone and clears the link", async () => {
    const source = await backend.skills.create(input("notes"), OWNER_ID);
    const [v1] = await backend.skills.versions(source.id);
    const clone = await backend.skills.create(
      { ...input("notes-copy"), clonedFromSkillVersionId: v1?.id },
      OWNER_ID,
    );
    await backend.skills.deprecate(source.id, { removeBotIds: [], rowVersion: 1 }, OWNER_ID);
    await backend.skills.trash(source.id, { rowVersion: 2 }, OWNER_ID);
    await backend.skills.purge(source.id, OWNER_ID);

    const kept = await backend.skills.get(clone.id, OWNER_ID);
    expect(kept.cloned_from).toBeNull();
    expect(kept.row_version).toBe(clone.row_version + 1);
    expect(kept.body_md).toBe("## Steps\n\n1. Write.");
    const events = await backend.readers.events.after(0, 1000);
    expect(events.slice(-3).map((event) => event.type)).toEqual([
      "skill.purged",
      "skill.updated",
      "trash.changed",
    ]);
  });

  it("the purge job deletes only skills in Trash for trash_days or longer", async () => {
    await backend.settings.update({ trash_days: 2 });
    const early = await deprecated("early");
    await backend.skills.trash(early.id, { rowVersion: 2 }, OWNER_ID);
    clock.advance(DAY);
    const late = await deprecated("late");
    await backend.skills.trash(late.id, { rowVersion: 2 }, OWNER_ID);

    clock.advance(DAY - 1);
    expect(await backend.skills.purgeDue(OWNER_ID)).toBe(0);
    clock.advance(1);
    expect(await backend.skills.purgeDue(OWNER_ID)).toBe(1);
    expect(await backend.readers.skills.byId(early.id)).toBeNull();
    expect(await backend.readers.skills.byId(late.id)).not.toBeNull();
  });

  // Review of PR #52: the job read trash_days once, so a raise that committed while it ran
  // still let it delete a skill that was no longer due.
  it("the purge job rechecks trash_days in each transaction", async () => {
    const skill = await deprecated("notes");
    await backend.skills.trash(skill.id, { rowVersion: 2 }, OWNER_ID);
    clock.advance(31 * DAY);
    const job = backend.skills.purgeDue(OWNER_ID);
    await backend.settings.update({ trash_days: 90 });
    expect(await job).toBe(0);
    expect(await backend.readers.skills.byId(skill.id)).not.toBeNull();
  });
});

describe("invariants 02 and 25", () => {
  it("invariant 02: skill_versions rows never change; only the purge deletes them", async () => {
    const skill = await backend.skills.create(input("notes"), OWNER_ID);
    const before = await backend.readers.skills.version(skill.id, 1);
    await backend.skills.rename(skill.id, { name: "Renamed", rowVersion: 1 }, OWNER_ID);
    await backend.skills.addVersion(
      skill.id,
      { baseVersion: 1, description: "v2", bodyMd: "v2", upgradeBotIds: [] },
      OWNER_ID,
    );
    const restored = await backend.skills.restoreVersion(skill.id, 1, "back", OWNER_ID);
    const old = await backend.skills.deprecate(
      skill.id,
      { removeBotIds: [], rowVersion: restored.row_version },
      OWNER_ID,
    );
    await backend.skills.trash(skill.id, { rowVersion: old.row_version }, OWNER_ID);
    await backend.skills.restore(skill.id, OWNER_ID);
    expect(await backend.readers.skills.version(skill.id, 1)).toEqual(before);
    // The repository port has no way to update a version.
    await backend.uow.run((tx) => {
      expect(Object.keys(tx.skills).filter((name) => /version/i.test(name))).toEqual([
        "latestVersion",
        "version",
        "versionById",
        "versions",
        "insertVersion",
      ]);
      return Promise.resolve();
    });
  });

  it("invariant 25: a skill and its v1 commit together or not at all", async () => {
    await expect(
      backend.uow.run(async (tx) => {
        await backend.skills.createInTx(tx, input("notes"), OWNER_ID);
        throw new Error("fails after the insert");
      }),
    ).rejects.toThrow("fails after the insert");
    expect(await backend.readers.skills.bySlug("notes")).toBeNull();

    const skill = await backend.skills.create(input("notes"), OWNER_ID);
    expect(await backend.readers.skills.latestVersion(skill.id)).not.toBeNull();
  });
});

describe("races (architecture.md §11)", () => {
  it("two saves of the same base version: one wins, the other gets stale_write", async () => {
    const skill = await backend.skills.create(input("notes"), OWNER_ID);
    const save = (body: string) =>
      backend.skills.addVersion(
        skill.id,
        { baseVersion: 1, description: "d", bodyMd: body, upgradeBotIds: [] },
        OWNER_ID,
      );
    const results = await Promise.allSettled([save("a"), save("b")]);
    expect(results.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.reason).toMatchObject({ code: "stale_write" });
    expect((await backend.skills.versions(skill.id)).map((v) => v.version)).toEqual([2, 1]);
  });

  it("two renames with the same row_version: one wins, the other gets stale_write", async () => {
    const skill = await backend.skills.create(input("notes"), OWNER_ID);
    const results = await Promise.allSettled([
      backend.skills.rename(skill.id, { name: "First", rowVersion: 1 }, OWNER_ID),
      backend.skills.rename(skill.id, { name: "Second", rowVersion: 1 }, OWNER_ID),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.reason).toMatchObject({ code: "stale_write" });
  });
});

describe("export", () => {
  it("writes the latest version of each active skill as <slug>/SKILL.md", async () => {
    await backend.skills.create(input("notes"), OWNER_ID);
    const old = await backend.skills.create(input("old"), OWNER_ID);
    await backend.skills.deprecate(old.id, { removeBotIds: [], rowVersion: 1 }, OWNER_ID);
    const { fileName, files } = await backend.skills.exportFiles(null);
    expect(fileName).toBe("1-skills-20261031T090000Z.zip");
    expect(files).toEqual([
      {
        path: "notes/SKILL.md",
        text: "---\nname: notes\ndescription: Use it when you write notes.\n---\n\n## Steps\n\n1. Write.",
      },
    ]);
  });
});
