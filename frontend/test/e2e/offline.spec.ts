import { expect, type Page, test } from "@playwright/test";
import { createClient } from "../../src/lib/api/generated/client/index.ts";
import { createBot } from "../../src/lib/api/generated/sdk.gen.ts";
import { skipAssignCard, skipUpgradeCard } from "./skill-cards.ts";

// DQ-088 (frontend-conventions.md §5, "Reads when the browser says offline"). The app runs on
// 127.0.0.1, so an `offline` event in the browser does not stop the backend. After the event,
// each page still reads its data and each save still runs. The tests move with links inside the
// app: a reload would end the offline state. The servers keep one database for every file, so
// each test makes its own bot and skill.

function apiClient() {
  const origin = test.info().project.use.baseURL ?? "";
  return createClient({ baseUrl: origin, headers: { origin } });
}

function tagged(): string {
  return `${Date.now().toString(36)}${String(Math.floor(Math.random() * 1000))}`;
}

async function makeBot(name: string): Promise<{ slug: string; name: string }> {
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

test("after an offline event, the bot pages read their data and the saves run", async ({
  page,
}) => {
  const bot = await makeBot(`Offline ${tagged()}`);
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^Sir( · Menu)?$/ })).toBeVisible();
  await goOffline(page);

  // The Bots page, then the bot page: first visits after the event.
  await openPage(page, "Manage bots");
  await page.getByRole("link", { name: bot.name, exact: true }).click();
  await expect(page.getByRole("heading", { name: bot.name, level: 1 })).toBeVisible();

  // A save on the bot page.
  await fill(page, { label: "Description", text: "Works when the browser says offline." });
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("No changes. Edits apply from the next run.")).toBeVisible();

  // A Clone from the Bots page, and its Create.
  await openPage(page, "Manage bots");
  await page.getByRole("button", { name: `${bot.name} actions` }).click();
  await page.getByRole("menuitem", { name: "Clone" }).click();
  // A Clone opens on its last step, Model.
  await expect(page.getByRole("heading", { name: "New bot", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByText(`Created ${bot.name} (copy) ✨`)).toBeVisible();
});

test("after an offline event, the skill pages read their data and the saves run", async ({
  page,
}) => {
  const tag = tagged();
  const skill = { name: `Offline ${tag}`, slug: `offline-${tag}` };
  await page.goto("/skills/new");
  await fill(page, { label: "Name", text: skill.name });
  await fill(page, { label: "Description", text: "Use this skill when the browser says offline." });
  await fill(page, { label: "Body", text: "## Steps\n1. Read the brief." });
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await skipAssignCard(page, skill.name);
  await expect(page).toHaveURL(`/skills/${skill.slug}`);

  // A reload empties the cache, so each page below is a first visit after the event.
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^Sir( · Menu)?$/ })).toBeVisible();
  await goOffline(page);

  // The Skills page, then the skill page.
  await openPage(page, "Manage skills");
  await page.getByRole("link", { name: new RegExp(skill.name) }).click();
  await expect(page).toHaveURL(`/skills/${skill.slug}`);

  // A save on the skill page.
  await page.getByRole("tab", { name: "Write" }).click();
  await fill(page, { label: "Body", text: "## Steps\n1. Read the brief.\n2. Write it down." });
  await page.getByRole("button", { name: "Save as v2" }).click();
  await skipUpgradeCard(page, 2);

  // A Clone of the skill, and its Create.
  await page.getByRole("button", { name: "Skill actions" }).click();
  await page.getByRole("menuitem", { name: "Clone" }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(`${skill.name} (copy)`);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await skipAssignCard(page, `${skill.name} (copy)`);
  await expect(page).toHaveURL(`/skills/${skill.slug}-copy`);

  // The new-skill form.
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("");
});

test("after an offline event, a read that keeps failing shows the error state", async ({
  page,
}) => {
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

  // The first try and TanStack Query's 3 retries run, about 7 s, and none of them pauses.
  await openPage(page, "Manage skills");
  await expect(page.getByText("The app could not load the skills.").first()).toBeVisible({
    timeout: 20_000,
  });
  expect(reads - before).toBe(4);
});
