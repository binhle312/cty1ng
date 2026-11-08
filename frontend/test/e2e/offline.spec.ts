import { expect, type Page, test } from "@playwright/test";
import { z } from "zod";
import { createClient } from "../../src/lib/api/generated/client/index.ts";
import { createBot, createSkill } from "../../src/lib/api/generated/sdk.gen.ts";
import { skipAssignCard, skipUpgradeCard } from "./skill-cards.ts";

// DQ-088 (frontend-conventions.md §5, "A browser that says it is offline"). The app runs on
// 127.0.0.1, so an `offline` event in the browser does not stop the backend. After the event,
// each page still reads its data and each save still runs.
//
// Each test checks one step (DQ-117). It opens the page online, sends the event just before the
// step, and checks only that step, so each test fails alone without the fix. The tests move with
// links inside the app: a reload would end the offline state. The servers keep one database for
// every file, so each test makes its own bot and skill.
//
// Steps with no test, because they read no new data after the event: the Bots page and the
// skill's Bots tab (the header already read the bot list), the bot's Skills tab (its data comes
// with the bot), and the new-skill form (it reads nothing). The Create of a bot Clone has no test
// either: it calls the API without TanStack Query (`create-bot-page.tsx`), so the event never
// stopped it.

function apiClient() {
  const origin = test.info().project.use.baseURL ?? "";
  return createClient({ baseUrl: origin, headers: { origin } });
}

function tagged(): string {
  return `${Date.now().toString(36)}${String(Math.floor(Math.random() * 1000))}`;
}

async function makeSkill(): Promise<{ id: string; slug: string; name: string }> {
  const tag = tagged();
  const created = await createSkill({
    client: apiClient(),
    headers: { "idempotency-key": crypto.randomUUID() },
    body: {
      slug: `offline-${tag}`,
      name: `Offline ${tag}`,
      description: "Use this skill when the browser says offline.",
      body_md: "## Steps\n1. Read the brief.",
    },
  });
  expect(created.response?.status, JSON.stringify(created.error)).toBe(201);
  if (created.data === undefined) throw new Error("no skill");
  return { id: created.data.id, slug: created.data.slug, name: created.data.name };
}

async function makeBot(skillId?: string): Promise<{ slug: string; name: string }> {
  const name = `Offline ${tagged()}`;
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
      pins: skillId === undefined ? [] : [{ skill_id: skillId, always_load: false }],
    },
  });
  expect(created.response?.status, JSON.stringify(created.error)).toBe(201);
  if (created.data === undefined) throw new Error("no bot");
  return created.data;
}

// The event that a browser sends when it loses its network. TanStack Query listens for it.
async function goOffline(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
}

async function openPage(page: Page, item: "Manage bots" | "Manage skills") {
  await page.getByRole("button", { name: /^Sir( · Menu)?$/ }).click();
  await page.getByRole("menuitem", { name: item }).click();
}

async function fill(page: Page, { label, text }: { label: string; text: string }) {
  await page.getByLabel(label, { exact: true }).fill(text);
}

async function openSkill(page: Page, slug: string) {
  await page.goto(`/skills/${slug}`);
  await expect(page.getByRole("button", { name: "Skill actions" })).toBeVisible();
}

async function openBot(page: Page, bot: { slug: string; name: string; tab?: string }) {
  await page.goto(`/bots/${bot.slug}${bot.tab ?? ""}`);
  await expect(page.getByRole("heading", { name: bot.name, level: 1 })).toBeVisible();
}

test.describe("bots, after an offline event", () => {
  test("a bot page reads its data", async ({ page }) => {
    const bot = await makeBot();
    await page.goto("/bots");
    await expect(page.getByRole("link", { name: bot.name, exact: true })).toBeVisible();
    await goOffline(page);

    await page.getByRole("link", { name: bot.name, exact: true }).click();
    await expect(page.getByRole("heading", { name: bot.name, level: 1 })).toBeVisible();
  });

  test("a bot save runs", async ({ page }) => {
    const bot = await makeBot();
    await openBot(page, bot);
    await goOffline(page);

    await fill(page, { label: "Description", text: "Works when the browser says offline." });
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("No changes. Edits apply from the next run.")).toBeVisible();
  });

  test("the Add card of the Skills tab reads the skills", async ({ page }) => {
    const skill = await makeSkill();
    const bot = await makeBot();
    await openBot(page, { ...bot, tab: "?tab=skills" });
    await goOffline(page);

    await page.getByRole("button", { name: "Add", exact: true }).click();
    const card = page.getByRole("dialog", { name: `Add skills to ${bot.name}` });
    await card.getByLabel("Search skills").fill(skill.name);
    await expect(card.getByRole("checkbox", { name: new RegExp(skill.name) })).toBeVisible();
  });

  test("an Add from the Skills tab saves the pin", async ({ page }) => {
    const skill = await makeSkill();
    const bot = await makeBot();
    await openBot(page, { ...bot, tab: "?tab=skills" });
    await page.getByRole("button", { name: "Add", exact: true }).click();
    const card = page.getByRole("dialog", { name: `Add skills to ${bot.name}` });
    await card.getByLabel("Search skills").fill(skill.name);
    await card.getByRole("checkbox", { name: new RegExp(skill.name) }).click();
    await goOffline(page);

    await card.getByRole("button", { name: "Add 1" }).click();
    await expect(page.locator(`tr[data-skill="${skill.slug}"]`)).toBeVisible();
  });
});

