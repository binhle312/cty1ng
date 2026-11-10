import { describe, expect, it } from "vitest";
import { type Logged, type Model, randomOrders } from "../../../test/sequences.ts";
import {
  type LifeAction,
  type LifeEvent,
  type StreamLife,
  startLife,
  stepLife,
} from "./stream-life.ts";

// The state table of realtime-events.md §3, "Stream life": one test for each cell.
const idle = (streams: number): StreamLife => ({ kind: "idle", streams });
const live = (streams: number, readOnReady: boolean): StreamLife => ({
  kind: "live",
  streams,
  readOnReady,
});
const waiting = (streams: number): StreamLife => ({ kind: "waiting", streams });

describe("stream life: page start", () => {
  it("a visible page opens stream 1, which does not read all", () => {
    expect(startLife(true)).toEqual({
      state: live(1, false),
      actions: [{ type: "open", stream: 1 }],
    });
  });

  it("a hidden page opens no stream", () => {
    expect(startLife(false)).toEqual({ state: idle(0), actions: [] });
  });

  it("a page that starts hidden: its first stream reads all", () => {
    const { state } = stepLife(startLife(false).state, { type: "visible" });
    expect(state).toEqual(live(1, true));
    expect(stepLife(state, { type: "ready", stream: 1 }).actions).toEqual([{ type: "readAll" }]);
  });
});

describe("stream life: hidden, no stream", () => {
  it("hidden: stays", () => {
    expect(stepLife(idle(3), { type: "hidden" })).toEqual({ state: idle(3), actions: [] });
  });

  it("visible: opens a new stream that reads all", () => {
    expect(stepLife(idle(3), { type: "visible" })).toEqual({
      state: live(4, true),
      actions: [{ type: "open", stream: 4 }],
    });
  });

  it.each<LifeEvent>([
    { type: "stopped", stream: 3 },
    { type: "timer", stream: 3 },
    { type: "ready", stream: 3 },
  ])("a late $type of the closed stream is ignored", (event) => {
    expect(stepLife(idle(3), event)).toEqual({ state: idle(3), actions: [] });
  });
});

describe("stream life: visible, live", () => {
  it("hidden: closes the stream", () => {
    expect(stepLife(live(2, true), { type: "hidden" })).toEqual({
      state: idle(2),
      actions: [{ type: "close" }],
    });
  });

  it("visible: stays, with no second stream", () => {
    expect(stepLife(live(2, true), { type: "visible" })).toEqual({
      state: live(2, true),
      actions: [],
    });
  });

  it("stopped for good: closes what is left and starts the timer", () => {
    expect(stepLife(live(2, false), { type: "stopped", stream: 2 })).toEqual({
      state: waiting(2),
      actions: [{ type: "close" }, { type: "startTimer", stream: 2 }],
    });
  });

  it("the stop of an older stream is ignored", () => {
    expect(stepLife(live(2, false), { type: "stopped", stream: 1 })).toEqual({
      state: live(2, false),
      actions: [],
    });
  });

  it("a timer is ignored: a live stream has no timer", () => {
    expect(stepLife(live(2, true), { type: "timer", stream: 1 })).toEqual({
      state: live(2, true),
      actions: [],
    });
  });

  it("the first ready of a new stream reads all, one time", () => {
    const first = stepLife(live(2, true), { type: "ready", stream: 2 });
    expect(first).toEqual({ state: live(2, false), actions: [{ type: "readAll" }] });
    // The browser's own reconnect sends `ready` again in the same stream: the server replays.
    expect(stepLife(first.state, { type: "ready", stream: 2 })).toEqual({
      state: live(2, false),
      actions: [],
    });
  });

  it("the ready of the stream of page start does not read all", () => {
    expect(stepLife(startLife(true).state, { type: "ready", stream: 1 })).toEqual({
      state: live(1, false),
      actions: [],
    });
  });

  it("the ready of an older stream is ignored, and the new stream still reads", () => {
    expect(stepLife(live(2, true), { type: "ready", stream: 1 })).toEqual({
      state: live(2, true),
      actions: [],
    });
  });
});

describe("stream life: visible, waiting", () => {
  it("hidden: cancels the timer", () => {
    expect(stepLife(waiting(2), { type: "hidden" })).toEqual({
      state: idle(2),
      actions: [{ type: "cancelTimer" }],
    });
  });

  it("visible: stays", () => {
    expect(stepLife(waiting(2), { type: "visible" })).toEqual({ state: waiting(2), actions: [] });
  });

  it("timer: opens a new stream that reads all", () => {
    expect(stepLife(waiting(2), { type: "timer", stream: 2 })).toEqual({
      state: live(3, true),
      actions: [{ type: "open", stream: 3 }],
    });
  });

  it.each<LifeEvent>([
    { type: "timer", stream: 1 },
    { type: "stopped", stream: 2 },
    { type: "ready", stream: 2 },
  ])("a late $type is ignored", (event) => {
    expect(stepLife(waiting(2), event)).toEqual({ state: waiting(2), actions: [] });
  });
});

// A small boundary: it does the actions as start.ts does, and keeps what exists.
interface World extends Logged {
  state: StreamLife;
  visible: boolean;
  open: number[]; // the numbers of the streams that are open
  timers: number[]; // the stream numbers of the timers that wait
  everOpened: number[];
  reads: number;
  // The reference model, kept apart from the module: the streams that still owe a read.
  owes: Set<number>;
  expectedReads: number;
}

