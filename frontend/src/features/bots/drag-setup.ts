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

// The drag setup of the header roster and the Pinned group of the Bots page (top-header.md HD5,
// HD6; pin.md §2).
//
// The mouse sensor, not the pointer sensor: the pointer sensor also takes touch, claims the
// press at once, and then the touch sensor never sees it, so a long press started no drag. With
// the mouse sensor, a touch is only the touch sensor's: a long press starts the drag, a short
// tap is a click, and a swipe scrolls. The keyboard picks up and drops with Space only, because
// Enter opens the bot (or its card).
export function useDragSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );
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
