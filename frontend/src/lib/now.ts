import { useSyncExternalStore } from "react";
import type { Page } from "./realtime/start.ts";

// How often a relative time is made again while the page is visible. This is a rule of the time
// format, not a setting: the owner chooses what the text says (`time-format.md` §1), and the tick
// only keeps that text right, as a render does, so it is at most one tick late. A longer or a
// shorter tick gives the owner nothing to choose (`AGENTS.md` §10). It is half of the smallest
// unit of the format (one minute); `time-format.md` §1 writes the value.
export const NOW_TICK_MS = 30_000;

// What `useSyncExternalStore` needs.
export interface Clock {
  subscribe: (listener: () => void) => () => void;
  now: () => Date;
}

// A timer that the readers of the time share (`now.test.ts`, "three subscribers share one
// timer"). It runs only while a reader listens and the page is visible; the last reader to leave
// clears it and the page listener. `now()` gives the same `Date` between ticks, because React
// needs a stable snapshot (a new `Date` on each read makes React render again and again). It
// takes a new one only when the saved one is more than one tick away from the clock, in either
// direction, so a read after a long idle time or after the clock moved back is never old. A text
// that is already on screen when a laptop wakes is made again at the next tick or at the
// `visibilitychange` event, not at once.
export function createClock({
  tickMs = NOW_TICK_MS,
  page = document,
}: { tickMs?: number; page?: Page } = {}): Clock {
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let current = new Date();

  const take = () => {
    current = new Date();
  };
  const tick = () => {
    take();
    // A copy: a reader can leave during the loop; one that left is not called.
    for (const listener of [...listeners]) {
      if (listeners.has(listener)) listener();
    }
  };
  const stop = () => {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
  };
  const start = () => {
    if (timer !== null || listeners.size === 0 || page.visibilityState !== "visible") return;
    timer = setInterval(tick, tickMs);
  };
  const onVisibility = () => {
    if (page.visibilityState === "visible") {
      tick();
      start();
    } else {
      stop();
    }
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) page.addEventListener("visibilitychange", onVisibility);
      start();
      return () => {
        listeners.delete(listener);
        if (listeners.size > 0) return;
        stop();
        page.removeEventListener("visibilitychange", onVisibility);
      };
    },
    now() {
      if (Math.abs(Date.now() - current.getTime()) > tickMs) take();
      return current;
    },
  };
}

// The clock that `useNow` reads.
export const appClock = createClock();

// The time now, up to one tick old while the page is visible. The component renders again at
// each tick. Use it in place of `new Date()` (lint checks that in components and features).
export function useNow(): Date {
  return useSyncExternalStore(appClock.subscribe, appClock.now);
}
