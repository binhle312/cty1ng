import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { fakeApi } from "../../../test/fake-api.ts";
import { makeBot } from "../../../test/fixtures.ts";
import { renderApp } from "../../../test/render-app.tsx";

// The gear of the header bot card (bot-card.md §1) opens the bot page on its Profile tab, whose
// URL has no `tab` (bot-page.md, URLs).
describe("the header bot card", () => {
  let api: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    api?.restore();
    api = null;
  });

  it("links its gear to the bot page with no tab, in a new tab", async () => {
    const ba = makeBot(1, "BA");
    api = fakeApi({ "GET /api/bots": () => ({ body: [ba] }) });
    await renderApp("/");
    // The roster is a lazy chunk: its first import in a test run takes a while.
    const [avatar] = await screen.findAllByTestId("header-bot", {}, { timeout: 5000 });
    if (avatar === undefined) throw new Error("no header avatar");
    act(() => {
      fireEvent.click(within(avatar).getByRole("button"));
    });
    const card = await screen.findByRole("dialog", { name: "BA" });
    const gear = within(card).getByRole("link", { name: "BA settings, opens in a new tab" });
    expect(gear.getAttribute("href")).toBe(`/bots/${ba.slug}`);
    expect(gear.getAttribute("target")).toBe("_blank");
  });
});
