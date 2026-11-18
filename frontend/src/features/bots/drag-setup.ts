import {
  closestCenter,
  type CollisionDetection,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { type RefObject, useCallback } from "react";

// The drag setup of the header roster and of the pinned bots on the Bots page and the bot page's
// side list (top-header.md HD5, HD6; pin.md §2).
//
// The mouse sensor, not the pointer sensor: the pointer sensor also takes touch, claims the
// press at once, and then the touch sensor never sees it, so a long press started no drag. With
// the mouse sensor, a touch is only the touch sensor's: a long press starts the drag, a short
// tap is a click, and a swipe scrolls. The keyboard picks up and drops with Space only, because
// Enter opens the bot (or its card). The keyboard sensor hears each key after the pick-up key, however
// soon it comes (`PromptKeyboardSensor` below).
//
// A mouse or touch press ends on Esc too, but dnd-kit does not mark that Esc as used. So from the
// press until the release, a capture listener marks it, and the bot page does not also ask
// (bot-page.md §4.1).
export function useDragSensors() {
  return useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 5 },
      onActivation: markEscUntilRelease,
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 300, tolerance: 5 },
      onActivation: markEscUntilRelease,
    }),
    useSensor(PromptKeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );
}

// dnd-kit's keyboard sensor (`@dnd-kit/core` 6.3.1, `attach` in `dist/core.esm.js:1154-1159`) adds
// its keydown listener in a zero timer after the pick-up key. Chrome runs a key that it already
// holds before that timer, so an arrow or Esc pressed while the pick-up renders was lost (the flaky
// e2e test of the drop line, CI run 44228267962). This sensor is dnd-kit's with one change: its
// `attach` adds the listener at once. The pick-up key still goes on to `document` after that, so
// the listener skips that one event, or it would drop the item at once (this is why dnd-kit waits).
export class PromptKeyboardSensor extends KeyboardSensor {}

const dndKitAttach: unknown = Reflect.get(KeyboardSensor.prototype, "attach");

// `attach` is private in dnd-kit's types, so it is replaced on the prototype.
Object.defineProperty(PromptKeyboardSensor.prototype, "attach", {
  value: function attach(this: object) {
    attachAtOnce(this, dndKitAttach);
  },
});

type Listener = (event: Event) => void;

// The private parts of dnd-kit's sensor that `attachAtOnce` uses. A dnd-kit update can rename
// them: `drag-setup.test.tsx` checks them on the installed version.
export interface SensorParts {
  pickUpEvent: object;
  handleStart: () => void;
  handleKeyDown: Listener;
  handleCancel: Listener;
  addListener: (name: string, listener: Listener) => void;
  addWindowListener: (name: string, listener: Listener) => void;
}

export function keyboardSensorParts(sensor: object): {
  parts: SensorParts | null;
  missing: string[];
} {
  const missing: string[] = [];
  // `path` is a method of the sensor, or of one of its fields ("listeners.add").
  const method = (path: string) => {
    const names = path.split(".");
    const name = names.pop() ?? "";
    const owner = names.reduce<unknown>((value, field) => fieldOf(value, field), sensor);
    const value = fieldOf(owner, name);
    if (typeof value === "function") {
      return (...args: unknown[]): unknown => Reflect.apply(value, owner, args);
    }
    missing.push(path);
    return null;
  };
  const event = fieldOf(fieldOf(sensor, "props"), "event");
  const pickUpEvent = typeof event === "object" ? event : null;
  if (pickUpEvent === null) missing.push("props.event");
  const handleStart = method("handleStart");
  const handleKeyDown = method("handleKeyDown");
  const handleCancel = method("handleCancel");
  const addListener = method("listeners.add");
  const addWindowListener = method("windowListeners.add");
  if (
    pickUpEvent === null ||
    handleStart === null ||
    handleKeyDown === null ||
    handleCancel === null ||
    addListener === null ||
    addWindowListener === null
  ) {
    return { parts: null, missing };
  }
  return {
    parts: {
      pickUpEvent,
      handleStart,
      handleKeyDown,
      handleCancel,
      addListener,
      addWindowListener,
    },
    missing,
  };
}

function fieldOf(owner: unknown, name: string): unknown {
  return typeof owner === "object" && owner !== null ? Reflect.get(owner, name) : undefined;
}

// dnd-kit's `attach` with the listener added at once. If a part is missing, the sensor falls back
// to dnd-kit's own `attach`: the drag works, and only a key that comes very soon is lost again.
export function attachAtOnce(sensor: object, fallback: unknown): void {
  const { parts } = keyboardSensorParts(sensor);
  if (parts === null) {
    if (typeof fallback === "function") Reflect.apply(fallback, sensor, []);
    return;
  }
  parts.handleStart();
  parts.addWindowListener("resize", parts.handleCancel);
  parts.addWindowListener("visibilitychange", parts.handleCancel);
  // In the sensor's own list, so dnd-kit's `detach` removes it when the drag ends.
  parts.addListener("keydown", (event) => {
    if (event !== parts.pickUpEvent) parts.handleKeyDown(event);
  });
}

// A tab change also ends the drag, and the button may come up in the other tab, with no mouseup
// here.
const RELEASES = ["mouseup", "touchend", "touchcancel", "visibilitychange"] as const;

function markEscUntilRelease() {
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape" && event.code !== "Escape") return;
    event.preventDefault();
    stop();
  };
  const stop = () => {
    window.removeEventListener("keydown", onKey, true);
    for (const name of RELEASES) window.removeEventListener(name, stop, true);
  };
  window.addEventListener("keydown", onKey, true);
  for (const name of RELEASES) window.addEventListener(name, stop, true);
}

// The drop place decides (HD5): a pointer outside the area is over nothing, so the drop changes
// nothing. The area is `ref`'s element, or its nearest ancestor that matches `closest`. Inside,
// the nearest target wins. A keyboard drag has no pointer and moves only between the targets.
export function useClosestInside(
  ref: RefObject<Element | null>,
  closest?: string,
): CollisionDetection {
  return useCallback<CollisionDetection>(
    (args) => {
      const point = args.pointerCoordinates;
      const el = ref.current;
      const area = closest === undefined ? el : (el?.closest(closest) ?? null);
      const box = area?.getBoundingClientRect();
      if (point !== null && box !== undefined) {
        const outside =
          point.x < box.left || point.x > box.right || point.y < box.top || point.y > box.bottom;
        if (outside) return [];
      }
      return closestCenter(args);
    },
    [ref, closest],
  );
}
