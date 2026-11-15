import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { watchCsp } from "./csp.ts";

// The error screen keeps the shell (requirements/app-shell.md, "Errors"; P3 list item 65). The
// code of the Skills page is a lazy chunk; the test makes its load fail, as a lost connection or
// a new build would.
const SKILLS_CHUNK = /\/assets\/skills\.lazy-[^/]+\.js$/;

async function failSkillsChunk(page: Page) {
  let failing = true;
  await page.route(SKILLS_CHUNK, (route) => (failing ? route.abort() : route.fallback()));
  return () => {
    failing = false;
  };
}

test.describe("the error screen", () => {
  test("shows in the shell when a page's code fails, and Try again loads the page", async ({
    page,
  }) => {
    const violations = await watchCsp(page);
    const chunkBack = await failSkillsChunk(page);
    await page.goto("/skills");
    const alert = page.getByRole("alert");
    await expect(alert.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Projects" })).toBeVisible();
    await expect(page.getByRole("banner", { name: "Bots" })).toBeVisible();
    chunkBack();
    await alert.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("navigation", { name: "Skills" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeHidden();
    expect(await violations()).toEqual([]);
  });

  test("has no axe violations in the light mode", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await failSkillsChunk(page);
    await page.goto("/skills");
    await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations, "light").toEqual([]);
  });

  test("has no axe violations in the dark mode", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await failSkillsChunk(page);
    await page.goto("/skills");
    await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations, "dark").toEqual([]);
  });
});
