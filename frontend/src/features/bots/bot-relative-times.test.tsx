import { act, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeApi } from "../../../test/fake-api.ts";
import { BOT_SETTINGS, FAKE_SCRIPTED, makeBot, makeTool } from "../../../test/fixtures.ts";
import { renderApp } from "../../../test/render-app.tsx";

const NOW = new Date("2026-11-15T10:00:00Z");
let fake: ReturnType<typeof fakeApi> | null = null;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"], shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  fake?.restore();
  fake = null;
  vi.useRealTimers();
});

// The bot page shows the status line of the bot twice: in its top and in the side list.
async function openBotPage() {
  const ba = makeBot(1, "BA", [], { last_activity_at: "2026-11-15T09:59:50Z" });
  fake = fakeApi({
    "GET /api/settings": () => ({ body: BOT_SETTINGS }),
    "GET /api/models": () => ({ body: [FAKE_SCRIPTED] }),
    "GET /api/tools": () => ({ body: [makeTool("read_file", { label: "Read files" })] }),
    "GET /api/bots": () => ({ body: [ba] }),
  });
  await renderApp("/bots/ba");
  return await screen.findByRole("button", { name: /last active/ });
}

const later = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

// time-format.md §1: a relative time updates at least each 30 seconds while the page is visible.
describe("the status line of a bot", () => {
  it("in the top of the bot page turns into 1 min ago when a minute passes", async () => {
    const top = await openBotPage();
    expect(top.textContent, "top at the start").toBe("Idle · last active Just now");
    later(60_000);
    expect(top.textContent, "top after one minute").toBe("Idle · last active 1 min ago");
  });

  it("in the side list turns into 1 min ago when a minute passes", async () => {
    await openBotPage();
    const list = screen.getByRole("navigation", { name: "Bots" });
    expect(within(list).getByText("Idle · last active Just now"), "row at the start").toBeTruthy();
    later(60_000);
    expect(
      within(list).getByText("Idle · last active 1 min ago"),
      "row after a minute",
    ).toBeTruthy();
  });
});
