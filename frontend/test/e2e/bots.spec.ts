import { expect, type Locator, type Page, test } from "@playwright/test";
import { createClient } from "../../src/lib/api/generated/client/index.ts";
import { createBot, listBots, setPinnedBots } from "../../src/lib/api/generated/sdk.gen.ts";
import { watchCsp } from "./csp.ts";

// The Bots page, the header roster and the avatar parts of the Create page (M2b). The servers
// keep one database for every file, and pins are one list for the whole app, so the tests of
// this file run one after another and each one unpins what it pinned.
test.describe.configure({ mode: "serial" });

// A 40 × 30 PNG of one colour (the same bytes as avatar-upload.spec.ts).
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAACgAAAAeCAMAAABpA6zvAAAAA1BMVEUzZv+f8kW/AAAACXBIWXMAAAPoAAAD6AG1e1Jr" +
    "AAAAEklEQVQ4y2NgGAWjYBSMguEAAATOAAHHK9RWAAAAAElFTkSuQmCC",
  "base64",
);

function apiClient() {
  const origin = test.info().project.use.baseURL ?? "";
  return createClient({ baseUrl: origin, headers: { origin } });
}

// Makes a bot through the API, with the Origin header a browser would send.
async function makeBot(name: string): Promise<void> {
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
}

async function bots() {
  return (await listBots({ client: apiClient(), throwOnError: true })).data;
}

// Unpins every bot, so the next test starts with no pins.
async function unpinAll(): Promise<void> {
  const pinned = (await bots()).filter((bot) => bot.pinned_position !== null).map((b) => b.id);
  if (pinned.length === 0) return;
  await setPinnedBots({
    client: apiClient(),
    body: { bot_ids: [], expected_bot_ids: pinned },
    throwOnError: true,
  });
}

function tagged(): string {
  return Date.now().toString(36).slice(-5);
}

// The last line of a dialog's text is not under its button bar (the sticky bar once rose by
// the popup's padding and hid it, M2b).
async function expectTextAboveButtons(text: Locator, buttons: Locator) {
  const textBox = await text.boundingBox();
  const barBox = await buttons.boundingBox();
  expect(textBox).not.toBeNull();
  expect(barBox).not.toBeNull();
  expect((textBox?.y ?? 0) + (textBox?.height ?? 0)).toBeLessThanOrEqual(barBox?.y ?? 0);
}

test.afterEach(async () => {
  await unpinAll();
});

