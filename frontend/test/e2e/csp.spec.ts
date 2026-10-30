import { expect, test } from "@playwright/test";
import { watchCsp } from "./csp.ts";

// Expanded, the trigger is named by the visible name "Sir"; collapsed, by "Sir · Menu".
const OWNER_MENU = /^Sir( · Menu)?$/;

// security.md §2.1: the built app runs under the CSP with no violation, also while menus,
// tooltips and lazy pages load (M0c plan, risk "CSP").
test("the shell runs under the CSP with no violation", async ({ page }) => {
  const violations = await watchCsp(page);
  const response = await page.goto("/");
  expect(response?.headers()["content-security-policy"]).toContain("default-src 'self'");
  await page.getByRole("button", { name: "Home menu" }).click();
  await page.keyboard.press("Escape");
  // The menu's backdrop takes pointer events until its close animation ends.
  await expect(page.getByRole("menu")).toBeHidden();
  await page.getByRole("button", { name: "New project" }).hover();
  await page.getByRole("button", { name: OWNER_MENU }).click();
  await page.getByRole("menuitem", { name: "Statistics" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Statistics");
  expect(await violations()).toEqual([]);
});
