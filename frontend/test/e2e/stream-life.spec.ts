import { expect, type Page, test } from "@playwright/test";
import { createClient } from "../../src/lib/api/generated/client/index.ts";
import {
  createBot,
  createSkill,
  deprecateSkill,
  listSkillVersions,
  trashSkill,
} from "../../src/lib/api/generated/sdk.gen.ts";

// realtime-events.md §3, "Stream life" (audit of 2026-11-05, row 14). The browser allows six
// connections for each host, so only a visible tab holds the stream.
//
// Headless Chromium does not hide a tab that is in the background: `visibilityState` stays
// `visible`. So the tests set it and send `visibilitychange`, as the browser does for a tab in
// the background. The event bubbles to `window`, where TanStack Query listens for it. The rules for each order are in the unit tests (`stream-life.test.ts`,
// `start.test.ts`); these tests prove the result in a real browser.

function apiClient() {
  const origin = test.info().project.use.baseURL ?? "";
  return createClient({ baseUrl: origin, headers: { origin } });
}

function botBody() {
  const tag = `${Date.now().toString(36)}${String(Math.floor(Math.random() * 1000))}`;
  const name = `Stream ${tag}`;
  return {
    name,
    description: `The ${name} bot.`,
    persona_md: `You are ${name}.`,
    avatar_style: "flat" as const,
    avatar_colour: "#6FA8FF",
    model_id: "fake:scripted",
    pins: [],
  };
}

async function makeBot(): Promise<{ name: string }> {
  const created = await createBot({
    client: apiClient(),
    headers: { "idempotency-key": crypto.randomUUID() },
    body: botBody(),
  });
  expect(created.response?.status, JSON.stringify(created.error)).toBe(201);
  if (created.data === undefined) throw new Error("no bot");
  return created.data;
}

async function setVisible(page: Page, visible: boolean) {
  await page.evaluate(
    (state) => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
      document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
    },
    visible ? "visible" : "hidden",
  );
}

const botLink = (page: Page, bot: { name: string }) =>
  page.getByRole("link", { name: bot.name, exact: true });

test("seven tabs: a save in the seventh tab gets its answer", async ({ context }) => {
  const bot = await makeBot();
  let last: Page | undefined;
  for (let tab = 1; tab <= 7; tab += 1) {
    const page = await context.newPage();
    const stream = page.waitForResponse("**/api/stream");
    await page.goto("/bots");
    await expect(botLink(page, bot), `tab ${String(tab)}`).toBeVisible();
    expect((await stream).status()).toBe(200);
    // The owner opens the next tab, so this one goes to the background.
    if (tab < 7) await setVisible(page, false);
    last = page;
  }
  if (last === undefined) throw new Error("no tab");
  // A save from the page itself, so it uses the connections of the browser.
  const body = botBody();
  const status = await last.evaluate(async (json) => {
    const response = await fetch("/api/bots", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: json,
    });
    return response.status;
  }, JSON.stringify(body));
  expect(status).toBe(201);
  // The seventh tab holds the stream, so the new bot shows with no action.
  await expect(botLink(last, body)).toBeVisible();
});

// This test does not prove the read after `ready` (rule 4): TanStack Query's own read on the
// return shows the change too. The next test proves rule 4.
test("a tab that was hidden opens a new stream when it returns", async ({ page }) => {
  const first = await makeBot();
  const stream = page.waitForResponse("**/api/stream");
  await page.goto("/bots");
  await expect(botLink(page, first)).toBeVisible();
  await stream;

  await setVisible(page, false);
  const whileHidden = await makeBot();
  const newStream = page.waitForResponse("**/api/stream");
  await setVisible(page, true);
  expect((await newStream).status()).toBe(200);
  await expect(botLink(page, whileHidden)).toBeVisible();

  // The new stream is live: a later change shows with no action in the tab.
  const later = await makeBot();
  await expect(botLink(page, later)).toBeVisible();
});