test.describe("skills, after an offline event", () => {
  test("the Skills page reads the skills", async ({ page }) => {
    const skill = await makeSkill();
    await page.goto("/");
    await expect(page.getByRole("button", { name: /^Sir( · Menu)?$/ })).toBeVisible();
    await goOffline(page);

    await openPage(page, "Manage skills");
    await expect(page.getByRole("link", { name: new RegExp(skill.name) })).toBeVisible();
  });

  test("a skill page reads its data", async ({ page }) => {
    const skill = await makeSkill();
    await page.goto("/skills");
    await expect(page.getByRole("link", { name: new RegExp(skill.name) })).toBeVisible();
    await goOffline(page);

    await page.getByRole("link", { name: new RegExp(skill.name) }).click();
    await expect(page.getByRole("button", { name: "Skill actions" })).toBeVisible();
  });

  test("a skill save runs", async ({ page }) => {
    const skill = await makeSkill();
    await openSkill(page, skill.slug);
    await page.getByRole("tab", { name: "Write" }).click();
    await goOffline(page);

    await fill(page, { label: "Body", text: "## Steps\n1. Read the brief.\n2. Write it down." });
    await page.getByRole("button", { name: "Save as v2" }).click();
    await skipUpgradeCard(page, 2);
  });

  test("the History tab reads the versions", async ({ page }) => {
    const skill = await makeSkill();
    await openSkill(page, skill.slug);
    await goOffline(page);

    await page.getByRole("tab", { name: "History" }).click();
    await expect(page.getByRole("list", { name: "Versions" })).toBeVisible();
  });

  test("an Always load switch on the Bots tab saves", async ({ page }) => {
    const skill = await makeSkill();
    const bot = await makeBot(skill.id);
    await page.goto(`/skills/${skill.slug}?tab=bots`);
    const always = page.getByRole("switch", { name: `Always load for ${bot.name}` });
    await expect(always).toHaveAttribute("aria-checked", "false");
    await goOffline(page);

    // The switch shows the new value at once, so the check reads the saved pin.
    await always.click();
    await expect
      .poll(async () => {
        const bots = z
          .array(
            z.object({ name: z.string(), pins: z.array(z.object({ always_load: z.boolean() })) }),
          )
          .parse(await (await page.request.get("/api/bots")).json());
        return bots.find((row) => row.name === bot.name)?.pins[0]?.always_load;
      })
      .toBe(true);
  });

  test("the Create of a skill Clone runs", async ({ page }) => {
    const skill = await makeSkill();
    await openSkill(page, skill.slug);
    await page.getByRole("button", { name: "Skill actions" }).click();
    await page.getByRole("menuitem", { name: "Clone" }).click();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(`${skill.name} (copy)`);
    await goOffline(page);

    await page.getByRole("button", { name: "Create", exact: true }).click();
    await skipAssignCard(page, `${skill.name} (copy)`);
    await expect(page).toHaveURL(`/skills/${skill.slug}-copy`);
  });

  // A zip of the skill at v1, then the skill at v2: so the zip brings a new version.
  async function zipOneVersionBack(page: Page, slug: string): Promise<string> {
    await openSkill(page, slug);
    await page.getByRole("button", { name: "Skill actions" }).click();
    const downloading = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: "Export" }).click();
    const zipPath = await (await downloading).path();
    await page.getByRole("tab", { name: "Write" }).click();
    await fill(page, { label: "Body", text: "## Steps\n1. Read the brief twice." });
    await page.getByRole("button", { name: "Save as v2" }).click();
    await skipUpgradeCard(page, 2);
    return zipPath;
  }

  async function chooseImport(page: Page, zipPath: string) {
    const choosing = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Import", exact: true }).click();
    await (await choosing).setFiles(zipPath);
    await expect(page).toHaveURL("/skills/import");
  }

  test("the Import page reads the zip", async ({ page }) => {
    const skill = await makeSkill();
    const zipPath = await zipOneVersionBack(page, skill.slug);
    await openPage(page, "Manage skills");
    await goOffline(page);

    await chooseImport(page, zipPath);
    const changed = page.getByRole("region", { name: "New versions of your skills" });
    await expect(changed).toContainText("v2 → v3 · body changed");
  });

  test("an Import Apply runs", async ({ page }) => {
    const skill = await makeSkill();
    const zipPath = await zipOneVersionBack(page, skill.slug);
    await openPage(page, "Manage skills");
    await chooseImport(page, zipPath);
    const changed = page.getByRole("region", { name: "New versions of your skills" });
    await expect(changed).toContainText("v2 → v3 · body changed");
    await goOffline(page);

    await page.getByRole("button", { name: "Apply 1 change" }).click();
    await expect(page.getByText("Imported 1 change ✨ 0 new skills, 1 new version.")).toBeVisible();
  });
});

test("after an offline event, a read that keeps failing shows the error state", async ({
  page,
}) => {
  // Other test files share the server, and each of their live events starts the retries again
  // (DQ-109). So this page gets no events until the end.
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/stream*", async (route) => {
    await held;
    await route.abort();
  });
  let reads = 0;
  await page.route(
    (url) => url.pathname === "/api/skills",
    async (route) => {
      if (route.request().method() !== "GET") return route.fallback();
      reads += 1;
      await route.fulfill({ status: 500, json: { error: { code: "internal" } } });
    },
  );
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^Sir( · Menu)?$/ })).toBeVisible();
  await goOffline(page);
  const before = reads;

  // The first try and TanStack Query's 3 retries run, about 7 s, and none of them pauses. The
  // count follows the default `retry` of `createQueryClient`: change both together.
  await openPage(page, "Manage skills");
  await expect(page.getByText("The app could not load the skills.").first()).toBeVisible({
    timeout: 20_000,
  });
  expect(reads - before).toBe(4);
  release();
});