test("the Bots page searches, pins and deletes a bot to Trash", async ({ page }) => {
  const violations = await watchCsp(page);
  const tag = tagged();
  const keep = `Keep ${tag}`;
  const gone = `Gone ${tag}`;
  await makeBot(keep);
  await makeBot(gone);
  await page.goto("/bots");
  await page.getByLabel("Search bots").fill(tag);
  const cards = page.getByTestId("bot-card");
  await expect(cards).toHaveCount(2);

  // Pin from the card: it moves to Pinned and to the pinned zone of the header.
  const keepCard = cards.filter({ hasText: keep });
  await keepCard.hover();
  await keepCard.getByRole("button", { name: `Pin ${keep} to top` }).click();
  const pinned = page.getByRole("region", { name: "Pinned" });
  await expect(pinned.getByTestId("bot-card").filter({ hasText: keep })).toBeVisible();
  await expect(
    page.getByTestId("pin-zone").getByRole("button", { name: new RegExp(`^${keep}, pinned`) }),
  ).toBeVisible();

  // Delete the other one: an alert, then a toast, and the card goes.
  const goneCard = cards.filter({ hasText: gone });
  await goneCard.hover();
  await goneCard.getByRole("button", { name: `${gone} actions` }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  const dialog = page.getByRole("alertdialog", { name: `Delete ${gone}? 🧹` });
  await expect(dialog).toBeVisible();
  await expectTextAboveButtons(
    dialog.getByText(/The bot goes to Trash/),
    dialog.getByRole("button", { name: "Cancel" }).locator(".."),
  );
  await dialog.getByRole("button", { name: "Delete bot" }).click();
  await expect(page.getByText(`${gone} is in Trash.`)).toBeVisible();
  await expect(cards).toHaveCount(1);
  expect((await bots()).some((bot) => bot.name === gone)).toBe(false);
  expect(await violations()).toEqual([]);
});

test("the colour row, the Custom card and the crop card run under the CSP", async ({ page }) => {
  const violations = await watchCsp(page);
  await page.goto("/bots/new");
  const colours = page.getByRole("group", { name: "Colour" });
  await colours.getByRole("button", { name: "Colour 3" }).click();
  await expect(colours.getByRole("button", { name: "Colour 3" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await colours.getByRole("button", { name: "Custom", exact: true }).click();
  const hex = page.getByLabel("Hex", { exact: true });
  await hex.fill("#123456");
  await page.getByRole("button", { name: "Use", exact: true }).click();
  await expect(colours.getByRole("img", { name: "Custom colour, picked" })).toBeVisible();

  await colours.getByRole("button", { name: "Random colour" }).click();
  await expect(colours.getByRole("img", { name: "Custom colour, picked" })).toBeVisible();

  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("radio", { name: "Upload image" }).click();
  await (await chooser).setFiles({ name: "face.png", mimeType: "image/png", buffer: PNG });
  const crop = page.getByRole("dialog", { name: "Crop the image" });
  await expect(crop).toBeVisible();
  const position = crop.getByRole("group", { name: "Image position. Arrow keys move it." });
  await position.focus();
  await page.keyboard.press("ArrowRight");
  await expectTextAboveButtons(
    crop.getByRole("slider", { name: /Zoom/ }),
    crop.getByRole("button", { name: "Cancel" }).locator(".."),
  );
  await crop.getByRole("button", { name: "Use", exact: true }).click();
  await expect(crop).toBeHidden();
  await expect(page.getByRole("radio", { name: "Your image" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  expect(await violations()).toEqual([]);
});

// The middle 6 columns hold about 12 avatars (top-header.md state 2). With 14 or more, the
// roster scrolls inside the header and the page never scrolls sideways.
test("the header scrolls a long roster and pins a bot by drag", async ({ page }) => {
  const violations = await watchCsp(page);
  const tag = tagged();
  const count = (await bots()).length;
  for (let i = count; i < 14; i += 1) await makeBot(`Many ${tag} ${String(i)}`);
  await page.goto("/skills");
  const header = page.getByRole("banner", { name: "Bots" });
  const roster = header.getByTestId("roster");
  await expect(header.getByTestId("header-bot")).toHaveCount((await bots()).length);
  const sizes = await roster.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
  expect(sizes.scroll).toBeGreaterThan(sizes.client);
  const pageWidth = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(pageWidth.scroll).toBeLessThanOrEqual(pageWidth.client);

  // Keyboard only (UI-2.2, UI-2.10, top-header.md state 5): Tab to an avatar shows its name
  // and the ‹ › buttons, with no pointer in the header.
  await page.mouse.move(700, 600);
  const avatars = header.getByTestId("header-bot").getByRole("button");
  await avatars.first().focus();
  await page.keyboard.press("Tab");
  await expect(avatars.nth(1)).toBeFocused();
  const second = (await bots())[1];
  await expect(page.getByText(`${second?.name ?? ""} · Idle`, { exact: true })).toBeVisible();
  await expect(header.getByRole("button", { name: "Scroll bots right" })).toBeVisible();

  await roster.hover();
  await header.getByRole("button", { name: "Scroll bots right" }).click();
  await expect.poll(() => roster.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  await expect(header.getByRole("button", { name: "Scroll bots left" })).toBeVisible();

  // Drag the first visible avatar of the others onto the pin pill.
  await roster.evaluate((el) => {
    el.scrollLeft = 0;
  });
  await dragToPin(page, header);
  await expect
    .poll(async () => (await bots()).filter((b) => b.pinned_position !== null).length)
    .toBe(1);
  await expect(header.getByTestId("pin-zone").getByTestId("header-bot")).toHaveCount(1);
  expect(await violations()).toEqual([]);
});

async function dragToPin(page: Page, header: Locator) {
  const avatar = header.getByTestId("header-bot").first();
  const zone = header.getByTestId("pin-zone");
  const from = await avatar.boundingBox();
  const to = await zone.boundingBox();
  if (from === null || to === null) throw new Error("The header is not on the screen.");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // Past the 5 px start distance, then in steps, so dnd-kit sees the moves.
  await page.mouse.move(from.x + from.width / 2 - 10, from.y + from.height / 2, { steps: 3 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
}
