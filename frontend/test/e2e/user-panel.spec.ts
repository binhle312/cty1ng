import { expect, test, type Page } from "@playwright/test";

// Expanded, the trigger is named by the visible name "Sir"; collapsed, by "Sir · Menu".
const OWNER_MENU = /^Sir( · Menu)?$/;

// M0 AC11: UI-1.20 and UI-1.21 (user-panel.md §2).
const ITEMS = ["Manage bots", "Manage skills", "Statistics", "Settings"];
const avatar = (page: Page) => page.getByRole("button", { name: OWNER_MENU });

async function expectMenu(page: Page): Promise<void> {
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem")).toHaveText(ITEMS);
}

test.describe("user panel menu", () => {
  test("opens with a click, above the panel", async ({ page }) => {
    await page.goto("/");
    await avatar(page).click();
    await expectMenu(page);
    const menuBox = await page.getByRole("menu").boundingBox();
    const avatarBox = await avatar(page).boundingBox();
    expect((menuBox?.y ?? 0) + (menuBox?.height ?? 0)).toBeLessThanOrEqual(avatarBox?.y ?? 0);
  });

  test("opens with Enter, moves with the arrow keys and closes with Esc, focus back on the avatar", async ({
    page,
  }) => {
    await page.goto("/");
    await avatar(page).focus();
    await page.keyboard.press("Enter");
    await expectMenu(page);
    await expect(page.getByRole("menuitem", { name: "Manage bots" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: "Manage skills" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toBeHidden();
    await expect(avatar(page)).toBeFocused();
  });

  test("opens a page and marks it in the menu", async ({ page }) => {
    await page.goto("/");
    await avatar(page).click();
    await page.getByRole("menuitem", { name: "Statistics" }).click();
    await expect(page).toHaveURL(/\/stats$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Statistics");
    await expect(page.getByRole("menu")).toBeHidden();
    await avatar(page).click();
    await expect(page.getByRole("menuitem", { name: "Statistics" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("collapsed: focus shows 'Sir · Menu' and the menu opens to the right with the name", async ({
    page,
  }) => {
    await page.goto("/");
    await page.keyboard.press("Control+b");
    await expect(page.getByRole("region", { name: "Home Sweet Home" })).toBeHidden();
    // Keyboard focus, as the owner reaches it: Home tile, New project tile, then the avatar.
    for (let i = 0; i < 3; i += 1) await page.keyboard.press("Tab");
    await expect(avatar(page)).toBeFocused();
    // UI-1.21: the tooltip shows within 300 ms.
    await expect(page.getByText("Sir · Menu", { exact: true })).toBeVisible({ timeout: 300 });
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByText("Sir", { exact: true })).toBeVisible();
    const menuBox = await menu.boundingBox();
    const avatarBox = await avatar(page).boundingBox();
    expect(menuBox?.x ?? 0).toBeGreaterThanOrEqual((avatarBox?.x ?? 0) + (avatarBox?.width ?? 0));
  });

  test("keeps the hidden bar after a reload", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+b");
    await page.reload();
    await expect(page.getByRole("region", { name: "Home Sweet Home" })).toBeHidden();
  });
});

test.describe("on a touch screen", () => {
  test.use({ hasTouch: true });

  test("a tap opens the menu", async ({ page }) => {
    await page.goto("/");
    await avatar(page).tap();
    await expectMenu(page);
  });
});
