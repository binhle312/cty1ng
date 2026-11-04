import { expect, type Page } from "@playwright/test";

// The bot cards after a skill save (skills-page.md §7). Test files share one database, so a test
// that makes a skill may or may not find bots: with a bot, the card shows in place of the toast.
// Tests that are not about the cards skip them: no bot changes.
// Without a name, any new skill's card or toast (a Clone names its copy).
export async function skipAssignCard(page: Page, skillName?: string): Promise<void> {
  const card = page.getByRole("dialog", {
    name:
      skillName === undefined
        ? /^Created ✨ Add .+ to bots\?$/
        : `Created ✨ Add ${skillName} to bots?`,
  });
  const toast = page.getByText(
    skillName === undefined ? /^Created .+ ✨$/ : `Created ${skillName} ✨`,
  );
  await expect(card.or(toast)).toBeVisible();
  if (await card.isVisible()) await card.getByRole("button", { name: "Skip" }).click();
  await expect(card).toBeHidden();
}

export async function skipUpgradeCard(page: Page, version: number): Promise<void> {
  const v = String(version);
  const card = page.getByRole("dialog", {
    name: `Saved v${v} ✨ Also upgrade these bots to v${v}?`,
  });
  // Exact: the card's title holds the toast's words too.
  await expect(card.or(page.getByText(`Saved v${v} ✨`, { exact: true }))).toBeVisible();
  if (await card.isVisible()) await card.getByRole("button", { name: "Skip" }).click();
  await expect(card).toBeHidden();
}