// DQ-180. The read after `ready` also reads the source of an open Clone again. The source is
// in Trash by then, so that read finds nothing. The editor and the typed text stay.
test("a Clone draft stays when the tab returns after its source went to Trash", async ({
  page,
}) => {
  const tag = `${Date.now().toString(36)}${String(Math.floor(Math.random() * 1000))}`;
  const made = await createSkill({
    client: apiClient(),
    headers: { "idempotency-key": crypto.randomUUID() },
    body: {
      slug: `stream-${tag}`,
      name: `Stream ${tag}`,
      description: "Use this skill when a tab returns.",
      body_md: "## Steps\n1. Read the brief.",
    },
  });
  expect(made.response?.status, JSON.stringify(made.error)).toBe(201);
  if (made.data === undefined) throw new Error("no skill");
  const skill = made.data;
  const versions = await listSkillVersions({ client: apiClient(), path: { id: skill.id } });
  const [version] = versions.data ?? [];
  if (version === undefined) throw new Error("no version");

  const stream = page.waitForResponse("**/api/stream");
  await page.goto(`/skills/new?from=${version.id}`);
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(`${skill.name} (copy)`);
  await stream;
  const description = page.getByLabel("Description", { exact: true });
  await description.fill("My draft, not saved.");

  await setVisible(page, false);
  const deprecated = await deprecateSkill({
    client: apiClient(),
    path: { id: skill.id },
    body: { remove_bot_ids: [], row_version: skill.row_version },
  });
  expect(deprecated.response?.status, JSON.stringify(deprecated.error)).toBe(200);
  if (deprecated.data === undefined) throw new Error("no deprecated skill");
  const trashed = await trashSkill({
    client: apiClient(),
    path: { id: skill.id },
    body: { row_version: deprecated.data.row_version },
  });
  expect(trashed.response?.status, JSON.stringify(trashed.error)).toBe(200);

  // The read after `ready` starts with the list of skills, which no longer has the source.
  const newStream = page.waitForResponse("**/api/stream");
  const listRead = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/skills" && r.request().method() === "GET",
  );
  await setVisible(page, true);
  await newStream;
  await listRead;
  // Time for the page to close the editor, when it does.
  await page.waitForTimeout(500);
  await expect(description, "the draft after the return").toHaveValue("My draft, not saved.");
});

// Rule 4. A change that comes after TanStack Query's read on the return, and before the new
// stream is live, is in no read and in no event. Only the read after `ready` shows it. The
// test holds the new stream's request to make that gap. It runs alone: a bot event of another
// test also reads the list again, and then the test passes with no read after `ready`.
test(
  "a change between the read on the return and the new stream shows after ready",
  {
    tag: "@alone",
  },
  async ({ page }) => {
    const first = await makeBot();
    const stream = page.waitForResponse("**/api/stream");
    await page.goto("/bots");
    await expect(botLink(page, first)).toBeVisible();
    await stream;
    await setVisible(page, false);

    let release = (): void => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/stream", async (route) => {
      await held;
      await route.continue();
    });
    const readOnReturn = page.waitForResponse(
      (r) => new URL(r.url()).pathname === "/api/bots" && r.request().method() === "GET",
    );
    await setVisible(page, true);
    await readOnReturn;

    // The read on the return has its answer, and the new stream is not open yet.
    const inGap = await makeBot();
    const newStream = page.waitForResponse("**/api/stream");
    release();
    expect((await newStream).status()).toBe(200);
    await expect(botLink(page, inGap), "after ready").toBeVisible();
  },
);

test("a stream that the browser stops for good comes back after the wait", async ({ page }) => {
  const first = await makeBot();
  let streams = 0;
  await page.route("**/api/stream", async (route) => {
    streams += 1;
    // An HTTP error is final for EventSource: it does not try again.
    if (streams === 1) await route.fulfill({ status: 502, body: "" });
    else await route.continue();
  });
  const failed = page.waitForResponse((r) => r.url().endsWith("/api/stream") && r.status() === 502);
  const back = page.waitForResponse((r) => r.url().endsWith("/api/stream") && r.status() === 200);
  await page.goto("/bots");
  await expect(botLink(page, first)).toBeVisible();
  await failed;
  await back;

  const later = await makeBot();
  await expect(botLink(page, later)).toBeVisible();
});
