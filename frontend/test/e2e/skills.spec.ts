import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { z } from "zod";
import { watchCsp } from "./csp.ts";
import { readZip } from "./zip.ts";

// The Skills page (M1 brief, skills-page.md, UI-7.1–UI-7.8). The servers keep one database
// while `pnpm e2e:serve` runs, so each test makes skills with its own slug. One test changes a
// global setting, so the tests of this file run one after another.
test.describe.configure({ mode: "serial" });

// A made-up key that the app's guard (D39) must refuse. It is put together at run time, so the
// source has no key-shaped text for secret scanners to report.
const FAKE_API_KEY = ["sk", "proj", "abcdefghijklmnop1234"].join("-");

let run = 0;
function unique(name: string): { name: string; slug: string } {
  run += 1;
  const tag = `${Date.now().toString(36)}${String(run)}`;
  return { name: `${name} ${tag}`, slug: `${name.toLowerCase().replace(/ /g, "-")}-${tag}` };
}

async function fill(page: Page, label: string, text: string) {
  await page.getByLabel(label, { exact: true }).fill(text);
}

// Creates a skill through the editor and waits for its page.
async function createSkill(
  page: Page,
  skill: { name: string; slug: string },
  body = "## Steps\n1. Read the brief.\n2. Write the stories.",
) {
  await page.goto("/skills/new");
  await fill(page, "Name", skill.name);
  await expect(page.getByLabel("Slug", { exact: true })).toHaveValue(skill.slug);
  await fill(page, "Description", "Use this skill when the owner asks for user stories.");
  await fill(page, "Body", body);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByText(`Created ${skill.name} ✨`)).toBeVisible();
  await expect(page).toHaveURL(`/skills/${skill.slug}`);
}

// A save of new body text, with an optional changelog line.
async function saveBody(page: Page, body: string, version: number, changelog?: string) {
  await page.getByRole("tab", { name: "Write" }).click();
  await fill(page, "Body", body);
  if (changelog !== undefined) await fill(page, "What changed", changelog);
  await page.getByRole("button", { name: `Save as v${String(version)}` }).click();
  await expect(page.getByText(`Saved v${String(version)} ✨`)).toBeVisible();
}

// The page top's title: the first level-2 heading in the main area (a Markdown preview can hold
// more).
// A line of a diff: `del` is struck through, `add` is new (skills-page.md §13).
const diffLine = (area: Locator, op: "add" | "del", text: string) =>
  area.locator(`[data-op="${op}"]`, { hasText: text });

const pageTitle = (page: Page) => page.getByRole("main").getByRole("heading", { level: 2 }).first();

test("create, edit, diff, restore and export a skill (M1 brief Playwright journey)", async ({
  page,
}) => {
  const violations = await watchCsp(page);
  const skill = unique("Write stories");
  await createSkill(page, skill);
  await expect(pageTitle(page)).toHaveText(skill.name);
  await expect(page.getByRole("link", { name: new RegExp(skill.name) })).toHaveAttribute(
    "aria-current",
    "page",
  );

  // Edit → v2, with a changelog line.
  await saveBody(
    page,
    "## Steps\n1. Read the brief.\n2. Write one story per goal.",
    2,
    "One story per goal",
  );

  // History: the diff from v1 to v2.
  await page.getByRole("tab", { name: /History/ }).click();
  await expect(page.getByRole("button", { name: /One story per goal/ })).toBeVisible();
  const body = page.getByLabel("Body changes");
  await expect(diffLine(body, "del", "2. Write the stories.")).toHaveClass(/line-through/);
  await expect(diffLine(body, "add", "2. Write one story per goal.")).toBeVisible();

  // Restore v1 → v3 with v1's text.
  await page.getByRole("button", { name: "Restore v1" }).click();
  await expect(page.getByText("Saved v3 ✨")).toBeVisible();
  await expect(page.getByRole("button", { name: /Restored v1/ })).toBeVisible();

  // Export from the ⋯ menu: the zip holds v3, the text of v1.
  await page.getByRole("button", { name: "Skill actions" }).click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Export" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^1-skills-\d{8}T\d{6}Z\.zip$/);
  const files = readZip(await readFile(await download.path()));
  const text = files.get(`${skill.slug}/SKILL.md`);
  expect(text).toContain("2. Write the stories.");
  expect(text).not.toContain("one story per goal");
  await expect(page.getByText(/^Exported 1 skill to 1-skills-/)).toBeVisible();
  expect(await violations()).toEqual([]);
});

test("a reload keeps the skill, the tab and the Compare pair", async ({ page }) => {
  const skill = unique("Compare me");
  await createSkill(page, skill, "one");
  await saveBody(page, "two", 2);
  await saveBody(page, "three", 3);
  await page.getByRole("tab", { name: /History/ }).click();
  await page.getByRole("button", { name: "Compare" }).click();
  await page.getByRole("checkbox", { name: /v1/ }).click();
  await page.getByRole("checkbox", { name: /v3/ }).click();
  await expect(page).toHaveURL(`/skills/${skill.slug}?tab=history&from=1&to=3`);
  await page.reload();
  await expect(pageTitle(page)).toHaveText(skill.name);
  await expect(page.getByRole("tab", { name: /History/ })).toHaveAttribute("aria-selected", "true");
  await expect(diffLine(page.getByLabel("Body changes"), "del", "one")).toBeVisible();
  await expect(diffLine(page.getByLabel("Body changes"), "add", "three")).toBeVisible();
});

