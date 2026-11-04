import { expect, test } from "@playwright/test";
import { createClient } from "../../src/lib/api/generated/client/index.ts";
import { listBots } from "../../src/lib/api/generated/sdk.gen.ts";
import { watchCsp } from "./csp.ts";
import { skipAssignCard } from "./skill-cards.ts";

// The first-use journey (testing.md §3, J1 in requirements/product-brief.md). Each slice adds
// its steps; M1 builds the "create skill" part of step 1. The servers can keep one database
// between runs (`pnpm e2e:serve`), so the skill and the bots get their own names each run.
// M1 built "create a skill"; M2b adds "create bot BA with it" and a Clone with the other fake
// model (M2 plan §5); M2c chains the upgrade of J4 to it (M2-bots.md Tests).
test("J1 step 1 and J4: create a skill, bot BA with it, a clone with another model, then upgrade", async ({
  page,
  baseURL,
}) => {
  const violations = await watchCsp(page);
  const tag = Date.now().toString(36);
  const skillName = `Write user stories ${tag}`;
  await page.goto("/");
  await page.getByRole("button", { name: /^Sir( · Menu)?$/ }).click();
  await page.getByRole("menuitem", { name: "Manage skills" }).click();
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill(skillName);
  await expect(page.getByLabel("Slug", { exact: true })).toHaveValue(`write-user-stories-${tag}`);
  await page
    .getByLabel("Description", { exact: true })
    .fill("Use this skill when the owner asks for user stories.");
  await page
    .getByLabel("Body", { exact: true })
    .fill("## Steps\n1. Read the brief.\n2. Write one story for each goal.");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await skipAssignCard(page, skillName);
  await expect(page).toHaveURL(`/skills/write-user-stories-${tag}`);
  await expect(page.getByRole("main").getByRole("heading", { level: 2 }).first()).toHaveText(
    skillName,
  );

  // Create bot BA from the Bots page, with the skill and the fake model that has efforts.
  const name = `BA ${tag}`;
  await page.goto("/bots");
  await page.getByRole("main").getByRole("link", { name: "Create" }).click();
  await expect(page).toHaveURL("/bots/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page
    .getByLabel("Description", { exact: true })
    .fill("Turns rough ideas into user stories.");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Persona", { exact: true }).fill("You are the business analyst.");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Search skills").fill(tag);
  await page.getByRole("checkbox", { name: new RegExp(skillName) }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByLabel("Model", { exact: true }).selectOption("fake:effort");
  await page.getByLabel("Effort", { exact: true }).selectOption("high");
  const preview = page.getByRole("complementary", { name: "Preview" });
  await expect(preview).toContainText(`${skillName} v1`);
  await expect(preview.getByTestId("preview-pill")).toHaveText("Ready to create");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByText(`Created ${name} ✨`)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/bots/ba-${tag}\\?tab=profile$`));
  await expect(
    page.getByRole("banner", { name: "Bots" }).getByRole("button", { name }),
  ).toBeVisible();

  // Clone it from the Bots page. A reload keeps the clone (create-bot-page.md §6).
  await page.goto("/bots");
  const card = page.getByTestId("bot-card").filter({ hasText: name });
  await card.hover();
  await card.getByRole("button", { name: `${name} actions` }).click();
  await page.getByRole("menuitem", { name: "Clone" }).click();
  await expect(page).toHaveURL(/\/bots\/new\?from=bot_/);
  await page.reload();
  await expect(page.getByText(`Cloning ${name}`)).toBeVisible();
  await expect(page.getByLabel("Model", { exact: true })).toHaveValue("fake:effort");
  await expect(preview).toContainText(`${skillName} v1`);
  // The other fake model has no efforts, so the effort field goes.
  await page.getByLabel("Model", { exact: true }).selectOption("fake:scripted");
  await expect(page.getByLabel("Effort", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  const copy = `${name} (copy)`;
  await expect(page.getByText(`Created ${copy} ✨`)).toBeVisible();

  // The clone keeps the skill version and points at BA; its model is the other one.
  const origin = baseURL ?? "";
  const client = createClient({ baseUrl: origin, headers: { origin } });
  const bots = (await listBots({ client, throwOnError: true })).data;
  const ba = bots.find((bot) => bot.name === name);
  const clone = bots.find((bot) => bot.name === copy);
  expect(ba?.model_id).toBe("fake:effort");
  expect(ba?.effort).toBe("high");
  expect(clone?.model_id).toBe("fake:scripted");
  expect(clone?.effort).toBeNull();
  expect(clone?.cloned_from_bot_id).toBe(ba?.id);
  expect(clone?.pins.map((pin) => pin.skill_version_id)).toEqual(
    ba?.pins.map((pin) => pin.skill_version_id),
  );

  // J4: edit the skill → v2. The card offers v2 to BA and its clone, both ticked; Skip moves
  // neither, so both keep v1.
  const slug = `write-user-stories-${tag}`;
  await page.goto(`/skills/${slug}`);
  await page.getByRole("tab", { name: "Write" }).click();
  await page
    .getByLabel("Body", { exact: true })
    .fill("## Steps\n1. Read the brief.\n2. Write one story per goal, with its checks.");
  await page.getByLabel("What changed", { exact: true }).fill("Checks for each story");
  await page.getByRole("button", { name: "Save as v2" }).click();
  const upgradeCard = page.getByRole("dialog", {
    name: "Saved v2 ✨ Also upgrade these bots to v2?",
  });
  // Only BA and its clone use the new skill.
  const boxes = upgradeCard.getByRole("checkbox");
  await expect(boxes).toHaveCount(2);
  for (const box of await boxes.all()) await expect(box).toHaveAttribute("aria-checked", "true");
  await expect(upgradeCard).toContainText(copy);
  await upgradeCard.getByRole("button", { name: "Skip" }).click();
  await expect(upgradeCard).toBeHidden();

  // Later, on BA's bot page: "v2 available", the changes, Upgrade.
  await page.goto(`/bots/ba-${tag}?tab=skills`);
  const row = page.locator(`tr[data-skill="${slug}"]`);
  await expect(row).toContainText("v1");
  await row.getByRole("button", { name: "v2 available" }).click();
  const dialog = page.getByRole("dialog", { name: `Upgrade ${skillName} to v2?` });
  await expect(dialog).toContainText(`${name} uses v1.`);
  await expect(dialog).toContainText("Checks for each story");
  await dialog.getByRole("button", { name: "Upgrade to v2" }).click();
  await expect(dialog).toBeHidden();
  await expect(row).toContainText("v2");
  await expect(row.getByRole("button", { name: "v2 available" })).toHaveCount(0);

  // BA is on v2; the clone kept v1, because Skip moved no bot.
  const after = (await listBots({ client, throwOnError: true })).data;
  const versionOf = (botName: string) =>
    after.find((bot) => bot.name === botName)?.pins.find((pin) => pin.skill_slug === slug)?.version;
  expect(versionOf(name)).toBe(2);
  expect(versionOf(copy)).toBe(1);
  // Next (M3): a conversation with BA.
  expect(await violations()).toEqual([]);
});
