import { expect, test } from "@playwright/test";
import { DEV_API_PORT } from "../../playwright.config.ts";
import { watchCsp } from "./csp.ts";

// The OpenAPI docs page in APP_ENV=dev, under the real CSP (security.md §2.1, §2.10).
test("the OpenAPI docs page loads with no CSP violation", async ({ page }) => {
  const violations = await watchCsp(page);
  await page.goto(`http://127.0.0.1:${String(DEV_API_PORT)}/api/docs`);
  await expect(page.getByText("/api/health")).toBeVisible();
  expect(await violations()).toEqual([]);
});

test("the production build has no docs page", async ({ request }) => {
  expect((await request.get("/api/docs")).status()).toBe(404);
});
