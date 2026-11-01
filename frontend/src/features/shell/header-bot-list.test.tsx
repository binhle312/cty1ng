import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "../../components/ui/tooltip.tsx";
import { makeBot } from "../../../test/fixtures.ts";
import { AllBotsChip } from "./header-bot-list.tsx";

// The "+N" list (top-header.md §4, UI-2.12).
const BA = makeBot(1, "BA", [], { pinned_position: 0 });
const QA = makeBot(2, "QA");
const UX = makeBot(3, "UX", [], {
  description: "Draws screens.",
  available: false,
  unavailable_reason: "no_api_key",
});

function open(onPick = vi.fn(), onOpen = vi.fn()) {
  render(
    <TooltipProvider>
      <AllBotsChip pinned={[BA]} others={[QA, UX]} hidden={2} onOpen={onOpen} onPick={onPick} />
    </TooltipProvider>,
  );
  const chip = screen.getByRole("button", { name: "All 3 bots, 2 not in view" });
  expect(chip.textContent).toBe("+2");
  act(() => {
    fireEvent.click(chip);
  });
  return { onPick, onOpen };
}

const shown = () =>
  screen.getAllByTestId("all-bots-row").map((row) => row.getAttribute("data-bot"));

describe('the "+N" list of every bot', () => {
  it("lists every bot in the header order, the pinned first, with the search focused", async () => {
    const { onOpen } = open();
    const search = await screen.findByRole("searchbox", { name: "Find a bot" });
    expect(shown()).toEqual(["ba", "qa", "ux"]);
    expect(onOpen).toHaveBeenCalledOnce();
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(search);
    });
    const ux = screen.getAllByTestId("all-bots-row")[2];
    expect(ux?.textContent).toContain("API key not set");
  });

  it("finds a bot by its description and says when nothing matches (A2, A6)", async () => {
    open();
    const search = await screen.findByRole("searchbox", { name: "Find a bot" });
    act(() => {
      fireEvent.change(search, { target: { value: "screens" } });
    });
    expect(shown()).toEqual(["ux"]);
    act(() => {
      fireEvent.change(search, { target: { value: "nobody" } });
    });
    expect(screen.getByText('No bots match "nobody".')).toBeTruthy();
  });

  it("picks the first match with Enter in the search (A4, A5)", async () => {
    const { onPick } = open();
    const search = await screen.findByRole("searchbox", { name: "Find a bot" });
    act(() => {
      fireEvent.change(search, { target: { value: "q" } });
      fireEvent.keyDown(search, { key: "Enter" });
    });
    expect(onPick).toHaveBeenCalledWith(QA);
  });

  it("moves between the rows with the arrow keys and picks with a click (A5)", async () => {
    const { onPick } = open();
    const search = await screen.findByRole("searchbox", { name: "Find a bot" });
    const [ba, qa, ux] = within(screen.getByRole("list", { name: "Bots" })).getAllByRole("button");
    if (ba === undefined || qa === undefined || ux === undefined) throw new Error("three rows");
    act(() => {
      fireEvent.keyDown(search, { key: "ArrowDown" });
    });
    expect(document.activeElement).toBe(ba);
    act(() => {
      fireEvent.keyDown(ba, { key: "ArrowDown" });
    });
    expect(document.activeElement).toBe(qa);
    act(() => {
      fireEvent.keyDown(qa, { key: "ArrowUp" });
      fireEvent.keyDown(ba, { key: "ArrowUp" });
    });
    expect(document.activeElement).toBe(search);
    act(() => {
      fireEvent.click(ux);
    });
    expect(onPick).toHaveBeenCalledWith(UX);
  });
});
