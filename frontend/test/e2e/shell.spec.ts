import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { watchCsp } from "./csp.ts";

// Expanded, the trigger is named by the visible name "Sir"; collapsed, by "Sir · Menu".
const OWNER_MENU = /^Sir( · Menu)?$/;

// M0 AC1 and the shell of the M0c plan §2.
test.describe("app shell", () => {
  test("shows the rail with the New project tile, the empty header and bar 2", async ({ page }) => {
    const violations = await watchCsp(page);
    await page.goto("/");
    const newProject = page.getByRole("button", { name: "New project" });
    await expect(newProject).toHaveAttribute("aria-disabled", "true");
    await expect(newProject).toHaveCSS("opacity", "0.4");
    await newProject.hover();
    // Base UI tooltips are visual; the reason is also the button's accessible description.
    await expect(page.getByText("Projects are not available yet")).toBeVisible();

    const header = page.getByRole("banner", { name: "Bots" });
    await expect(header.getByRole("link", { name: /Hey, add your bot here/ })).toBeVisible();
    await expect(page.getByRole("region", { name: "Home Sweet Home" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
    expect(await violations()).toEqual([]);
  });

  test("keeps the header and the left bar in place while a long page scrolls", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      const tall = document.createElement("div");
      tall.style.height = "5000px";
      document.querySelector("main")?.append(tall);
    });
    const header = page.locator("header");
    const leftBar = page.getByTestId("left-bar");
    const panel = page.getByRole("button", { name: OWNER_MENU });
    const before = [
      await header.boundingBox(),
      await leftBar.boundingBox(),
      await panel.boundingBox(),
    ];
    await page.locator("main").hover();
    await page.mouse.wheel(0, 3000);
    await expect
      .poll(() => page.locator("main").evaluate((main) => main.scrollTop))
      .toBeGreaterThan(1000);
    const after = [
      await header.boundingBox(),
      await leftBar.boundingBox(),
      await panel.boundingBox(),
    ];
    expect(after).toEqual(before);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  for (const [path, title] of [
    ["/bots", "Bots"],
    ["/bots/new", "Create bot"],
    ["/bots/ba", "Bot"],
    ["/skills", "Skills"],
    ["/stats", "Statistics"],
    ["/settings", "Settings"],
    ["/c/conv_01h455vb4pex5vsknk084sn02q", "Conversation"],
  ] as const) {
    test(`opens ${path} directly and after a reload`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await page.reload();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    });
  }

  test("shows Page not found for an unknown page, a conversation id of the wrong kind and an unknown skill", async ({
    page,
  }) => {
    for (const path of [
      "/no/such/page",
      "/c/bot_01h455vb4pex5vsknk084sn02q",
      "/c/123",
      "/skills/no-such-skill",
    ]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
    }
  });

  test("keeps an unknown API path an API error", async ({ request }) => {
    const response = await request.get("/api/no-such-endpoint");
    expect(response.status()).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "not_found" } });
  });

  test("marks the add slot active on the Create bot page", async ({ page }) => {
    await page.goto("/bots/new");
    await expect(page.getByRole("link", { name: /Hey, add your bot here/ })).toBeVisible();
    // The active dashed slot (dashed-slot.md §1): `primary` text.
    await expect(page.getByRole("banner").getByText("Hey, add your bot here 👋")).toHaveClass(
      /text-primary/,
    );
  });

  test("has no axe violations, with bar 2 shown and hidden", async ({ page }) => {
    await page.goto("/");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.keyboard.press("Control+b");
    await expect(page.getByRole("region", { name: "Home Sweet Home" })).toBeHidden();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

  test("looks as agreed (Command dark)", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot("shell-command-dark.png");
  });
});
