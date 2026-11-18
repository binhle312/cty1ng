import { DndContext } from "@dnd-kit/core";
import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pressKeyNow } from "../../../test/press-key.ts";
import { useDragSensors } from "./drag-setup.ts";

// The keyboard drag of the pinned bots (pin.md §2; the Bots page, the bot page's side list and the
// header roster share `useDragSensors`): each key after the pick-up key goes to the drag, however
// soon it comes. An arrow that came before dnd-kit's sensor listened was lost, and the e2e test
// of the drop line failed (CI run 44228267962).

// jsdom has no layout: item "a" is left of item "b", so ArrowRight from "a" goes over "b".
const LEFT: Record<string, number> = { a: 0, b: 300 };

function Item({ id }: { id: string }) {
  const sortable = useSortable({ id });
  return (
    <button type="button" ref={sortable.setNodeRef} data-item={id} {...sortable.listeners}>
      {id}
    </button>
  );
}

interface Seen {
  over: (string | null)[];
  ends: (string | null)[];
  cancels: number;
}

function Lists({ seen }: { seen: Seen }) {
  const sensors = useDragSensors();
  return (
    <DndContext
      sensors={sensors}
      onDragOver={({ over }) => seen.over.push(over === null ? null : String(over.id))}
      onDragEnd={({ over }) => seen.ends.push(over === null ? null : String(over.id))}
      onDragCancel={() => {
        seen.cancels += 1;
      }}
    >
      <SortableContext items={["a", "b"]}>
        <Item id="a" />
        <Item id="b" />
      </SortableContext>
    </DndContext>
  );
}

// Renders the two items and focuses "a", as a person who tabs to it.
function renderLists(): { seen: Seen; first: HTMLElement } {
  const seen: Seen = { over: [], ends: [], cancels: 0 };
  render(<Lists seen={seen} />);
  const first = screen.getByRole("button", { name: "a" });
  act(() => {
    first.focus();
  });
  return { seen, first };
}

// Where the browser sends the next key: the focused element (the pick-up can move the focus).
const focused = (): Element => document.activeElement ?? document.body;

const SPACE = { key: " ", code: "Space" };
const ARROW_RIGHT = { key: "ArrowRight", code: "ArrowRight" };
const ESCAPE = { key: "Escape", code: "Escape" };

beforeEach(() => {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function rect(
    this: Element,
  ) {
    const left = LEFT[this.getAttribute("data-item") ?? ""] ?? 0;
    return DOMRect.fromRect({ x: left, y: 0, width: 200, height: 100 });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the keyboard drag of useDragSensors", () => {
  it("moves on an arrow that comes right after the pick-up", async () => {
    const { seen, first } = renderLists();
    pressKeyNow(first, SPACE);
    pressKeyNow(focused(), ARROW_RIGHT);
    await waitFor(() => {
      expect(seen.over.at(-1), "the arrow right after Space moved the drag").toBe("b");
    });
  });

  it("cancels on an Esc that comes right after the pick-up", async () => {
    const { seen, first } = renderLists();
    pressKeyNow(first, SPACE);
    pressKeyNow(focused(), ESCAPE);
    await waitFor(() => {
      expect(seen.cancels, "the Esc right after Space cancelled the drag").toBe(1);
    });
  });
});