test("a rename only saves without a new version", async ({ page }) => {
  const skill = unique("Rename me");
  await createSkill(page, skill);
  await fill(page, "Name", `${skill.name} 2`);
  await expect(page.getByText("1 change not saved")).toBeVisible();
  await expect(page.getByLabel("What changed")).toBeHidden();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved ✨")).toBeVisible();
  await expect(pageTitle(page)).toHaveText(`${skill.name} 2`);
  await expect(page.getByRole("tab", { name: /History/ })).toHaveText(/History\s*1/);
});

test("Clone saves nothing until Create, then makes v1 of the copy", async ({ page }) => {
  const skill = unique("Clone me");
  await createSkill(page, skill);
  await page.getByRole("button", { name: "Skill actions" }).click();
  await page.getByRole("menuitem", { name: "Clone" }).click();
  await expect(page).toHaveURL(/\/skills\/new\?from=skillv_/);
  await expect(pageTitle(page)).toHaveText(`New skill · copy of ${skill.name} v1`);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(`${skill.name} (copy)`);
  await expect(page.getByLabel("Slug", { exact: true })).toHaveValue(`${skill.slug}-copy`);

  // A reload of the Clone URL opens the same copy; Cancel saves nothing.
  await page.reload();
  await expect(page.getByLabel("Slug", { exact: true })).toHaveValue(`${skill.slug}-copy`);
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(
    page.getByRole("link", { name: new RegExp(`${skill.name} \\(copy\\)`) }),
  ).toHaveCount(0);

  await page.goto(`/skills/${skill.slug}`);
  await page.getByRole("button", { name: "Skill actions" }).click();
  await page.getByRole("menuitem", { name: "Clone" }).click();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(`/skills/${skill.slug}-copy`);
  await expect(page.getByRole("tab", { name: /History/ })).toHaveText(/History\s*1/);
});

test("a taken slug, a reserved slug and a likely secret show their errors", async ({ page }) => {
  const skill = unique("Taken");
  await createSkill(page, skill);
  await page.goto("/skills/new");
  await fill(page, "Name", "Other");
  await fill(page, "Slug", "new");
  await expect(page.getByText("This slug is reserved. Type a different one.")).toBeVisible();
  await fill(page, "Slug", skill.slug);
  await fill(page, "Description", "Use it.");
  await fill(page, "Body", "Steps");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByText("This slug exists. Type a different one.")).toBeVisible();

  await fill(page, "Slug", `${skill.slug}-x`);
  await fill(page, "Body", `Steps\nUse the key ${FAKE_API_KEY}`);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(
    page.getByText(
      /Line 2 looks like an API key\. The app does not save secrets in skills\. Remove it\./,
    ),
  ).toBeVisible();
});

