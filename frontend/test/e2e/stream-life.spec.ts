import { expect, type Page, test } from "@playwright/test";
import { createClient } from "../../src/lib/api/generated/client/index.ts";
import { createBot } from "../../src/lib/api/generated/sdk.gen.ts";

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

test("a tab that was hidden opens a new stream and shows what changed", async ({ page }) => {
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