function act(world: World, actions: LifeAction[]) {
  for (const action of actions) {
    switch (action.type) {
      case "open":
        world.open.push(action.stream);
        world.everOpened.push(action.stream);
        world.owes.add(action.stream);
        break;
      case "close":
        world.open = [];
        break;
      case "startTimer":
        world.timers.push(action.stream);
        break;
      case "cancelTimer":
        world.timers = [];
        break;
      case "readAll":
        world.reads += 1;
        break;
      default: {
        const _exhaustive: never = action;
        return _exhaustive;
      }
    }
  }
}

function send(world: World, event: LifeEvent) {
  const { state, actions } = stepLife(world.state, event);
  world.state = state;
  act(world, actions);
}

function lifeModel(startVisible: boolean): Model<World> {
  return {
    start: () => {
      const { state, actions } = startLife(startVisible);
      const world: World = {
        log: [],
        state,
        visible: startVisible,
        open: [],
        timers: [],
        everOpened: [],
        reads: 0,
        owes: new Set(),
        expectedReads: 0,
      };
      act(world, actions);
      // The stream of page start owes no read: the page reads its data at that time.
      world.owes.clear();
      return world;
    },
    copy: (world) => structuredClone(world),
    steps: (world) => {
      // Any stream that was ever opened can still send a late status or a late `ready`.
      const any = world.everOpened;
      return [
        {
          label: "hidden",
          run: () => {
            world.visible = false;
            send(world, { type: "hidden" });
          },
        },
        {
          label: "visible",
          run: () => {
            world.visible = true;
            send(world, { type: "visible" });
          },
        },
        ...any.map((stream) => ({
          label: `stopped ${String(stream)}`,
          run: () => {
            send(world, { type: "stopped", stream });
          },
        })),
        ...any.map((stream) => ({
          label: `ready ${String(stream)}`,
          run: () => {
            // The model: only an open stream that owes a read gives one.
            if (world.open.includes(stream) && world.owes.delete(stream)) world.expectedReads += 1;
            send(world, { type: "ready", stream });
          },
        })),
        // A timer fires only while it waits (the boundary cancels it), and also late: an old one.
        ...[...new Set([...world.timers, ...any])].map((stream) => ({
          label: `timer ${String(stream)}`,
          run: () => {
            world.timers = world.timers.filter((t) => t !== stream);
            send(world, { type: "timer", stream });
          },
        })),
      ];
    },
    check: (world) => {
      expect(world.open.length, "at most one stream").toBeLessThanOrEqual(1);
      expect(world.timers.length, "at most one timer").toBeLessThanOrEqual(1);
      expect(
        world.open.length + world.timers.length,
        "a stream and a timer together",
      ).toBeLessThanOrEqual(1);
      if (!world.visible) {
        expect(world.open, "a stream while hidden").toEqual([]);
        expect(world.timers, "a timer while hidden").toEqual([]);
      } else {
        expect(
          world.open.length + world.timers.length,
          "a visible tab with no stream and no timer",
        ).toBe(1);
      }
      expect(world.reads, "reads").toBe(world.expectedReads);
    },
    settle: (world) => {
      world.visible = true;
      send(world, { type: "visible" });
      const [timer] = world.timers;
      if (timer !== undefined) {
        world.timers = [];
        send(world, { type: "timer", stream: timer });
      }
      const [stream] = world.open;
      if (stream !== undefined) {
        if (world.owes.delete(stream)) world.expectedReads += 1;
        send(world, { type: "ready", stream });
      }
    },
    checkSettled: (world) => {
      expect(world.state.kind).toBe("live");
      expect(world.open).toHaveLength(1);
      expect(world.reads).toBe(world.expectedReads);
      expect(world.owes.has(world.open[0] ?? -1)).toBe(false);
    },
  };
}

describe("stream life: orders", () => {
  it("five returns to the tab: each return opens one new stream", () => {
    let { state } = startLife(true);
    const opened: number[] = [];
    for (let n = 0; n < 5; n += 1) {
      state = stepLife(state, { type: "hidden" }).state;
      const shown = stepLife(state, { type: "visible" });
      state = shown.state;
      opened.push(...shown.actions.flatMap((a) => (a.type === "open" ? [a.stream] : [])));
    }
    expect(opened, "five returns").toEqual([2, 3, 4, 5, 6]);
  });

  it("stopped, then hidden before the timer, then visible: the old timer opens nothing", () => {
    let state = startLife(true).state;
    state = stepLife(state, { type: "stopped", stream: 1 }).state;
    state = stepLife(state, { type: "hidden" }).state;
    const shown = stepLife(state, { type: "visible" });
    expect(shown.actions).toEqual([{ type: "open", stream: 2 }]);
    expect(stepLife(shown.state, { type: "timer", stream: 1 }).actions, "old timer").toEqual([]);
  });

  it("random orders keep the invariants (page starts visible)", () => {
    randomOrders(lifeModel(true), { runs: 300, length: 40, firstSeed: 1 });
  });

  it("random orders keep the invariants (page starts hidden)", () => {
    randomOrders(lifeModel(false), { runs: 300, length: 40, firstSeed: 1000 });
  });
});
