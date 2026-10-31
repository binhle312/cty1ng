import { expect, test } from "@playwright/test";
import { watchCsp } from "./csp.ts";

// The first-use journey (testing.md §3, J1 in requirements/product-brief.md). Each slice adds
// its steps; M1 builds the "create skill" part of step 1. The servers can keep one database
// between runs (`pnpm e2e:serve`), so the skill gets its own slug each run.
test("J1 step 1: create a skill", async ({ page }) => {
  const violations = await watchCsp(page);
  const tag = Date.now().toString(36);
  await page.goto("/");
  await page.getByRole("button", { name: /^Sir( · Menu)?$/ }).click();
  await page.getByRole("menuitem", { name: "Manage skills" }).click();
  await page.getByRole("link", { name: "Create", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill(`Write user stories ${tag}`);
  await expect(page.getByLabel("Slug", { exact: true })).toHaveValue(`write-user-stories-${tag}`);
  await page
    .getByLabel("Description", { exact: true })
    .fill("Use this skill when the owner asks for user stories.");
  await page
    .getByLabel("Body", { exact: true })
    .fill("## Steps\n1. Read the brief.\n2. Write one story for each goal.");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page).toHaveURL(`/skills/write-user-stories-${tag}`);
  await expect(page.getByRole("main").getByRole("heading", { level: 2 }).first()).toHaveText(
    `Write user stories ${tag}`,
  );
  // Next (M2): create bot BA with this skill, then a conversation (M3).
  expect(await violations()).toEqual([]);
});
