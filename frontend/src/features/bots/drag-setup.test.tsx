import {
  DndContext,
  KeyboardSensor,
  type KeyboardSensorProps,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pressKeyNow } from "../../../test/press-key.ts";
import { AtOnceKeyboardSensor, keyboardSensorParts, useDragSensors } from "./drag-setup.ts";

// The keyboard drag of the pinned bots (pin.md §2; the Bots page, the bot page's side list and the
// header roster share `useDragSensors`): each key after the pick-up key goes to the drag, however
// soon it comes. An arrow that came before dnd-kit's sensor listened was lost, and the e2e test
// of the drop line failed (CI run 44228267962).

// jsdom has no layout: item "a" is left of item "b", so ArrowRight from "a" goes over "b".
const LEFT: Record<string, number> = { a: 0, b: 300 };

function Item({ id }: { id: string }) {
  const { setNodeRef, listeners } = useSortable({ id });
  return (
    <button type="button" ref={setNodeRef} data-item={id} {...listeners}>
      {id}
    </button>
  );
}

interface Seen {
  over: (string | null)[];
  ends: (string | null)[];
  cancels: (string | null)[];
}

function Lists({ seen }: { seen: Seen }) {
  const sensors = useDragSensors();
  return (
    <DndContext
      sensors={sensors}
      onDragOver={({ over }) => seen.over.push(over === null ? null : String(over.id))}
      onDragEnd={({ over }) => seen.ends.push(over === null ? null : String(over.id))}
      onDragCancel={({ over }) => seen.cancels.push(over === null ? null : String(over.id))}
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
  const seen: Seen = { over: [], ends: [], cancels: [] };
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

// The move is on the page: in a browser, it renders before the next key comes.
const overSecond = (seen: Seen) =>
  waitFor(() => {
    expect(seen.over.at(-1)).toBe("b");
  });

// The body of `attach` in `@dnd-kit/core` 6.3.1 (`dist/core.esm.js:1154-1159`), with no white
// space. `AtOnceKeyboardSensor` replaces it; when an update changes it, compare the two again.
const ATTACH_6_3_1 =
  "attach(){this.handleStart();this.windowListeners.add(EventName.Resize,this.handleCancel);" +
  "this.windowListeners.add(EventName.VisibilityChange,this.handleCancel);" +
  "setTimeout(()=>this.listeners.add(EventName.Keydown,this.handleKeyDown));}";

// One zero timer: dnd-kit's own timer of the pick-up has run after this.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

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
      expect(seen.cancels.length, "the Esc right after Space cancelled the drag").toBe(1);
    });
  });
});

describe("the keyboard sensor of useDragSensors", () => {
  it("does not drop the item on the Space that picks it up", async () => {
    const { seen, first } = renderLists();
    pressKeyNow(first, SPACE);
    await settle();
    expect(seen.ends, "the pick-up Space dropped the item").toEqual([]);
    pressKeyNow(focused(), ARROW_RIGHT);
    await overSecond(seen);
    pressKeyNow(focused(), SPACE);
    await waitFor(() => {
      expect(seen.ends).toEqual(["b"]);
    });
  });

  it("leaves no keydown listener on document after the drag ends", async () => {
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const keydowns = (spy: typeof add) => spy.mock.calls.filter(([name]) => name === "keydown");
    const { seen, first } = renderLists();
    pressKeyNow(first, SPACE);
    pressKeyNow(focused(), ARROW_RIGHT);
    await overSecond(seen);
    pressKeyNow(focused(), SPACE);
    await waitFor(() => {
      expect(seen.ends).toEqual(["b"]);
    });
    await settle();
    expect(keydowns(add).length, "keydown listeners added").toBeGreaterThan(0);
    const left = keydowns(add).filter(
      ([, listener]) => !keydowns(remove).some(([, removed]) => removed === listener),
    );
    expect(left, "a keydown listener stayed on document").toEqual([]);
  });

  it("finds each private part it uses on the installed dnd-kit sensor", async () => {
    const made: object[] = [];
    // dnd-kit's own sensor, unchanged, as the installed version builds it.
    class Watched extends KeyboardSensor {
      constructor(props: KeyboardSensorProps) {
        super(props);
        made.push(this);
      }
    }
    function Watch() {
      const sensors = useSensors(
        useSensor(Watched, {
          keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
        }),
      );
      return (
        <DndContext sensors={sensors}>
          <SortableContext items={["a", "b"]}>
            <Item id="a" />
            <Item id="b" />
          </SortableContext>
        </DndContext>
      );
    }
    render(<Watch />);
    const first = screen.getByRole("button", { name: "a" });
    act(() => {
      first.focus();
    });
    pressKeyNow(first, SPACE);
    await settle();
    const sensor = made[0];
    if (sensor === undefined) throw new Error("No keyboard sensor was made.");
    expect(
      typeof Reflect.get(KeyboardSensor.prototype, "attach"),
      "dnd-kit's sensor has no attach to replace",
    ).toBe("function");
    expect(keyboardSensorParts(sensor).missing, "parts missing in the installed dnd-kit").toEqual(
      [],
    );
    pressKeyNow(focused(), ESCAPE);
  });

  it("falls back to dnd-kit's own attach when a part is missing", async () => {
    // A sensor with no pick-up event, which only the at-once attach needs. With every other part,
    // dnd-kit's own attach can run: it starts the drag at once and listens after a timer.
    const onStart = vi.fn();
    const added: string[] = [];
    const sensor = {
      props: { activeNode: { node: { current: null } }, onStart },
      listeners: { add: (name: string) => added.push(name) },
      windowListeners: { add: () => undefined },
      handleKeyDown: () => undefined,
      handleCancel: () => undefined,
    };
    Object.setPrototypeOf(sensor, AtOnceKeyboardSensor.prototype);
    expect(keyboardSensorParts(sensor).missing).toEqual(["props.event"]);
    const attach: unknown = Reflect.get(sensor, "attach");
    if (typeof attach !== "function") throw new Error("The sensor has no attach.");
    expect(() => {
      Reflect.apply(attach, sensor, []);
    }).not.toThrow();
    expect(onStart, "dnd-kit's own attach did not run").toHaveBeenCalledTimes(1);
    expect(added, "the fallback listened at once").toEqual([]);
    await settle();
    expect(added).toEqual(["keydown"]);
  });

  it("replaces an attach that is still the one of dnd-kit 6.3.1", () => {
    const attach: unknown = Reflect.get(KeyboardSensor.prototype, "attach");
    const body = typeof attach === "function" ? attach.toString().replace(/\s+/g, "") : "";
    expect(body, "dnd-kit's attach changed: compare AtOnceKeyboardSensor with it").toBe(
      ATTACH_6_3_1,
    );
  });
});
