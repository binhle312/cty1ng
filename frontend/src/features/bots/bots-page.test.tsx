import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { fakeApi } from "../../../test/fake-api.ts";
import { BOT_SETTINGS, makeBot } from "../../../test/fixtures.ts";
import { renderApp } from "../../../test/render-app.tsx";

// The Pinned group of the Bots page (bots-page.md §6, pin.md §2): the keyboard moves a pinned
// card, and an unpin during a search keeps the pins the search hides.
const BA = makeBot(1, "BA", [], { pinned_position: 1 });
const QA = makeBot(2, "QA", [], { pinned_position: 2 });
const UX = makeBot(3, "UX");

function api() {
  return fakeApi({
    "GET /api/settings": () => ({ body: BOT_SETTINGS }),
    "GET /api/bots": () => ({ body: [BA, QA, UX] }),
    "PUT /api/bots/pins": () => ({ body: { bot_ids: [] } }),
  });
}

const sentPins = (fake: ReturnType<typeof api>) =>
  fake.sent("PUT", "/api/bots/pins").map((request) => request.body);

describe("the Pinned group of the Bots page", () => {
  let fake: ReturnType<typeof api> | null = null;
  afterEach(() => {
    fake?.restore();
    fake = null;
  });

  it("moves a focused pinned card with Alt+→", async () => {
    fake = api();
    await renderApp("/bots");
    const card = await screen.findByRole("link", { name: "BA" }, { timeout: 5000 });
    act(() => {
      card.focus();
      fireEvent.keyDown(card, { key: "ArrowRight", altKey: true });
    });
    await waitFor(() => {
      expect(sentPins(fake ?? api())).toEqual([
        { bot_ids: [QA.id, BA.id], expected_bot_ids: [BA.id, QA.id] },
      ]);
    });
  });

  it("keeps the pins a search hides when a bot is unpinned", async () => {
    fake = api();
    await renderApp("/bots");
    const search = await screen.findByRole("searchbox", { name: "Search bots" }, { timeout: 5000 });
    act(() => {
      fireEvent.change(search, { target: { value: "BA" } });
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Unpin BA" }));
    });
    await waitFor(() => {
      expect(sentPins(fake ?? api())).toEqual([
        { bot_ids: [QA.id], expected_bot_ids: [BA.id, QA.id] },
      ]);
    });
  });
});
