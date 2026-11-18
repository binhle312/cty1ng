import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimeText } from "./time-text.tsx";
import { TooltipProvider } from "./tooltip.tsx";

const NOW = new Date("2026-11-15T10:00:00Z");
const TEN_SECONDS_AGO = "2026-11-15T09:59:50Z";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"], shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const show = () =>
  render(
    <TooltipProvider>
      <TimeText iso={TEN_SECONDS_AGO} />
    </TooltipProvider>,
  );

const later = (ms: number) => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

// time-format.md §1: a relative time updates while the page is visible (the tick has its value there).
// One claim for each test: `scripts/breaks/pr-125.json` has a break for the order and race tests.
describe("TimeText", () => {
  it("starts as Just now", () => {
    show();
    expect(screen.getByText("Just now"), "text at the start").toBeTruthy();
  });

  it("turns Just now into 1 min ago when a minute passes", () => {
    show();
    later(60_000);
    expect(screen.getByText("1 min ago"), "text after one minute").toBeTruthy();
  });

  it("keeps its text while the page is hidden", () => {
    const hidden = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    show();
    later(5 * 60_000);
    expect(screen.getByText("Just now"), "text after five hidden minutes").toBeTruthy();
    hidden.mockRestore();
  });

  it("shows the new time at once when the page turns visible", () => {
    show();
    const hidden = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    later(5 * 60_000);
    hidden.mockRestore();
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(screen.getByText("5 min ago"), "text at the visible event").toBeTruthy();
  });

  it("leaves no timer when it is gone", () => {
    const view = show();
    view.unmount();
    expect(vi.getTimerCount(), "timers after the unmount").toBe(0);
  });

  it("logs no warning at its first render", () => {
    const warn = vi.spyOn(console, "error").mockImplementation(() => undefined);
    show();
    expect(warn, "errors logged at the first render").not.toHaveBeenCalled();
  });
});
