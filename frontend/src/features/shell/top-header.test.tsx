import { focusManager } from "@tanstack/react-query";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeApi } from "../../../test/fake-api.ts";
import { type Bot, makeBot } from "../../../test/fixtures.ts";
import { renderApp } from "../../../test/render-app.tsx";

// Deferred reordering (app-shell.md UI-2.9): while the owner uses the header, a new order from
// activity moves no avatar; it applies in one step at a click outside or when focus leaves.
const BA = makeBot(1, "BA");
const QA = makeBot(2, "QA");
const UX = makeBot(3, "UX");

function shownOrder(): (string | null)[] {
  return screen.getAllByTestId("header-bot").map((el) => el.getAttribute("data-bot"));
}

// The bot list comes again, as after activity: the window regains focus and the stale list is
// fetched.
async function refetchBots(api: ReturnType<typeof fakeApi>, calls: number) {
  act(() => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });
  await waitFor(() => {
    expect(api.sent("GET", "/api/bots").length).toBeGreaterThanOrEqual(calls);
  });
  await act(async () => {
    await Promise.resolve();
  });
}

describe("the header order while the owner uses the header", () => {
  let api: ReturnType<typeof fakeApi> | null = null;
  afterEach(() => {
    api?.restore();
    api = null;
    focusManager.setFocused(undefined);
  });

  function serve(lists: Bot[][]) {
    let call = 0;
    api = fakeApi({
      "GET /api/bots": () => {
        const list = lists[Math.min(call, lists.length - 1)];
        call += 1;
        return { body: list };
      },
    });
    return api;
  }

  it("keeps the order while focus is in the header, then applies it at a click outside", async () => {
    const fake = serve([
      [BA, QA, UX],
      [UX, BA, QA],
    ]);
    await renderApp("/");
    // The roster is a lazy chunk: its first import in a test run takes a while.
    await screen.findAllByTestId("header-bot", {}, { timeout: 5000 });
    expect(shownOrder()).toEqual(["ba", "qa", "ux"]);
    act(() => {
      screen.getAllByTestId("header-bot")[0]?.querySelector("button")?.focus();
    });
    await refetchBots(fake, 2);
    expect(shownOrder()).toEqual(["ba", "qa", "ux"]);
    act(() => {
      fireEvent.pointerDown(document.body);
    });
    expect(shownOrder()).toEqual(["ux", "ba", "qa"]);
  });

  it("applies the order when focus moves out of the header", async () => {
    const fake = serve([
      [BA, QA, UX],
      [QA, UX, BA],
    ]);
    await renderApp("/");
    // The roster is a lazy chunk: its first import in a test run takes a while.
    await screen.findAllByTestId("header-bot", {}, { timeout: 5000 });
    expect(shownOrder()).toEqual(["ba", "qa", "ux"]);
    act(() => {
      screen.getAllByTestId("header-bot")[1]?.querySelector("button")?.focus();
    });
    await refetchBots(fake, 2);
    expect(shownOrder()).toEqual(["ba", "qa", "ux"]);
    // Tab moves focus to a control in the page.
    const outside = document.createElement("button");
    screen.getByRole("main").append(outside);
    act(() => {
      outside.focus();
    });
    expect(shownOrder()).toEqual(["qa", "ux", "ba"]);
  });

  // top-header.md state 9: the pointer over the avatars, with no focus in the header.
  it("keeps the order while the pointer is over the avatars, and after it leaves, until a click outside", async () => {
    const fake = serve([
      [BA, QA, UX],
      [UX, BA, QA],
    ]);
    await renderApp("/");
    // The roster is a lazy chunk: its first import in a test run takes a while.
    await screen.findAllByTestId("header-bot", {}, { timeout: 5000 });
    expect(shownOrder()).toEqual(["ba", "qa", "ux"]);
    const roster = screen.getByTestId("roster");
    // A minute passes at each step: the order waits for a click outside, not for a timer. Only
    // the timers are fake, and they also follow real time, so the queries and the waits run.
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"],
      shouldAdvanceTime: true,
    });
    try {
      const later = () => {
        act(() => {
          vi.advanceTimersByTime(60_000);
        });
      };
      act(() => {
        fireEvent.pointerEnter(roster);
      });
      await refetchBots(fake, 2);
      later();
      expect(shownOrder()).toEqual(["ba", "qa", "ux"]);
      // A click in the header is not a click outside.
      act(() => {
        fireEvent.pointerDown(roster);
      });
      later();
      expect(shownOrder()).toEqual(["ba", "qa", "ux"]);
      act(() => {
        fireEvent.pointerLeave(roster);
      });
      later();
      expect(shownOrder()).toEqual(["ba", "qa", "ux"]);
    } finally {
      vi.useRealTimers();
    }
    act(() => {
      fireEvent.pointerDown(document.body);
    });
    expect(shownOrder()).toEqual(["ux", "ba", "qa"]);
  });

  it("follows a new order at once when the owner is not in the header", async () => {
    const fake = serve([
      [BA, QA, UX],
      [UX, QA, BA],
    ]);
    await renderApp("/");
    // The roster is a lazy chunk: its first import in a test run takes a while.
    await screen.findAllByTestId("header-bot", {}, { timeout: 5000 });
    expect(shownOrder()).toEqual(["ba", "qa", "ux"]);
    await refetchBots(fake, 2);
    await waitFor(() => {
      expect(shownOrder()).toEqual(["ux", "qa", "ba"]);
    });
  });
});