test("the editor and the server use the skill_name_max setting", async ({ page }) => {
  const skill = unique("Limit");
  await createSkill(page, skill);
  const patch = (body: object) =>
    page.evaluate(async (json) => {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: json,
      });
      return response.status;
    }, JSON.stringify(body));
  expect(await patch({ skill_name_max: 16 })).toBe(200);
  try {
    await page.reload();
    await fill(page, "Name", "A name of twenty chars");
    await expect(page.getByText("22 / 16")).toBeVisible();
    await expect(
      page.getByText("The name has 22 characters. The limit is 16. Make it shorter."),
    ).toBeVisible();
    // The server refuses the same name. Only the GET runs from the test: a PATCH must pass the
    // origin check, so it runs in the page.
    const list = z
      .array(z.object({ id: z.string(), slug: z.string(), row_version: z.number() }))
      .parse(await (await page.request.get("/api/skills?include_deprecated=true")).json());
    const found = list.find((item) => item.slug === skill.slug);
    expect(found).toBeDefined();
    const status = await page.evaluate(
      async ({ id, rowVersion }) => {
        const response = await fetch(`/api/skills/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "A name of twenty chars", row_version: rowVersion }),
        });
        return response.status;
      },
      { id: found?.id ?? "", rowVersion: found?.row_version ?? 0 },
    );
    expect(status).toBe(422);
  } finally {
    expect(await patch({ skill_name_max: 64 })).toBe(200);
  }
});

test("leaving with unsaved changes asks first", async ({ page }) => {
  const skill = unique("Leave");
  await createSkill(page, skill);
  await page.getByRole("tab", { name: "Write" }).click();
  await fill(page, "Description", "Changed.");
  await expect(
    page.getByRole("link", { name: new RegExp(skill.name) }).getByLabel("Unsaved changes"),
  ).toBeVisible();
  await page.getByRole("link", { name: "Create", exact: true }).click();
  const dialog = page.getByRole("alertdialog", { name: "Leave without saving? 👀" });
  await expect(dialog).toContainText(`You changed the description of ${skill.name}.`);
  await expect(dialog.getByRole("button", { name: "Stay on this skill" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(`/skills/${skill.slug}`);
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await dialog.getByRole("button", { name: "Let them go" }).click();
  await expect(page).toHaveURL("/skills/new");
});

test("deprecate, open after a reload, make active, deprecate and delete", async ({ page }) => {
  const skill = unique("Retire");
  await createSkill(page, skill);
  await page.getByRole("button", { name: "Skill actions" }).click();
  await page.getByRole("menuitem", { name: "Deprecate" }).click();
  const deprecate = page.getByRole("alertdialog", { name: `Time for ${skill.name} to rest? 🌙` });
  await expect(deprecate.getByRole("button", { name: "Cancel" })).toBeFocused();
  await deprecate.getByRole("button", { name: "Deprecate" }).click();
  await expect(
    page.getByText("Deprecated skills are read-only. Make it active again to edit it."),
  ).toBeVisible();
  // Read-only controls, not disabled ones: they still take focus for copying (owner, 2026-10-31).
  await expect(page.getByLabel("Name", { exact: true })).not.toBeEditable();
  await page.getByLabel("Name", { exact: true }).focus();
  await expect(page.getByLabel("Name", { exact: true })).toBeFocused();

  // With Show deprecated off, the list hides it, and its URL still opens after a reload.
  await page.reload();
  await expect(pageTitle(page)).toHaveText(skill.name);
  await expect(page.getByRole("navigation", { name: "Skills" }).getByText(skill.name)).toHaveCount(
    0,
  );
  await page.getByRole("checkbox", { name: "Show deprecated" }).click();
  await expect(
    page.getByRole("navigation", { name: "Skills" }).getByText(skill.name),
  ).toBeVisible();

  await page.getByRole("button", { name: "Make active again" }).click();
  await expect(page.getByRole("button", { name: "Make active again" })).toBeHidden();
  await expect(page.getByLabel("Name", { exact: true })).toBeEditable();

  await page.getByRole("button", { name: "Skill actions" }).click();
  await page.getByRole("menuitem", { name: "Deprecate" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Deprecate" }).click();
  await page.getByRole("button", { name: "Skill actions" }).click();
  await page.getByRole("menuitem", { name: "Delete skill" }).click();
  const remove = page.getByRole("alertdialog", { name: `Delete ${skill.name}? 🧹` });
  await expect(remove).toContainText("After 30 days, the app deletes it permanently.");
  await remove.getByRole("button", { name: "Delete skill" }).click();
  await expect(page.getByText(`${skill.name} is in Trash.`)).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Skills" }).getByText(skill.name)).toHaveCount(
    0,
  );
  await page.goto(`/skills/${skill.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
});

test("Delete lists the bots that use the skill and removes it from them (M2a)", async ({
  page,
}) => {
  const skill = unique("Deleted skill");
  const bot = unique("Losing bot");
  await createSkill(page, skill);
  const skillId = await createBotUsing(page, bot.name, skill.slug);
  await page.goto(`/skills/${skill.slug}`);
  await page.getByRole("button", { name: "Skill actions" }).click();
  await page.getByRole("menuitem", { name: "Deprecate" }).click();
  const deprecate = page.getByRole("alertdialog", { name: `Time for ${skill.name} to rest? 🌙` });
  await deprecate.getByRole("checkbox").click();
  await deprecate.getByRole("button", { name: "Deprecate", exact: true }).click();
  await expect(page.getByText("1 bot still uses it.")).toBeVisible();

  await page.getByRole("button", { name: "Skill actions" }).click();
  await page.getByRole("menuitem", { name: "Delete skill" }).click();
  const remove = page.getByRole("alertdialog", { name: `Delete ${skill.name}? 🧹` });
  await expect(remove).toContainText("These bots stop using it now:");
  await expect(remove.getByRole("list", { name: "Bots that use this skill" })).toContainText(
    bot.name,
  );
  await expect(remove.getByRole("checkbox")).toHaveCount(0);
  await remove.getByRole("button", { name: "Delete skill" }).click();
  await expect(page.getByText(`${skill.name} is in Trash.`)).toBeVisible();
  expect(await pinnedSkillIds(page, bot.name)).not.toContain(skillId);
});

test("import a zip: preview, then apply only the ticked rows", async ({ page }) => {
  const violations = await watchCsp(page);
  const skill = unique("Import me");
  await createSkill(page, skill);
  // Export v1, save v2, then import the v1 zip: it is a new version of the skill.
  await page.getByRole("button", { name: "Skill actions" }).click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Export" }).click();
  const zipPath = await (await downloading).path();
  await saveBody(page, "## Steps\n1. Something else.", 2);

  const choosing = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await (await choosing).setFiles(zipPath);
  await expect(page).toHaveURL("/skills/import");
  const changed = page.getByRole("region", { name: "New versions of your skills" });
  await expect(changed).toContainText(skill.slug);
  await expect(changed).toContainText("v2 → v3 · body changed");
  await changed.getByRole("button", { name: "Show changes" }).click();
  await expect(diffLine(changed, "del", "1. Something else.")).toBeVisible();
  await expect(page.getByText("1 of 1 picked. Rows with a problem are skipped.")).toBeVisible();

  await page.getByRole("button", { name: "Apply 1 change" }).click();
  await expect(page.getByText("Imported 1 change ✨ 0 new skills, 1 new version.")).toBeVisible();
  await page.goto(`/skills/${skill.slug}?tab=history`);
  await expect(page.getByRole("button", { name: /Imported from/ })).toBeVisible();
  expect(await violations()).toEqual([]);
});

test("the Export card ticks every active skill and names the count", async ({ page }) => {
  const skill = unique("Export card");
  await createSkill(page, skill);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const card = page.getByRole("dialog", { name: "Export skills 📦" });
  const selectAll = card.getByRole("checkbox", { name: "Select all" });
  await expect(selectAll).toBeChecked();
  await selectAll.click();
  await expect(card.getByRole("button", { name: "Export 0 skills" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await card.getByRole("checkbox", { name: new RegExp(skill.name) }).click();
  await expect(card.getByText(/^1 of \d+$/)).toBeVisible();
  const downloading = page.waitForEvent("download");
  await card.getByRole("button", { name: "Export 1 skill" }).click();
  const files = readZip(await readFile(await (await downloading).path()));
  expect([...files.keys()]).toEqual([`${skill.slug}/SKILL.md`]);
});

test("the Bots tab of a skill that no bot uses shows its empty line (UI-7.5a)", async ({
  page,
}) => {
  const skill = unique("Bots tab");
  await createSkill(page, skill);
  await page.getByRole("tab", { name: /Bots/ }).click();
  await expect(page).toHaveURL(`/skills/${skill.slug}?tab=bots`);
  await expect(page.getByText("No bot uses this skill yet.")).toBeVisible();
  // + Add is there. Whether it is on depends on the bots that other tests made: "Create a bot
  // first." with no bot at all is a component test (skill-bots-tab.test.tsx).
  await expect(page.getByRole("button", { name: "Add" })).toBeVisible();
});

// A bot made through the API with the skill pinned (api.md §4, `POST /bots`). The request runs
// in the page, because a state-changing request must pass the origin check.
async function createBotUsing(page: Page, name: string, skillSlug: string): Promise<string> {
  const list = z
    .array(z.object({ id: z.string(), slug: z.string() }))
    .parse(await (await page.request.get("/api/skills?include_deprecated=true")).json());
  const skillId = list.find((item) => item.slug === skillSlug)?.id;
  expect(skillId).toBeDefined();
  const result = await page.evaluate(
    async ({ botName, id }) => {
      const response = await fetch("/api/bots", {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          name: botName,
          description: "Writes stories.",
          persona_md: "You write user stories.",
          avatar_style: "flat",
          avatar_colour: "#336699",
          model_id: "fake:scripted",
          pins: [{ skill_id: id, always_load: false }],
        }),
      });
      return { status: response.status, text: await response.text() };
    },
    { botName: name, id: skillId ?? "" },
  );
  expect(result.status, result.text).toBe(201);
  return skillId ?? "";
}

// The pins of a bot, read from the API.
async function pinnedSkillIds(page: Page, botName: string): Promise<string[]> {
  const bots = z
    .array(z.object({ name: z.string(), pins: z.array(z.object({ skill_id: z.string() })) }))
    .parse(await (await page.request.get("/api/bots")).json());
  return bots.find((bot) => bot.name === botName)?.pins.map((pin) => pin.skill_id) ?? [];
}

test("a bot that uses a skill shows on its Bots tab; Deprecate with the bot ticked removes the pin (M2a)", async ({
  page,
}) => {
  const violations = await watchCsp(page);
  const skill = unique("Used skill");
  const bot = unique("Pinned bot");
  await createSkill(page, skill);
  const skillId = await createBotUsing(page, bot.name, skill.slug);
  await page.goto(`/skills/${skill.slug}?tab=bots`);

  // The row: the avatar's letter, the name, the model line, the version, and Always load.
  const row = page.getByRole("row", { name: new RegExp(bot.name) });
  await expect(row).toBeVisible();
  await expect(row).toContainText("v1");
  await expect(row).toContainText("latest");
  await expect(page.getByRole("tab", { name: /Bots/ })).toContainText("1");
  const always = row.getByRole("switch", { name: `Always load for ${bot.name}` });
  await expect(always).toHaveAttribute("aria-checked", "false");
  await always.click();
  await expect(always).toHaveAttribute("aria-checked", "true");
  await page.reload();
  await expect(
    page
      .getByRole("row", { name: new RegExp(bot.name) })
      .getByRole("switch", { name: `Always load for ${bot.name}` }),
  ).toHaveAttribute("aria-checked", "true");

  // A new version: the bot keeps v1 and gets the upgrade link; the upgrade card shows the diff.
  await page.getByRole("tab", { name: "Skill", exact: true }).click();
  await saveBody(
    page,
    "## Steps\n1. Read the brief.\n2. Write one story per goal.",
    2,
    "One per goal",
  );
  await page.getByRole("tab", { name: /Bots/ }).click();
  await page.getByRole("button", { name: "Upgrade to v2" }).click();
  const upgrade = page.getByRole("dialog", { name: `Upgrade ${skill.name} to v2?` });
  await expect(upgrade).toContainText(`${bot.name} uses v1.`);
  await expect(upgrade).toContainText("One per goal");
  await expect(
    upgrade
      .getByLabel("Body changes")
      .locator('[data-op="add"]', { hasText: "one story per goal" }),
  ).toBeVisible();
  await upgrade.getByRole("button", { name: "Upgrade to v2" }).click();
  await expect(page.getByRole("row", { name: new RegExp(bot.name) })).toContainText("latest");
  await expect(page.getByRole("button", { name: "Upgrade to v2" })).toHaveCount(0);

  // Deprecate: the bot is listed and ticked, so it stops using the skill.
  await page.getByRole("button", { name: "Skill actions" }).click();
  await page.getByRole("menuitem", { name: "Deprecate" }).click();
  const deprecate = page.getByRole("alertdialog", { name: `Time for ${skill.name} to rest? 🌙` });
  await expect(deprecate.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
  await expect(deprecate).toContainText(bot.name);
  await deprecate.getByRole("button", { name: "Deprecate and remove from 1 bot" }).click();
  await expect(page.getByText("No bot uses it.")).toBeVisible();
  await expect(page.getByText("No bot uses this skill yet.")).toBeVisible();
  expect(await pinnedSkillIds(page, bot.name)).not.toContain(skillId);
  expect(await violations()).toEqual([]);
});

test("an unticked bot keeps a deprecated skill until Remove from bots (M2a)", async ({ page }) => {
  const skill = unique("Kept skill");
  const bot = unique("Keeping bot");
  await createSkill(page, skill);
  const skillId = await createBotUsing(page, bot.name, skill.slug);
  await page.goto(`/skills/${skill.slug}`);

  await page.getByRole("button", { name: "Skill actions" }).click();
  await page.getByRole("menuitem", { name: "Deprecate" }).click();
  const deprecate = page.getByRole("alertdialog", { name: `Time for ${skill.name} to rest? 🌙` });
  await deprecate.getByRole("checkbox").click();
  await deprecate.getByRole("button", { name: "Deprecate", exact: true }).click();
  await expect(page.getByText("1 bot still uses it.")).toBeVisible();
  expect(await pinnedSkillIds(page, bot.name)).toContain(skillId);

  // Remove from bots: the same list, every box ticked.
  await page.getByRole("button", { name: "Remove from bots" }).click();
  const remove = page.getByRole("dialog", { name: `Remove ${skill.name} from bots? 🧹` });
  await expect(remove.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
  await remove.getByRole("button", { name: "Remove from 1 bot" }).click();
  await expect(page.getByText("No bot uses it.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove from bots" })).toHaveCount(0);
  expect(await pinnedSkillIds(page, bot.name)).not.toContain(skillId);
});

test("a long diff scrolls inside the upgrade card, and Upgrade and Cancel stay in view (M2a)", async ({
  page,
}) => {
  const skill = unique("Long diff");
  const bot = unique("Long diff bot");
  await createSkill(page, skill);
  await createBotUsing(page, bot.name, skill.slug);
  const steps = Array.from(
    { length: 80 },
    (_, index) => `Step ${String(index + 1)}: Read the source and check the result.`,
  );
  await saveBody(page, steps.join("\n"), 2);
  await page.goto(`/skills/${skill.slug}?tab=bots`);

  // A short window too: then the card itself scrolls, and its buttons stay at its bottom.
  for (const height of [900, 560]) {
    await page.setViewportSize({ width: 1440, height });
    await page.getByRole("button", { name: "Upgrade to v2" }).click();
    const upgrade = page.getByRole("dialog", { name: `Upgrade ${skill.name} to v2?` });
    await expect(upgrade.locator('[data-op="add"]').last()).toBeAttached();
    const box = await upgrade.boundingBox();
    expect(box !== null && box.y >= 0 && box.y + box.height <= height).toBe(true);
    await expect(upgrade.getByRole("button", { name: "Cancel" })).toBeInViewport();
    await expect(upgrade.getByRole("button", { name: "Upgrade to v2" })).toBeInViewport();
    if (height === 900) {
      // The diff's scroll area is the open tab panel, which takes focus (axe: scrollable regions).
      const axe = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
      expect(axe.violations).toEqual([]);
      await upgrade.getByRole("button", { name: "Cancel" }).click();
      await expect(upgrade).toHaveCount(0);
    } else {
      await upgrade.getByRole("button", { name: "Upgrade to v2" }).click();
    }
  }
  await expect(page.getByRole("row", { name: new RegExp(bot.name) })).toContainText("latest");
});

test("the Skills page has no axe violations", async ({ page }) => {
  const skill = unique("Axe");
  await createSkill(page, skill);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("tab", { name: /History/ }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

// Review fixes for #54. Each test fails on the code before the fix.

test("a change in another tab keeps this tab's unsaved edit and shows the conflict", async ({
  page,
  context,
}) => {
  const skill = unique("Two tabs");
  await createSkill(page, skill);
  await page.getByRole("tab", { name: "Write" }).click();
  await fill(page, "Description", "My unsaved description.");

  const other = await context.newPage();
  await other.goto(`/skills/${skill.slug}`);
  await other.getByLabel("Name", { exact: true }).fill(`${skill.name} renamed`);
  await other.getByRole("button", { name: "Save", exact: true }).click();
  await expect(other.getByText("Saved ✨")).toBeVisible();

  // The stream tells the first tab; its page top shows the new name, the edit stays.
  await expect(pageTitle(page)).toHaveText(`${skill.name} renamed`);
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue(
    "My unsaved description.",
  );
  await expect(
    page.getByText(/This skill changed in another place\. Your changes are kept/),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Save as v2" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  // Discard loads the newest text.
  await page.getByRole("button", { name: "Discard" }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(`${skill.name} renamed`);
  await expect(page.getByText("All changes are saved.")).toBeVisible();
});

test("leaving an edited Clone for a new skill asks first", async ({ page }) => {
  const skill = unique("Clone leave");
  await createSkill(page, skill);
  await page.getByRole("button", { name: "Skill actions" }).click();
  await page.getByRole("menuitem", { name: "Clone" }).click();
  await fill(page, "Description", "Edited copy.");
  await page.getByRole("link", { name: "Create", exact: true }).click();
  const dialog = page.getByRole("alertdialog", { name: "Leave without saving? 👀" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Stay on this skill" }).click();
  await expect(page).toHaveURL(/\/skills\/new\?from=skillv_/);
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue("Edited copy.");
});

test("a second Clone of a skill proposes the next free slug", async ({ page }) => {
  const skill = unique("Clone twice");
  await createSkill(page, skill);
  // In-app moves only: a reload would clear the cache that kept the old slug.
  for (const slug of [`${skill.slug}-copy`, `${skill.slug}-copy-2`]) {
    await page
      .getByRole("navigation", { name: "Skills" })
      .getByRole("link", { name: new RegExp(`^${skill.name} v1`) })
      .click();
    await expect(page).toHaveURL(`/skills/${skill.slug}`);
    await page.getByRole("button", { name: "Skill actions" }).click();
    await page.getByRole("menuitem", { name: "Clone" }).click();
    await expect(page.getByLabel("Slug", { exact: true })).toHaveValue(slug);
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page).toHaveURL(`/skills/${slug}`);
  }
});

test("a time's full value opens from the keyboard", async ({ page }) => {
  const skill = unique("Time tip");
  await createSkill(page, skill);
  await page.getByRole("tab", { name: /History/ }).click();
  const time = page.getByRole("main").locator("time").first();
  await time.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(time).toBeFocused();
  await expect(page.getByText(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d [+-]\d\d:\d\d$/)).toBeVisible();
});

// Second review of #54. Each test fails on the code before its fix.

test("text typed while a save is pending stays as a change", async ({ page }) => {
  const skill = unique("Slow save");
  await createSkill(page, skill);
  // Hold the save request until the test lets it go.
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/api\/skills\/[^/]+\/versions$/, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await held;
    await route.continue();
  });
  await page.getByRole("tab", { name: "Write" }).click();
  await fill(page, "Description", "Sent with the save.");
  await page.getByRole("button", { name: "Save as v2" }).click();
  await fill(page, "Body", "Typed while saving.");
  release();
  await expect(page.getByText("Saved v2 ✨")).toBeVisible();
  // The stream's refresh brings v2; the text typed after Save is still a change.
  await expect(page.getByRole("tab", { name: /History/ })).toHaveText(/History\s*2/);
  await expect(page.getByLabel("Body", { exact: true })).toHaveValue("Typed while saving.");
  await expect(page.getByText("1 change not saved")).toBeVisible();
});

test("a deprecation in another tab keeps the leave question for unsaved text", async ({
  page,
  context,
}) => {
  const skill = unique("Deprecated elsewhere");
  await createSkill(page, skill);
  await page.getByRole("tab", { name: "Write" }).click();
  await fill(page, "Description", "My unsaved description.");

  const other = await context.newPage();
  await other.goto(`/skills/${skill.slug}`);
  await other.getByRole("button", { name: "Skill actions" }).click();
  await other.getByRole("menuitem", { name: "Deprecate" }).click();
  await other.getByRole("alertdialog").getByRole("button", { name: "Deprecate" }).click();

  // The stream tells this tab: the skill is read-only now, and the unsaved text stays.
  await expect(page.getByRole("main").getByText("Deprecated", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue(
    "My unsaved description.",
  );
  await page.getByRole("link", { name: "Create", exact: true }).click();
  const leave = page.getByRole("alertdialog", { name: "Leave without saving? 👀" });
  await expect(leave).toBeVisible();
  await leave.getByRole("button", { name: "Stay on this skill" }).click();
  await expect(
    page.getByText(
      /This skill was deprecated\. Your changes are still here, but you cannot save them/,
    ),
  ).toBeVisible();
  // The text can be selected and copied from the keyboard.
  const description = page.getByLabel("Description", { exact: true });
  await description.focus();
  await expect(description).toBeFocused();
  await page.keyboard.press("ControlOrMeta+a");
  expect(
    await description.evaluate((box: HTMLTextAreaElement) =>
      box.value.slice(box.selectionStart, box.selectionEnd),
    ),
  ).toBe("My unsaved description.");
});

test("a failed background refresh keeps the editor and its unsaved text", async ({
  page,
  context,
}) => {
  const skill = unique("Refresh fails");
  await createSkill(page, skill);
  await page.getByRole("tab", { name: "Write" }).click();
  await fill(page, "Description", "My unsaved description.");
  // From now on the skill list fails for this tab only.
  let failures = 0;
  await page.route(
    (url) => url.pathname === "/api/skills",
    async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      failures += 1;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "internal_error", message: "Something failed." } }),
      });
    },
  );
  // A change in another tab makes this tab refresh the list; the refresh and its retries fail.
  const other = await context.newPage();
  await other.goto(`/skills/${skill.slug}`);
  await other.getByLabel("Name", { exact: true }).fill(`${skill.name} renamed`);
  await other.getByRole("button", { name: "Save", exact: true }).click();
  await expect(other.getByText("Saved ✨")).toBeVisible();
  await expect.poll(() => failures, { timeout: 15_000 }).toBeGreaterThanOrEqual(4);
  // Give the page time to show the failure; the old page replaced the editor here.
  await page.waitForTimeout(500);
  await expect(page.getByText("The app could not load the skills.")).toHaveCount(0);
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue(
    "My unsaved description.",
  );
  await expect(
    page
      .getByRole("navigation", { name: "Skills" })
      .getByRole("link", { name: new RegExp(`^${skill.name} `) }),
  ).toBeVisible();
});

// Third review of #54. Each test fails on the code before its fix.

// Opens the Clone of the skill on screen.
async function openClone(page: Page) {
  await page.getByRole("button", { name: "Skill actions" }).click();
  await page.getByRole("menuitem", { name: "Clone" }).click();
  await expect(page).toHaveURL(/\/skills\/new\?from=skillv_/);
}

test("a settings change keeps an edited Clone", async ({ page }) => {
  const skill = unique("Clone limit");
  await createSkill(page, skill);
  await openClone(page);
  await fill(page, "Description", "Edited copy.");
  const patch = (body: object) =>
    page.evaluate(async (json) => {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: json,
      });
      return response.status;
    }, JSON.stringify(body));
  expect(await patch({ skill_name_max: 63 })).toBe(200);
  try {
    // The stream brings the new limit to the open editor; the draft stays.
    await expect(page.getByText(/^\d+ \/ 63$/)).toBeVisible();
    await expect(page.getByLabel("Description", { exact: true })).toHaveValue("Edited copy.");
  } finally {
    expect(await patch({ skill_name_max: 64 })).toBe(200);
  }
});

test("a Clone whose source does not load shows the error state with Try again", async ({
  page,
}) => {
  const skill = unique("Clone fails");
  await createSkill(page, skill);
  await openClone(page);
  const skillList = (url: URL) => url.pathname === "/api/skills";
  await page.route(skillList, (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "internal_error", message: "Something failed." },
          }),
        })
      : route.fallback(),
  );
  await page.reload();
  // TanStack Query tries three more times before the error shows.
  const alert = page
    .getByRole("alert")
    .filter({ hasText: "The app could not load the skill to copy." });
  await expect(alert).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Page not found" })).toHaveCount(0);
  await page.unroute(skillList);
  await alert.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByLabel("Slug", { exact: true })).toHaveValue(`${skill.slug}-copy`);
});

