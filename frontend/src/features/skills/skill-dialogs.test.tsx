import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makeBot, makePin, typeId } from "../../../test/fixtures.ts";
import { DeleteDialog, DeprecateDialog, RemoveFromBotsDialog } from "./skill-dialogs.tsx";
import type { BotUses } from "./skill-bot-uses.ts";

const ba = makeBot(1, "BA", [makePin()]);
const designer = makeBot(2, "Designer", [
  makePin({ version: 2, skill_version_id: typeId("skillv", 2) }),
]);

const ready = (...bots: (typeof ba)[]): BotUses => ({
  kind: "ready",
  uses: bots.flatMap((bot) => bot.pins.map((pin) => ({ bot, pin }))),
  all: bots,
});

const base = { open: true, skillName: "Write user stories", pending: false, error: null };

const click = (element: HTMLElement) => {
  act(() => {
    fireEvent.click(element);
  });
};

// skills-page.md §10.1: every box starts ticked, and the button counts the ticked bots.
describe("the Deprecate dialog", () => {
  it("with no bot says so and sends no bot to remove", () => {
    const onConfirm = vi.fn();
    render(<DeprecateDialog {...base} bots={ready()} onCancel={vi.fn()} onConfirm={onConfirm} />);
    expect(screen.getByText("No bot uses it.")).toBeTruthy();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    click(screen.getByRole("button", { name: "Deprecate" }));
    expect(onConfirm).toHaveBeenCalledWith([]);
  });

  it("lists the bots with their version, all ticked, and sends the ticked ones", () => {
    const onConfirm = vi.fn();
    render(
      <DeprecateDialog
        {...base}
        bots={ready(ba, designer)}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    const list = screen.getByRole("list", { name: "Bots that use this skill" });
    expect(within(list).getByText("BA")).toBeTruthy();
    expect(within(list).getByText("v2")).toBeTruthy();
    const boxes = within(list).getAllByRole("checkbox");
    expect(boxes.map((box) => box.getAttribute("aria-checked"))).toEqual(["true", "true"]);
    expect(screen.getByRole("button", { name: "Deprecate and remove from 2 bots" })).toBeTruthy();

    // Untick Designer: it keeps the skill.
    const [, designerBox] = boxes;
    if (designerBox === undefined) throw new Error("no box");
    click(designerBox);
    click(screen.getByRole("button", { name: "Deprecate and remove from 1 bot" }));
    expect(onConfirm).toHaveBeenCalledWith([ba.id]);
  });

  it("with every box cleared, the button says only Deprecate", () => {
    const onConfirm = vi.fn();
    render(<DeprecateDialog {...base} bots={ready(ba)} onCancel={vi.fn()} onConfirm={onConfirm} />);
    click(screen.getByRole("checkbox"));
    click(screen.getByRole("button", { name: "Deprecate" }));
    expect(onConfirm).toHaveBeenCalledWith([]);
  });

  it("does not deprecate while the bots are not known", () => {
    const onConfirm = vi.fn();
    render(
      <DeprecateDialog
        {...base}
        bots={{ kind: "loading" }}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    expect(screen.queryByText("No bot uses it.")).toBeNull();
    click(screen.getByRole("button", { name: "Deprecate" }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("says when the bots did not load", () => {
    render(
      <DeprecateDialog
        {...base}
        bots={{ kind: "error", retry: vi.fn() }}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain("The app could not load the bots.");
  });
});

// §10.3: Skip is the default, every box starts ticked, and no tick turns the button off.
describe("the Remove from bots dialog", () => {
  it("removes the ticked bots only", () => {
    const onConfirm = vi.fn();
    render(
      <RemoveFromBotsDialog
        {...base}
        bots={ready(ba, designer)}
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByRole("button", { name: "Skip" })).toBeTruthy();
    const [first] = screen.getAllByRole("checkbox");
    if (first === undefined) throw new Error("no box");
    click(first);
    click(screen.getByRole("button", { name: "Remove from 1 bot" }));
    expect(onConfirm).toHaveBeenCalledWith([designer.id]);
  });

  it("is off with no tick", () => {
    const onConfirm = vi.fn();
    render(
      <RemoveFromBotsDialog {...base} bots={ready(ba)} onCancel={vi.fn()} onConfirm={onConfirm} />,
    );
    click(screen.getByRole("checkbox"));
    const button = screen.getByRole("button", { name: "Remove from bots" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    click(button);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

// §11: Delete names the bots that lose the skill, with no check boxes.
describe("the Delete dialog", () => {
  const props = { ...base, trashDays: 30, onCancel: vi.fn() };

  it("with no bot has no list", () => {
    render(<DeleteDialog {...props} bots={ready()} onConfirm={vi.fn()} />);
    expect(screen.getByText(/The skill goes to Trash\. After 30 days/)).toBeTruthy();
    expect(screen.queryByText(/These bots stop using it now/)).toBeNull();
    expect(screen.queryByRole("list", { name: "Bots that use this skill" })).toBeNull();
  });

  it("lists the bots, with no check boxes", () => {
    const onConfirm = vi.fn();
    render(<DeleteDialog {...props} bots={ready(ba, designer)} onConfirm={onConfirm} />);
    expect(screen.getByText(/These bots stop using it now:/)).toBeTruthy();
    const list = screen.getByRole("list", { name: "Bots that use this skill" });
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([expect.stringContaining("BA"), expect.stringContaining("Designer")]);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    click(screen.getByRole("button", { name: "Delete skill" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("waits for the bots before it deletes", () => {
    const onConfirm = vi.fn();
    render(<DeleteDialog {...props} bots={{ kind: "loading" }} onConfirm={onConfirm} />);
    click(screen.getByRole("button", { name: "Delete skill" }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
