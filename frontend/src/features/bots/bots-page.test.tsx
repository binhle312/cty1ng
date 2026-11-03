import { focusManager } from "@tanstack/react-query";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { fakeApi, heldAnswer } from "../../../test/fake-api.ts";
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
    "PUT /api/bots/pins": () => ({ body: { pinned_bot_ids: [] } }),
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

// State table audit (D2): a refresh before the answer showed the old sort again.
describe("the sort of the Others group", () => {
  let fake: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    fake?.restore();
    fake = null;
    act(() => {
      focusManager.setFocused(undefined);
    });
  });

  it("keeps a sort on its way when a refresh lands before its answer", async () => {
    const held = heldAnswer();
    const settings = { ...BOT_SETTINGS, bot_order: "recent", bot_order_direction: "desc" };
    fake = fakeApi({
      "GET /api/settings": () => ({ body: settings }),
      "GET /api/bots": () => ({ body: [BA, QA, UX] }),
      "PATCH /api/settings": async () => {
        const answer = await held.promise;
        return answer;
      },
    });
    await renderApp("/bots");
    await screen.findByRole("link", { name: "BA" }, { timeout: 5000 });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Sort by created time" }));
    });
    await waitFor(() => {
      expect(fake?.sent("PATCH", "/api/settings")).toHaveLength(1);
    });
    const loads = fake.sent("GET", "/api/settings").length;
    act(() => {
      focusManager.setFocused(false);
    });
    act(() => {
      focusManager.setFocused(true);
    });
    await waitFor(() => {
      expect(fake?.sent("GET", "/api/settings").length).toBeGreaterThan(loads);
    });
    await act(() => Promise.resolve());
    expect(screen.getByRole("button", { name: "Sort by created time, newest first" })).toBeTruthy();
    await held.answer({ body: { ...settings, bot_order: "created" } });
  });

  // Fresh review of the audit: the older change, answering last, put its old order back.
  it("keeps a newer sort when an older sort answers after it", async () => {
    const held = heldAnswer();
    const server = { ...BOT_SETTINGS, bot_order: "recent", bot_order_direction: "desc" };
    let patches = 0;
    fake = fakeApi({
      "GET /api/settings": () => ({ body: server }),
      "GET /api/bots": () => ({ body: [BA, QA, UX] }),
      "PATCH /api/settings": async () => {
        patches += 1;
        if (patches === 1) {
          Object.assign(server, { bot_order: "created", bot_order_direction: "desc" });
          const answer = await held.promise;
          return answer;
        }
        Object.assign(server, { bot_order: "created", bot_order_direction: "asc" });
        return { body: server };
      },
    });
    await renderApp("/bots");
    await screen.findByRole("link", { name: "BA" }, { timeout: 5000 });
    await screen.findByRole("button", { name: "Sort by recent activity, newest first" });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Sort by created time" }));
    });
    const newest = await screen.findByRole("button", {
      name: "Sort by created time, newest first",
    });
    act(() => {
      fireEvent.click(newest);
    });
    await waitFor(() => {
      expect(fake?.sent("PATCH", "/api/settings")).toHaveLength(2);
    });
    // The newer sort answers first, and its refresh lands.
    await screen.findByRole("button", { name: "Sort by created time, oldest first" });
    const loads = fake.sent("GET", "/api/settings").length;
    await held.answer({ body: { ...server, bot_order_direction: "desc" } });
    await waitFor(() => {
      expect(fake?.sent("GET", "/api/settings").length).toBeGreaterThan(loads);
    });
    await act(() => Promise.resolve());
    expect(screen.getByRole("button", { name: "Sort by created time, oldest first" })).toBeTruthy();
  });
});

// Fresh review of the audit: the older pin change, answering last, put its old list back.
describe("pin changes that answer out of order", () => {
  let fake: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    fake?.restore();
    fake = null;
  });

  it("keeps a newer pin when an older unpin answers after it", async () => {
    const held = heldAnswer();
    let server = [BA, QA, UX];
    let puts = 0;
    fake = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/bots": () => ({ body: server }),
      "PUT /api/bots/pins": async () => {
        puts += 1;
        if (puts === 1) {
          // The server takes the unpin of BA at once; its answer is slow.
          server = [{ ...BA, pinned_position: null }, { ...QA, pinned_position: 1 }, UX];
          const answer = await held.promise;
          return answer;
        }
        server = [
          { ...BA, pinned_position: null },
          { ...QA, pinned_position: 1 },
          { ...UX, pinned_position: 2 },
        ];
        return { body: { pinned_bot_ids: [QA.id, UX.id] } };
      },
    });
    await renderApp("/bots");
    await screen.findByRole("link", { name: "BA" }, { timeout: 5000 });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Unpin BA" }));
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Pin UX to top" }));
    });
    await waitFor(() => {
      expect(fake?.sent("PUT", "/api/bots/pins")).toHaveLength(2);
    });
    const loads = fake.sent("GET", "/api/bots").length;
    await held.answer({ body: { pinned_bot_ids: [QA.id] } });
    await waitFor(() => {
      expect(fake?.sent("GET", "/api/bots").length).toBeGreaterThan(loads);
    });
    await act(() => Promise.resolve());
    expect(screen.getByRole("button", { name: "Unpin UX" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pin UX to top" })).toBeNull();
  });

  // Second fresh review: a failed sort left the others in its order while a pin change waited.
  it("sorts the others by the sort shown after a failed sort, while a pin change waits", async () => {
    const heldPin = heldAnswer();
    const heldSettings = heldAnswer();
    const settings = { ...BOT_SETTINGS, bot_order: "created", bot_order_direction: "desc" };
    const old = makeBot(4, "Old", [], { created_at: "2026-10-01T10:00:00.000Z" });
    const young = makeBot(5, "Young", [], { created_at: "2026-10-10T10:00:00.000Z" });
    let holdSettings = false;
    fake = fakeApi({
      "GET /api/settings": async () => {
        if (!holdSettings) return { body: settings };
        const answer = await heldSettings.promise;
        return answer;
      },
      "GET /api/bots": () => ({ body: [BA, UX, old, young] }),
      "PUT /api/bots/pins": async () => {
        const answer = await heldPin.promise;
        return answer;
      },
      "PATCH /api/settings": () => ({
        status: 500,
        body: { error: { code: "internal_error", message: "Failed." } },
      }),
    });
    await renderApp("/bots");
    await screen.findByRole(
      "button",
      { name: "Sort by created time, newest first" },
      {
        timeout: 5000,
      },
    );
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Pin UX to top" }));
    });
    await waitFor(() => {
      expect(fake?.sent("PUT", "/api/bots/pins")).toHaveLength(1);
    });
    holdSettings = true;
    const loads = fake.sent("GET", "/api/bots").length;
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Sort by created time, newest first" }));
    });
    // The refresh after the failure: the list lands first, the settings after it.
    await waitFor(() => {
      expect(fake?.sent("GET", "/api/bots").length).toBeGreaterThan(loads);
    });
    await act(() => Promise.resolve());
    await heldSettings.answer({ body: settings });
    await screen.findByRole("button", { name: "Sort by created time, newest first" });
    await waitFor(() => {
      const names = screen
        .getAllByRole("link")
        .map((link) => link.textContent)
        .filter((name) => name === "Old" || name === "Young");
      expect(names).toEqual(["Young", "Old"]);
    });
    await heldPin.answer({ body: { pinned_bot_ids: [BA.id, UX.id] } });
  });
});