test("the fields wait while Create is pending", async ({ page }) => {
  const skill = unique("Slow create");
  await page.goto("/skills/new");
  await fill(page, "Name", skill.name);
  await fill(page, "Description", "Use it.");
  await fill(page, "Body", "## Steps");
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    (url) => url.pathname === "/api/skills",
    async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      await held;
      await route.continue();
    },
  );
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByLabel("Body", { exact: true })).not.toBeEditable();
  release();
  await expect(page).toHaveURL(`/skills/${skill.slug}`);
});

test("a Clone skips a slug that a skill in Trash keeps", async ({ page }) => {
  const skill = unique("Clone trash");
  await createSkill(page, skill);
  // The first copy takes `-copy`, then goes to Trash; its slug stays taken but is not listed.
  await openClone(page);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(`/skills/${skill.slug}-copy`);
  await page.getByRole("button", { name: "Skill actions" }).click();
  await page.getByRole("menuitem", { name: "Deprecate" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Deprecate" }).click();
  await page.getByRole("button", { name: "Skill actions" }).click();
  await page.getByRole("menuitem", { name: "Delete skill" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete skill" }).click();
  await expect(page.getByText(/is in Trash\.$/)).toBeVisible();

  await page.goto(`/skills/${skill.slug}`);
  await openClone(page);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(`/skills/${skill.slug}-copy-2`);
});

// Fourth review of #54. Each test fails on the code before its fix.

test("a Clone opens with a settings error, and Create waits for the limits", async ({ page }) => {
  test.setTimeout(60_000);
  const skill = unique("Clone no settings");
  await createSkill(page, skill);
  await openClone(page);
  let requests = 0;
  const settingsUrl = "**/api/settings";
  await page.route(settingsUrl, (route) => {
    requests += 1;
    return route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "internal_error", message: "Something failed." } }),
    });
  });
  await page.reload();
  // TanStack Query tries three more times; then the editor opens with no limit.
  const slug = page.getByLabel("Slug", { exact: true });
  await expect(slug).toHaveValue(`${skill.slug}-copy`, { timeout: 20_000 });
  const alert = page
    .getByRole("alert")
    .filter({ hasText: "The app could not load the limits for skills, so Create is off." });
  // The editor's own settings query tries again when it opens, so the error comes after its
  // retries; until then Create is off with "Loading the limits."
  await expect(alert).toBeVisible({ timeout: 15_000 });
  const create = page.getByRole("button", { name: "Create", exact: true });
  await expect(create).toHaveAttribute("aria-disabled", "true");
  // The name counter shows no default limit that may not be the owner's: only the length. (The
  // slug and description limits are fixed rules, not settings, so they still show.)
  const nameLength = String(`${skill.name} (copy)`.length);
  await expect(page.getByText(nameLength, { exact: true })).toBeVisible();
  await expect(page.getByText(`${nameLength} / 64`, { exact: true })).toHaveCount(0);
  await fill(page, "Description", "Edited while the limits are missing.");
  // The editor's own tries end; then no more requests come: the page does not loop.
  await page.waitForTimeout(10_000);
  const settled = requests;
  await page.waitForTimeout(5_000);
  expect(requests).toBe(settled);
  // Try again loads the limits and keeps the draft.
  await page.unroute(settingsUrl);
  await alert.getByRole("button", { name: "Try again" }).click();
  await expect(alert).toBeHidden();
  await expect(create).not.toHaveAttribute("aria-disabled", "true");
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue(
    "Edited while the limits are missing.",
  );
  await expect(page.getByText(`${nameLength} / 64`, { exact: true })).toBeVisible();
});

