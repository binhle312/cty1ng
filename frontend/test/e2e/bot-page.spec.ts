import { expect, type Page, test } from "@playwright/test";
import { createClient } from "../../src/lib/api/generated/client/index.ts";
import { createBot } from "../../src/lib/api/generated/sdk.gen.ts";
import { watchCsp } from "./csp.ts";

// The bot page (M2c, bot-page.md) and the bot cards after a skill save (skills-page.md §7). The
// servers keep one database for every file, so each test makes its own bot and skill.

function apiClient() {
  const origin = test.info().project.use.baseURL ?? "";
  return createClient({ baseUrl: origin, headers: { origin } });
}

function tagged(): string {
  return `${Date.now().toString(36)}${String(Math.floor(Math.random() * 1000))}`;
}

// A bot with no skills, through the API, with the Origin header a browser would send.
async function makeBot(name: string): Promise<{ id: string; slug: string }> {
  const created = await createBot({
    client: apiClient(),
    headers: { "idempotency-key": crypto.randomUUID() },
    body: {
      name,
      description: `The ${name} bot.`,
      persona_md: `You are ${name}.`,
      avatar_style: "flat",
      avatar_colour: "#6FA8FF",
      model_id: "fake:scripted",
      pins: [],
    },
  });
  expect(created.response?.status, JSON.stringify(created.error)).toBe(201);
  if (created.data === undefined) throw new Error("no bot");
  return created.data;
}

async function fill(page: Page, label: string, text: string) {
  await page.getByLabel(label, { exact: true }).fill(text);
}

test("J4: a skill save offers the upgrade, the bot keeps v1, and the bot page upgrades it", async ({
  page,
}) => {
  const violations = await watchCsp(page);
  const tag = tagged();
  const botName = `BA ${tag}`;
  const bot = await makeBot(botName);
  const skill = { name: `Write stories ${tag}`, slug: `write-stories-${tag}` };

  // Create the skill, and give it to BA in the assign card (C4b): no box starts ticked.
  await page.goto("/skills/new");
  await fill(page, "Name", skill.name);
  await fill(page, "Description", "Use this skill when the owner asks for user stories.");
  await fill(page, "Body", "## Steps\n1. Read the brief.\n2. Write the stories.");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  const assign = page.getByRole("dialog", { name: `Created ✨ Add ${skill.name} to bots?` });
  const baBox = assign.getByRole("checkbox", { name: new RegExp(botName) });
  await expect(baBox).toHaveAttribute("aria-checked", "false");
  await baBox.click();
  await assign.getByRole("button", { name: "Assign" }).click();
  await expect(assign).toBeHidden();
  await expect(page).toHaveURL(`/skills/${skill.slug}`);

  // Edit → v2. The upgrade card ticks BA; the owner unticks it and skips, so BA keeps v1.
  await page.getByRole("tab", { name: "Write" }).click();
  await fill(page, "Body", "## Steps\n1. Read the brief.\n2. Write one story per goal.");
  await fill(page, "What changed", "One story per goal");
  await page.getByRole("button", { name: "Save as v2" }).click();
  const upgradeCard = page.getByRole("dialog", {
    name: "Saved v2 ✨ Also upgrade these bots to v2?",
  });
  const box = upgradeCard.getByRole("checkbox", { name: new RegExp(botName) });
  await expect(box).toHaveAttribute("aria-checked", "true");
  await box.click();
  await expect(upgradeCard.getByRole("button", { name: "Upgrade" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await upgradeCard.getByRole("button", { name: "Skip" }).click();
  await expect(upgradeCard).toBeHidden();

  // Later, on BA's page: "v2 available", the changes, Upgrade.
  await page.goto(`/bots/${bot.slug}?tab=skills`);
  await expect(page.getByRole("heading", { name: botName, level: 1 })).toBeVisible();
  const row = page.locator(`tr[data-skill="${skill.slug}"]`);
  await expect(row).toContainText("v1");
  await row.getByRole("button", { name: "v2 available" }).click();
  const dialog = page.getByRole("dialog", { name: `Upgrade ${skill.name} to v2?` });
  await expect(dialog).toContainText(`${botName} uses v1.`);
  await expect(dialog).toContainText("One story per goal");
  await expect(
    dialog.getByLabel("Body changes").locator('[data-op="add"]', { hasText: "one story per goal" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Upgrade to v2" }).click();
  await expect(dialog).toBeHidden();
  await expect(row).toContainText("v2");
  await expect(row.getByRole("button", { name: "v2 available" })).toHaveCount(0);

  // A reload keeps the bot and the tab (bot-page.md §1).
  await page.reload();
  await expect(page.getByRole("tab", { name: /Skills/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(`tr[data-skill="${skill.slug}"]`)).toContainText("v2");
  expect(await violations()).toEqual([]);
});

test("a Profile save shows in another tab at once, and an edit there keeps its text", async ({
  browser,
}) => {
  const tag = tagged();
  const botName = `Writer ${tag}`;
  const bot = await makeBot(botName);
  const context = await browser.newContext();
  const first = await context.newPage();
  const second = await context.newPage();
  const violations = await watchCsp(first);
  for (const page of [first, second]) {
    await page.goto(`/bots/${bot.slug}`);
    await expect(page.getByRole("heading", { name: botName, level: 1 })).toBeVisible();
  }

  // The second tab has an unsaved edit; the first tab saves a new description.
  await fill(second, "Name", `Editor ${tag}`);
  await fill(first, "Description", "Writes the release notes.");
  await first.getByRole("button", { name: "Save" }).click();
  await expect(first.getByText("No changes. Edits apply from the next run.")).toBeVisible();

  // The event reaches the second tab: its edit stays, and the save bar names the conflict.
  await expect(
    second.getByText(
      `${botName} changed in another place. Your changes are kept here. Copy what you need, then Discard to load the new values.`,
    ),
  ).toBeVisible();
  await expect(second.getByLabel("Name", { exact: true })).toHaveValue(`Editor ${tag}`);
  await second.getByRole("button", { name: "Discard" }).click();
  await second
    .getByRole("alertdialog", { name: "Leave without saving? 👀" })
    .getByRole("button", { name: "Let them go" })
    .click();
  await expect(second.getByLabel("Description", { exact: true })).toHaveValue(
    "Writes the release notes.",
  );
  expect(await violations()).toEqual([]);
  await context.close();
});
