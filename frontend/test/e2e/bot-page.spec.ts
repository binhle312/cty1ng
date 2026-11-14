import { expect, type Page, test } from "@playwright/test";
import { z } from "zod";
import { createClient } from "../../src/lib/api/generated/client/index.ts";
import { createBot, getBot, updateBot } from "../../src/lib/api/generated/sdk.gen.ts";
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
async function makeBot(name: string): Promise<{ id: string; slug: string; name: string }> {
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

async function fill(page: Page, { label, text }: { label: string; text: string }) {
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
  await fill(page, { label: "Name", text: skill.name });
  await fill(page, {
    label: "Description",
    text: "Use this skill when the owner asks for user stories.",
  });
  await fill(page, { label: "Body", text: "## Steps\n1. Read the brief.\n2. Write the stories." });
  await page.getByRole("button", { name: "Create", exact: true }).click();
  const assign = page.getByRole("dialog", { name: `Created ✨ Add ${skill.name} to bots?` });
  const baBox = assign.getByRole("checkbox", { name: new RegExp(botName) });
  await expect(baBox).toHaveAttribute("aria-checked", "false");
  await baBox.click();
  await assign.getByRole("button", { name: "Assign" }).click();
  await expect(assign).toBeHidden();
  await expect(page).toHaveURL(`/skills/${skill.slug}`);

  // Edit → v2. The upgrade card ticks BA; Skip alone changes nothing, so BA keeps v1 (J4).
  await page.getByRole("tab", { name: "Write" }).click();
  await fill(page, {
    label: "Body",
    text: "## Steps\n1. Read the brief.\n2. Write one story per goal.",
  });
  await fill(page, { label: "What changed", text: "One story per goal" });
  await page.getByRole("button", { name: "Save as v2" }).click();
  const upgradeCard = page.getByRole("dialog", {
    name: "Saved v2 ✨ Also upgrade these bots to v2?",
  });
  const box = upgradeCard.getByRole("checkbox", { name: new RegExp(botName) });
  await expect(box).toHaveAttribute("aria-checked", "true");
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
  await fill(second, { label: "Name", text: `Editor ${tag}` });
  await fill(first, { label: "Description", text: "Writes the release notes." });
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

// Audit row 1. A real key press: in a jsdom test, the dialog's own Esc listener sees the event only
// through `pressKey`.
test("Esc in a changed field asks, a second Esc stays with the text, and Let them go drops it", async ({
  page,
}) => {
  const tag = tagged();
  const bot = await makeBot(`Esc ${tag}`);
  await page.goto(`/bots/${bot.slug}`);
  const name = page.getByLabel("Name", { exact: true });
  await name.fill(`Analyst ${tag}`);

  await name.press("Escape");
  const question = page.getByRole("alertdialog", { name: "Leave without saving? 👀" });
  await expect(question).toBeVisible();
  await expect(question.getByRole("button", { name: "Stay on this page" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(question).toHaveCount(0);
  await expect(name).toHaveValue(`Analyst ${tag}`);
  await expect(name).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(question).toBeVisible();
  await question.getByRole("button", { name: "Let them go" }).click();
  await expect(question).toHaveCount(0);
  await expect(name).toHaveValue(bot.name);
  await expect(page).toHaveURL(new RegExp(`/bots/${bot.slug}`));

  // With no changes, Esc does nothing.
  await name.press("Escape");
  await expect(question).toHaveCount(0);
});

// DQ-089, Q13 A: Esc asks wherever the focus is on the page, and the bot menu keeps its own Esc.
test("Esc after a click outside the form asks, and Esc in the bot menu closes only the menu", async ({
  page,
}) => {
  const bot = await makeBot(`Esc outside ${tagged()}`);
  await page.goto(`/bots/${bot.slug}`);
  const name = page.getByLabel("Name", { exact: true });
  await name.fill("Changed");
  const question = page.getByRole("alertdialog", { name: "Leave without saving? 👀" });

  // A click on the bot name, which takes no focus: the focus leaves the form.
  await page.getByRole("heading", { name: bot.name, level: 1 }).click();
  await expect(name).not.toBeFocused();
  await page.keyboard.press("Escape");
  await expect(question).toBeVisible();
  await question.getByRole("button", { name: "Stay on this page" }).click();
  await expect(question).toHaveCount(0);

  await page.getByRole("button", { name: `${bot.name} actions` }).click();
  const remove = page.getByRole("menuitem", { name: "Delete" });
  await expect(remove).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(remove).toHaveCount(0);
  await expect(question).toHaveCount(0);
  await expect(name).toHaveValue("Changed");
});

test("Esc on the Model tab asks, and Esc in the Custom colour card closes only the card", async ({
  page,
}) => {
  const bot = await makeBot(`Esc tabs ${tagged()}`);
  await page.goto(`/bots/${bot.slug}?tab=model`);
  const limit = page.getByLabel("Model requests per run", { exact: true });
  await limit.fill("20");
  await limit.press("Escape");
  const question = page.getByRole("alertdialog", { name: "Leave without saving? 👀" });
  await expect(question).toBeVisible();
  await question.getByRole("button", { name: "Let them go" }).click();
  await expect(limit).not.toHaveValue("20");

  await page.getByRole("tab", { name: /Profile/ }).click();
  const name = page.getByLabel("Name", { exact: true });
  await name.fill("Changed");
  await page.getByRole("button", { name: "Custom" }).click();
  const hex = page.getByLabel("Hex", { exact: true });
  await expect(hex).toBeVisible();
  await hex.press("Escape");
  await expect(hex).toHaveCount(0);
  await expect(question).toHaveCount(0);
  await expect(name).toHaveValue("Changed");
});

test("a held Esc asks once, and the next repeat closes the question and keeps the text", async ({
  page,
}) => {
  const bot = await makeBot(`Held ${tagged()}`);
  await page.goto(`/bots/${bot.slug}`);
  const name = page.getByLabel("Name", { exact: true });
  await name.fill("Changed");
  const question = page.getByRole("alertdialog");
  await page.keyboard.down("Escape");
  await expect(question).toBeVisible();
  await page.keyboard.down("Escape");
  await expect(question).toBeHidden();
  // Without the check for a repeat, this press opens the question again.
  await page.keyboard.down("Escape");
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }),
  );
  await expect(question).toBeHidden();
  await page.keyboard.up("Escape");
  await expect(name).toHaveValue("Changed");
});

// Audit row 2.
test("a second Clone starts from the source bot as it is now, and Create sends that", async ({
  page,
}) => {
  const bot = await makeBot(`Twice ${tagged()}`);
  const openClone = async () => {
    // The name alone also finds the copy's card.
    const actions = page.getByRole("button", { name: `${bot.name} actions`, exact: true });
    await page.getByTestId("bot-card").filter({ has: actions }).hover();
    await actions.click();
    await page.getByRole("menuitem", { name: "Clone" }).click();
    await expect(page.getByText(`Cloning ${bot.name}`)).toBeVisible();
  };
  await page.goto("/bots");
  await openClone();
  await page.goBack();
  await expect(page).toHaveURL(/\/bots$/);

  const current = await getBot({ client: apiClient(), path: { id: bot.id } });
  const changed = await updateBot({
    client: apiClient(),
    path: { id: bot.id },
    body: { row_version: current.data?.row_version ?? 0, persona_md: "The new persona." },
  });
  expect(changed.response?.status, JSON.stringify(changed.error)).toBe(200);

  await openClone();
  const steps = page.getByRole("list", { name: "Steps" });
  await steps.getByRole("button", { name: /Persona/ }).click();
  await expect(page.locator("#create-form")).toContainText("The new persona.");

  const sent = page.waitForRequest(
    (request) => request.method() === "POST" && request.url().endsWith("/api/bots"),
  );
  await steps.getByRole("button", { name: /Model/ }).click();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  expect((await sent).postDataJSON()).toMatchObject({ persona_md: "The new persona." });
  await expect(page.getByText(`Created ${bot.name} (copy) ✨`)).toBeVisible();

  // The copy now holds the first copy name, so the next Clone proposes the next one. No reload: a
  // reload empties the cache (testing.md §3).
  await page.locator('a[href="/bots"]').first().click();
  await expect(page).toHaveURL(/\/bots$/);
  await openClone();
  await steps.getByRole("button", { name: /Basics/ }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(`${bot.name} (copy 2)`);
});

// CL2 (create-bot-page.md §6). A page.route gives the new list: the real catalog changes only with
// a server restart.
test("a second Clone uses the model list of this visit, and says the model is gone", async ({
  page,
}) => {
  const bot = await makeBot(`Gone ${tagged()}`);
  const openClone = async () => {
    const actions = page.getByRole("button", { name: `${bot.name} actions`, exact: true });
    await page.getByTestId("bot-card").filter({ has: actions }).hover();
    await actions.click();
    await page.getByRole("menuitem", { name: "Clone" }).click();
  };
  await page.goto("/bots");
  await openClone();
  await expect(page.getByText(`Cloning ${bot.name}`)).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/bots$/);

  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/models", async (route) => {
    const response = await route.fetch();
    const list = z.array(z.looseObject({ id: z.string() })).parse(await response.json());
    await held;
    await route.fulfill({ response, json: list.filter((model) => model.id !== "fake:scripted") });
  });
  await openClone();
  await expect(page.getByRole("status", { name: /Loading/ }).first()).toBeVisible();
  await expect(page.getByText(`Cloning ${bot.name}`)).toBeHidden();
  release();
  await expect(
    page.getByText(`${bot.name} cannot run: its model is no longer offered`),
  ).toBeVisible();
  await expect(
    page.getByText("fake:scripted is no longer offered. Pick another model."),
  ).toBeVisible();
  // A live event can start another models read, and `route.fetch()` fails if the test ends during
  // it (testing.md §3, "Held requests").
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

// A skill list that keeps failing, as the app's real client sees it: this needs the real retries.
async function failSkillReads(page: Page): Promise<{ count: () => number }> {
  let reads = 0;
  await page.route("**/api/skills*", async (route) => {
    reads += 1;
    await route.fulfill({
      status: 500,
      json: { error: { code: "internal_error", message: "Failed." } },
    });
  });
  return { count: () => reads };
}

// Other test files share the server, and each of their events restarts the retries of a failing read
// (DQ-109). So these pages get no events until the test lets the stream connect.
async function holdLiveEvents(page: Page): Promise<() => Promise<void>> {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/stream*", async (route) => {
    await held;
    await route.continue();
  });
  return async () => {
    const connected = page.waitForResponse("**/api/stream*");
    release();
    await connected;
  };
}