test("Cancel waits for a pending Create", async ({ page }) => {
  const skill = unique("Cancel create");
  await page.goto("/skills/new");
  await fill(page, "Name", skill.name);
  await fill(page, "Description", "Use it.");
  await fill(page, "Body", "## Steps");
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    (url) => url.pathname === "/api/skills",
    async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      await held;
      await route.continue();
    },
  );
  await page.getByRole("button", { name: "Create", exact: true }).click();
  const cancel = page.getByRole("button", { name: "Cancel" });
  await expect(cancel).toHaveAttribute("aria-disabled", "true");
  // Playwright waits for an aria-disabled button to turn on; a person can still click it.
  await cancel.click({ force: true });
  await expect(page).toHaveURL("/skills/new");
  release();
  await expect(page).toHaveURL(`/skills/${skill.slug}`);
});

test("a Create that ends after the owner left does not move the page", async ({ page }) => {
  const skill = unique("Late create");
  await page.goto("/skills/new");
  await fill(page, "Name", skill.name);
  await fill(page, "Description", "Use it.");
  await fill(page, "Body", "## Steps");
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    (url) => url.pathname === "/api/skills",
    async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      await held;
      await route.continue();
    },
  );
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Projects" })
    .getByRole("link", { name: "Home" })
    .click();
  await page
    .getByRole("alertdialog", { name: "Leave without saving? 👀" })
    .getByRole("button", { name: "Let them go" })
    .click();
  await expect(page).toHaveURL("/");
  release();
  await expect(page.getByText(`Created ${skill.name} ✨`)).toBeVisible();
  await expect(page).toHaveURL("/");
});

