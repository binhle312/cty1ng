import type { QueryClient } from "@tanstack/react-query";
import { act, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { fakeApi, heldAnswer } from "../../../test/fake-api.ts";
import { BOT_SETTINGS, makeSkill } from "../../../test/fixtures.ts";
import { renderApp } from "../../../test/render-app.tsx";

// `/skills` with no skill: the empty state (skills-page.md §3). A failed background refresh keeps
// the data the page has (skills-page.md, "A failed background refresh keeps the list"; P3 list
// item 60). The order cases of testing.md §3, "The refresh after a change is slow or fails".
describe("the Skills index page and a background refresh", () => {
  let api: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    api?.restore();
    api = null;
  });

  const WAIT = { timeout: 5000 };
  const FAILED = { status: 500, body: { error: { code: "internal_error", message: "Failed." } } };

  type Answer = Awaited<ReturnType<typeof heldAnswer>["promise"]>;

  // The fake server. `list` answers each read of the skill list.
  function startServer() {
    const server: { list: () => Answer | Promise<Answer> } = { list: () => ({ body: [] }) };
    api = fakeApi({
      "GET /api/settings": () => ({ body: BOT_SETTINGS }),
      "GET /api/skills": () => server.list(),
      "GET /api/bots": () => ({ body: [] }),
    });
    return server;
  }

  async function openEmpty() {
    const server = startServer();
    const app = await renderApp("/skills");
    await screen.findByText("No skills yet", {}, WAIT);
    return { ...app, server };
  }

  // A read of all data, as a window focus or a `reset` event starts it.
  async function refreshAll(queryClient: QueryClient) {
    await act(() => queryClient.invalidateQueries());
    await waitFor(() => {
      expect(queryClient.isFetching()).toBe(0);
    });
  }

  it("keeps the empty state when a background refresh fails", async () => {
    const { queryClient, server } = await openEmpty();
    server.list = () => FAILED;
    await refreshAll(queryClient);
    const empty = screen.queryByText("No skills yet");
    expect(empty, "the empty state after a failed refresh").not.toBeNull();
    expect(screen.queryByText("The app could not load the skills."), "no load error").toBeNull();
  });

  // Guards, not fix claims: the old code passed them too.
  it("keeps the empty state while a background refresh waits", async () => {
    const { queryClient, server } = await openEmpty();
    const held = heldAnswer();
    server.list = () => held.promise;
    void queryClient.invalidateQueries();
    await waitFor(() => {
      expect(queryClient.isFetching()).toBeGreaterThan(0);
    });
    const empty = screen.queryByText("No skills yet");
    expect(empty, "the empty state while it waits").not.toBeNull();
    await held.answer({ body: [] });
  });

  it("opens the skill that a background refresh brings", async () => {
    const { queryClient, router, server } = await openEmpty();
    server.list = () => ({ body: [makeSkill()] });
    await refreshAll(queryClient);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/skills/write-user-stories");
    });
  });

  it("shows the load error with Try again when the first load fails", async () => {
    startServer().list = () => FAILED;
    await renderApp("/skills");
    const alert = await screen.findByRole("alert", {}, WAIT);
    expect(alert.textContent).toContain("The app could not load the skills.");
    expect(within(alert).getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});