// DQ-104. The wait ends once, so an event cannot close an open form.
test("a live event during a failed read keeps the Create form and the typed text", async ({
  page,
}) => {
  const connectLiveEvents = await holdLiveEvents(page);
  await page.goto("/bots");
  const create = page.getByRole("main").getByRole("link", { name: "Create" });
  await create.click();
  await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/bots$/);

  const skillReads = await failSkillReads(page);
  await create.click();
  const name = page.getByLabel("Name", { exact: true });
  await expect(name).toBeVisible({ timeout: 20_000 });
  await name.fill("Typed by the owner");

  await connectLiveEvents();
  const before = skillReads.count();
  await makeBot(`Event ${tagged()}`);
  await expect.poll(skillReads.count).toBeGreaterThan(before);
  await expect(name).toHaveValue("Typed by the owner");
  // The event read fails too, and its first failure must not change the form.
  await expect.poll(skillReads.count).toBeGreaterThan(before + 1);
  await expect(name).toHaveValue("Typed by the owner");
});

// DQ-104. Create invalidates the lists, so the old wait closed the form before the move.
test("Create from a second Clone moves to the new bot when a read keeps failing", async ({
  page,
}) => {
  const bot = await makeBot(`Moves ${tagged()}`);
  await holdLiveEvents(page);
  const openClone = async () => {
    const actions = page.getByRole("button", { name: `${bot.name} actions`, exact: true });
    await page.getByTestId("bot-card").filter({ has: actions }).hover();
    await actions.click();
    await page.getByRole("menuitem", { name: "Clone" }).click();
  };
  await page.goto("/bots");
  await openClone();
  await expect(page.getByText(`Cloning ${bot.name}`)).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/bots$/);

  await failSkillReads(page);
  await openClone();
  await expect(page.getByText(`Cloning ${bot.name}`)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Create", exact: true }).click();
  // Create waits for its refresh of the skill list, so the move comes when the retries end (DQ-108).
  await expect(page.getByText(`Created ${bot.name} (copy) ✨`)).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/bots\/(?!new)[^/?]+/);
});