// Owner's answers on #54 (2026-10-31). Each test fails on the code before its change.

test("a stale save loads the newest version and keeps the edit", async ({ page, context }) => {
  const skill = unique("Stale save");
  await createSkill(page, skill);
  // This tab hears nothing from the stream, so it does not learn of the other tab's save.
  await page.route("**/api/stream", (route) => route.abort());
  await page.reload();
  await page.getByRole("tab", { name: "Write" }).click();
  await fill(page, "Description", "My unsaved description.");

  const other = await context.newPage();
  await other.goto(`/skills/${skill.slug}`);
  // A new version (a rename alone makes none, and a version save does not check it).
  await saveBody(other, "## Steps\n1. Saved in the other tab.", 2);

  await page.getByRole("button", { name: "Save as v2" }).click();
  await expect(
    page.getByText(/This skill changed in another place\. Your changes are kept/),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: /History/ })).toHaveText(/History\s*2/);
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue(
    "My unsaved description.",
  );
  await page.getByRole("button", { name: "Discard" }).click();
  await expect(page.getByText("All changes are saved.")).toBeVisible();
  await page.getByRole("tab", { name: "Write" }).click();
  await expect(page.getByLabel("Body", { exact: true })).toHaveValue(
    "## Steps\n1. Saved in the other tab.",
  );
});

