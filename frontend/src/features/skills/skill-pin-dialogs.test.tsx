import { act, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeVersions } from "../../../test/fixtures.ts";
import { TooltipProvider } from "../../components/ui/tooltip.tsx";
import { ChangeVersionDialog } from "./skill-pin-dialogs.tsx";

const NOW = new Date("2026-11-15T10:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"], shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

// time-format.md §1: the time of a version inside a pick button is made again with the others.
describe("Change version", () => {
  it("turns the time of a version into 1 min ago when a minute passes", () => {
    const versions = makeVersions(2).map((version) => ({
      ...version,
      created_at: "2026-11-15T09:59:50Z",
    }));
    render(
      <TooltipProvider>
        <ChangeVersionDialog
          open
          botName="BA"
          used={1}
          versions={versions}
          versionsLoad={{ failed: false, retry: vi.fn() }}
          onClose={vi.fn()}
          onPick={vi.fn()}
        />
      </TooltipProvider>,
    );
    const list = screen.getByRole("list", { name: "Versions" });
    expect(within(list).getAllByText(/Just now/), "versions at the start").toHaveLength(2);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(within(list).getAllByText(/1 min ago/), "versions after one minute").toHaveLength(2);
  });
});
