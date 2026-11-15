import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClock, NOW_TICK_MS } from "./now.ts";
import type { Page } from "./realtime/start.ts";

const START = new Date("2026-11-15T10:00:00Z");
const TICK = 1000;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"], shouldAdvanceTime: true });
  vi.setSystemTime(START);
});
afterEach(() => {
  vi.useRealTimers();
});

// A page whose visibility the test sets; it counts the `visibilitychange` listeners.
function setup({ visible = true }: { visible?: boolean } = {}) {
  const target = new EventTarget();
  const add = vi.spyOn(target, "addEventListener");
  const remove = vi.spyOn(target, "removeEventListener");
  let visibilityState: DocumentVisibilityState = visible ? "visible" : "hidden";
  const page: Page = {
    get visibilityState() {
      return visibilityState;
    },
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
  };
  const show = (now: boolean) => {
    visibilityState = now ? "visible" : "hidden";
    target.dispatchEvent(new Event("visibilitychange"));
  };
  const clock = createClock({ tickMs: TICK, page });
  const listening = () => add.mock.calls.length - remove.mock.calls.length;
  const tick = () => {
    vi.advanceTimersByTime(TICK);
  };
  return { clock, show, listening, tick };
}

// `time-format.md` §1, "A relative time updates at least each 30 seconds while the page is
// visible". One claim for each test: `scripts/breaks/pr-125.json` has a break for the order and
// race tests.
describe("the shared clock", () => {
  it("the tick of the app is 30 seconds", () => {
    expect(NOW_TICK_MS, "the tick of the app").toBe(30_000);
  });

  it("three subscribers share one timer", () => {
    const { clock } = setup();
    clock.subscribe(vi.fn());
    clock.subscribe(vi.fn());
    clock.subscribe(vi.fn());
    expect(vi.getTimerCount(), "timers of three subscribers").toBe(1);
  });

  it("each subscriber is called once for each tick", () => {
    const { clock, tick } = setup();
    const a = vi.fn();
    const b = vi.fn();
    clock.subscribe(a);
    clock.subscribe(b);
    tick();
    tick();
    expect(a, "calls of the first subscriber").toHaveBeenCalledTimes(2);
    expect(b, "calls of the second subscriber").toHaveBeenCalledTimes(2);
  });

  it("now moves by one tick at each tick", () => {
    const { clock, tick } = setup();
    clock.subscribe(vi.fn());
    const before = clock.now().getTime();
    tick();
    expect(clock.now().getTime() - before, "move of now in one tick").toBe(TICK);
  });

  it("now gives the same object between ticks", () => {
    const { clock } = setup();
    clock.subscribe(vi.fn());
    const first = clock.now();
    vi.advanceTimersByTime(TICK / 2);
    expect(clock.now(), "now between ticks").toBe(first);
  });

  it("now gives the same object before the first subscriber", () => {
    const { clock } = setup();
    expect(clock.now(), "now with no subscriber").toBe(clock.now());
  });

  it("the last unsubscribe clears the timer", () => {
    const { clock } = setup();
    const stopA = clock.subscribe(vi.fn());
    const stopB = clock.subscribe(vi.fn());
    stopA();
    stopB();
    expect(vi.getTimerCount(), "timers after the last unsubscribe").toBe(0);
  });

  it("the last unsubscribe removes the page listener", () => {
    const { clock, listening } = setup();
    const stopA = clock.subscribe(vi.fn());
    const stopB = clock.subscribe(vi.fn());
    stopA();
    stopB();
    expect(listening(), "page listeners after the last unsubscribe").toBe(0);
  });

  it("an unsubscribe that is not the last keeps the timer", () => {
    const { clock } = setup();
    const stopA = clock.subscribe(vi.fn());
    clock.subscribe(vi.fn());
    stopA();
    expect(vi.getTimerCount(), "timers after the first unsubscribe").toBe(1);
  });

  it("an unsubscribe that is not the last keeps the page listener", () => {
    const { clock, listening } = setup();
    const stopA = clock.subscribe(vi.fn());
    clock.subscribe(vi.fn());
    stopA();
    expect(listening(), "page listeners after the first unsubscribe").toBe(1);
  });

  it("a hidden page runs no timer", () => {
    const { clock } = setup({ visible: false });
    clock.subscribe(vi.fn());
    expect(vi.getTimerCount(), "timers on a hidden page").toBe(0);
  });

  it("a page that turns hidden stops the timer", () => {
    const { clock, show } = setup();
    clock.subscribe(vi.fn());
    show(false);
    expect(vi.getTimerCount(), "timers after the page turned hidden").toBe(0);
  });

  it("a hidden page calls nobody while time passes", () => {
    const { clock, show } = setup();
    const listener = vi.fn();
    clock.subscribe(listener);
    show(false);
    vi.advanceTimersByTime(5 * 60_000);
    expect(listener, "calls in five hidden minutes").not.toHaveBeenCalled();
  });

  it("a page that turns visible calls each subscriber at once", () => {
    const { clock, show } = setup();
    const listener = vi.fn();
    clock.subscribe(listener);
    show(false);
    show(true);
    expect(listener, "calls at the visible event").toHaveBeenCalledTimes(1);
  });

  it("a page that turns visible starts the ticks again", () => {
    const { clock, show, tick } = setup();
    const listener = vi.fn();
    clock.subscribe(listener);
    show(false);
    show(true);
    tick();
    expect(listener, "calls after the visible event and one tick").toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount(), "timers after the visible event").toBe(1);
  });

  it("a subscriber on a hidden page waits for the page to be visible", () => {
    const { clock, show } = setup({ visible: false });
    clock.subscribe(vi.fn());
    show(true);
    expect(vi.getTimerCount(), "timers after the page turned visible").toBe(1);
  });

  it("a repeated visible event keeps one timer", () => {
    const { clock, show } = setup();
    clock.subscribe(vi.fn());
    show(true);
    show(true);
    expect(vi.getTimerCount(), "timers after two visible events").toBe(1);
  });

  it("a page that flips hidden and visible again ends with one timer", () => {
    const { clock, show } = setup();
    clock.subscribe(vi.fn());
    show(false);
    show(true);
    show(false);
    show(true);
    expect(vi.getTimerCount(), "timers after a fast flip").toBe(1);
  });

  it("a page that ends hidden after a fast flip has no timer", () => {
    const { clock, show } = setup();
    clock.subscribe(vi.fn());
    show(false);
    show(true);
    show(false);
    expect(vi.getTimerCount(), "timers after a fast flip that ends hidden").toBe(0);
  });

  it("an unsubscribe on a hidden page removes the page listener", () => {
    const { clock, show, listening } = setup();
    const stop = clock.subscribe(vi.fn());
    show(false);
    stop();
    expect(listening(), "page listeners after the unsubscribe").toBe(0);
  });

  it("a visible event after the last unsubscribe starts nothing", () => {
    const { clock, show } = setup();
    const listener = vi.fn();
    const stop = clock.subscribe(listener);
    show(false);
    stop();
    show(true);
    expect(vi.getTimerCount(), "timers after a late visible event").toBe(0);
    expect(listener, "calls after a late visible event").not.toHaveBeenCalled();
  });

  it("a subscriber that another subscriber removes in a tick is not called", () => {
    const { clock, tick } = setup();
    let stopSecond = () => {};
    clock.subscribe(() => {
      stopSecond();
    });
    const second = vi.fn();
    stopSecond = clock.subscribe(second);
    tick();
    expect(second, "calls of the removed subscriber").not.toHaveBeenCalled();
  });

  it("a subscriber that leaves and joins again in a tick is called once", () => {
    const { clock, tick } = setup();
    let calls = 0;
    let stop = () => {};
    // At most 3 joins, so a loop that visits the new entry again ends with a wrong count.
    const again = () => {
      calls += 1;
      stop();
      if (calls <= 3) stop = clock.subscribe(again);
    };
    stop = clock.subscribe(again);
    tick();
    expect(calls, "calls in one tick").toBe(1);
  });

  it("the last subscriber that leaves in a visible event leaves no timer", () => {
    const { clock, show } = setup();
    const stop = clock.subscribe(() => {
      stop();
    });
    show(false);
    show(true);
    expect(vi.getTimerCount(), "timers after the last subscriber left").toBe(0);
  });

  it("the first read after a long time with no subscriber gives the new time", () => {
    const { clock } = setup();
    const before = clock.now();
    vi.advanceTimersByTime(10 * 60_000);
    expect(clock.now().getTime() - before.getTime(), "age of the first read").toBe(10 * 60_000);
  });

  it("the first read after the system time moved back gives the new time", () => {
    const { clock } = setup();
    clock.now();
    const earlier = new Date(START.getTime() - 10 * 60_000);
    vi.setSystemTime(earlier);
    expect(clock.now().getTime(), "read after a move back").toBe(earlier.getTime());
  });
});