test("a Clone's Create tries no other slug after a general failure", async ({ page }) => {
  const skill = unique("Clone server error");
  await createSkill(page, skill);
  await openClone(page);
  let posts = 0;
  await page.route(
    (url) => url.pathname === "/api/skills",
    (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      posts += 1;
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "internal_error", message: "Something failed." } }),
      });
    },
  );
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByText("Something failed.")).toBeVisible();
  expect(posts).toBe(1);
  await expect(page.getByLabel("Slug", { exact: true })).toHaveValue(`${skill.slug}-copy`);
});

test("Deprecate and Make active again keep a conflict from another tab", async ({
  page,
  context,
}) => {
  const skill = unique("Conflict kept");
  await createSkill(page, skill);
  await page.getByRole("tab", { name: "Write" }).click();
  await fill(page, "Description", "My unsaved description.");

  // Another tab saves v2; the stream tells this tab, and the conflict shows.
  const other = await context.newPage();
  await other.goto(`/skills/${skill.slug}`);
  await saveBody(other, "## Steps\n1. Saved in the other tab.", 2);
  const conflict = page.getByText(/This skill changed in another place\. Your changes are kept/);
  await expect(conflict).toBeVisible();

  // Deprecate and Make active again from this tab must not take the other tab's v2 as the base
  // of this edit: that would hide the conflict, and Save would overwrite v2.
  await page.getByRole("button", { name: "Skill actions" }).click();
  await page.getByRole("menuitem", { name: "Deprecate" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Deprecate" }).click();
  await page.getByRole("button", { name: "Make active again" }).click();
  await expect(page.getByRole("button", { name: "Make active again" })).toBeHidden();

  await expect(conflict).toBeVisible();
  await expect(page.getByRole("button", { name: "Save as v3" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue(
    "My unsaved description.",
  );
  // Discard loads the newest text.
  await page.getByRole("button", { name: "Discard" }).click();
  await expect(page.getByText("All changes are saved.")).toBeVisible();
  await page.getByRole("tab", { name: "Write" }).click();
  await expect(page.getByLabel("Body", { exact: true })).toHaveValue(
    "## Steps\n1. Saved in the other tab.",
  );
});

test("a tooltip shows above the History check boxes and times", async ({ page }) => {
  const skill = unique("Tooltip on top");
  await createSkill(page, skill, "one");
  await saveBody(page, "two", 2);
  await page.getByRole("tab", { name: /History/ }).click();
  await page.getByRole("button", { name: "Compare" }).click();
  // The full time of the oldest row opens above it, over the rows' check boxes and times,
  // which sit at z-10 above each row's click area.
  // A tooltip opens on keyboard focus, so the focus comes from the keyboard.
  const time = page.getByRole("main").locator("time").last();
  await time.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(time).toBeFocused();
  const tip = page.getByText(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d [+-]\d\d:\d\d$/);
  await expect(tip).toBeVisible();
  // At every point of the tooltip, the element on top is the tooltip itself.
  const covered = await tip.evaluate((popup) => {
    const box = popup.getBoundingClientRect();
    const hidden: string[] = [];
    for (let x = box.left + 2; x < box.right - 1; x += 4) {
      for (let y = box.top + 2; y < box.bottom - 1; y += 4) {
        const top = document.elementFromPoint(x, y);
        if (top !== null && !popup.contains(top)) hidden.push(top.outerHTML.slice(0, 60));
      }
    }
    return [...new Set(hidden)];
  });
  expect(covered).toEqual([]);
});
