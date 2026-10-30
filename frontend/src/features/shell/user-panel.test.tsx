import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderApp } from "../../../test/render-app.tsx";

// Expanded, the trigger is named by the visible name "Sir"; collapsed, by "Sir · Menu".
const OWNER_MENU = /^Sir( · Menu)?$/;

const MENU_ITEMS = ["Manage bots", "Manage skills", "Statistics", "Settings"];

const trigger = () => screen.getByRole("button", { name: OWNER_MENU });
const highlighted = (item: HTMLElement | undefined) =>
  item !== undefined && item.hasAttribute("data-highlighted") && document.activeElement === item;

// M0 AC11, UI-1.20, UI-1.21 (user-panel.md §2).
describe("user panel menu", () => {
  it("opens with a click and lists only the pages that exist", async () => {
    const user = userEvent.setup();
    await renderApp("/");
    await user.click(trigger());
    const menu = await screen.findByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(MENU_ITEMS);
  });

  it("opens with Enter, moves with the arrow keys, and Esc puts the focus back on the avatar", async () => {
    const user = userEvent.setup();
    await renderApp("/");
    trigger().focus();
    await user.keyboard("{Enter}");
    const menu = await screen.findByRole("menu");
    const items = within(menu).getAllByRole("menuitem");
    await waitFor(() => {
      expect(highlighted(items[0])).toBe(true);
    });
    await user.keyboard("{ArrowDown}");
    await waitFor(() => {
      expect(highlighted(items[1])).toBe(true);
    });
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    expect(document.activeElement).toBe(trigger());
  });

  it("closes after a page is chosen, and opens that page", async () => {
    const user = userEvent.setup();
    const { router } = await renderApp("/");
    await user.click(trigger());
    await user.click(await screen.findByRole("menuitem", { name: "Manage bots" }));
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    expect(router.state.location.pathname).toBe("/bots");
  });

  it("marks the current page", async () => {
    const user = userEvent.setup();
    await renderApp("/skills");
    await user.click(trigger());
    const menu = await screen.findByRole("menu");
    const current = within(menu)
      .getAllByRole("menuitem")
      .filter((item) => item.getAttribute("aria-current") === "page");
    expect(current.map((item) => item.textContent)).toEqual(["Manage skills"]);
  });

  it("collapses with Ctrl+B and opens with the name as the menu header", async () => {
    const user = userEvent.setup();
    await renderApp("/");
    expect(screen.getByRole("region", { name: "Home Sweet Home" })).toBeTruthy();
    await user.keyboard("{Control>}b{/Control}");
    expect(screen.queryByRole("region", { name: "Home Sweet Home" })).toBeNull();
    await user.click(trigger());
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("Sir", { selector: "div" })).toBeTruthy();
  });
});
