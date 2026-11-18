import { describe, expect, it } from "vitest";
import { everyOrder, type Model, randomOrders, type Step } from "../../../test/sequences.ts";
import {
  editReducer,
  type EditEvent,
  type EditState,
  editView,
  initialEditState,
} from "./skill-edit-state.ts";
import { isNewer, type SavedPoint, type SkillFields } from "./skill-form.ts";

// Sequences of the skill editor state against a model of the server (testing.md §3, "State table
// cells"; the tables 52 and 53 of docs/plans/p3-skills-page-orders.md). The owner types, types
// the text back, saves and discards; the server takes the Save some time later and its answer comes
// later still; another place saves the skill; loads land in any order. After each step the
// invariants of `check` hold; after the last, every answer and a last load land, and the page must
// agree with the server.

const START: SkillFields = {
  name: "Write user stories",
  slug: "write-user-stories",
  description: "Use it for stories.",
  body_md: "O",
};
const NO_PROBLEMS = { name: null, slug: null, description: null, body_md: null };

interface ServerSkill {
  point: SavedPoint;
  body: string;
}

type Result = { ok: true; skill: ServerSkill } | { ok: false; code: string };

interface EditWorld {
  log: string[];
  server: ServerSkill;
  // The body of the server at each version.
  history: Map<number, string>;
  state: EditState;
  // The Save on its way: the base version it sent, its text, and the server's result once the
  // server took or refused it.
  inFlight: { base: number; body: string; result: Result | null } | null;
  // Loads on their way: the server when each started.
  loads: ServerSkill[];
  // Text that a Discard dropped; it must never show again.
  dropped: Set<string>;
  // The last base and server data, which must never go down.
  lastBase: SavedPoint;
  lastServer: SavedPoint;
  typed: number;
  budget: { saves: number; others: number; discards: number; olderAnswers: number };
}

const viewOf = (world: EditWorld) =>
  editView(world.state, { limitsReason: null, problems: NO_PROBLEMS });

function dispatch(world: EditWorld, event: EditEvent) {
  world.state = editReducer(world.state, event);
}

const pointAt = (version: number): SavedPoint => ({ version, rowVersion: version - 2 });

function newVersion(world: EditWorld, body: string): ServerSkill {
  const skill = { point: pointAt(world.server.point.version + 1), body };
  world.server = skill;
  world.history.set(skill.point.version, body);
  // Its live event starts a load.
  world.loads.push(skill);
  return skill;
}

function takeOnServer(world: EditWorld) {
  const flight = world.inFlight;
  if (flight === null || flight.result !== null) return;
  flight.result =
    flight.base === world.server.point.version
      ? { ok: true, skill: newVersion(world, flight.body) }
      : { ok: false, code: "stale_write" };
}

function answer(world: EditWorld) {
  const flight = world.inFlight;
  if (flight?.result == null) return;
  world.inFlight = null;
  if (flight.result.ok) {
    dispatch(world, { type: "saveAnswered", point: flight.result.skill.point });
  } else {
    dispatch(world, {
      type: "saveFailed",
      error: { error: { code: flight.result.code, message: "Refused." } },
    });
  }
}

function land(world: EditWorld, index: number) {
  const [load] = world.loads.splice(index, 1);
  if (load === undefined) return;
  dispatch(world, {
    type: "serverData",
    fields: { ...START, body_md: load.body },
    point: load.point,
  });
}

function steps(world: EditWorld): Step[] {
  const view = viewOf(world);
  const out: Step[] = [
    {
      label: "type an edit",
      run: () => {
        world.typed += 1;
        dispatch(world, { type: "typed", field: "body_md", value: `E${String(world.typed)}` });
      },
    },
  ];
  if (world.state.form.current.body_md !== world.state.form.saved.body_md) {
    out.push({
      label: "type the text back",
      run: () => {
        dispatch(world, { type: "typed", field: "body_md", value: world.state.form.saved.body_md });
      },
    });
  }
  if (world.budget.saves > 0 && view.saveReason === null && view.changes.length > 0) {
    out.push({
      label: "Save",
      run: () => {
        world.budget.saves -= 1;
        world.inFlight = {
          base: world.state.base.version,
          body: world.state.form.current.body_md,
          result: null,
        };
        dispatch(world, { type: "saveSent" });
      },
    });
  }
  if (world.inFlight?.result === null) {
    out.push({
      label: "the server takes the Save",
      run: () => {
        takeOnServer(world);
      },
    });
  }
  if (world.inFlight?.result != null) {
    out.push({
      label: "the Save's answer",
      run: () => {
        answer(world);
      },
    });
  }
  if (world.budget.others > 0) {
    out.push({
      label: "another place saves",
      run: () => {
        world.budget.others -= 1;
        newVersion(world, `X${String(world.budget.others)}`);
      },
    });
  }
  world.loads.forEach((load, index) => {
    out.push({
      label: `a load of v${String(load.point.version)} lands`,
      run: () => {
        land(world, index);
      },
    });
  });
  if (world.budget.discards > 0 && view.discardReason === null && view.changes.length > 0) {
    out.push({
      label: "Discard",
      run: () => {
        world.budget.discards -= 1;
        const before = world.state.form.current.body_md;
        dispatch(world, { type: "discarded" });
        if (world.state.form.current.body_md !== before) world.dropped.add(before);
      },
    });
  }
  if (world.budget.olderAnswers > 0 && world.state.base.version > 3) {
    out.push({
      label: "a late answer of an older action",
      run: () => {
        world.budget.olderAnswers -= 1;
        dispatch(world, { type: "baseMoved", point: pointAt(world.state.base.version - 1) });
      },
    });
  }
  return out;
}

function check(world: EditWorld) {
  const { state } = world;
  const view = viewOf(world);
  const text = state.form.current.body_md;
  // 1. An edit that the owner dropped never comes back.
  expect(world.dropped.has(text), `dropped text "${text}" is back`).toBe(false);
  // 2. The base and the server data never go down.
  expect(isNewer({ point: world.lastBase, than: state.base }), "the base went down").toBe(false);
  expect(isNewer({ point: world.lastServer, than: state.server.point }), "older data won").toBe(
    false,
  );
  world.lastBase = state.base;
  world.lastServer = state.server.point;
  // 3. Save is off while a conflict shows.
  if (view.conflict) expect(view.saveReason, "Save is on in a conflict").not.toBeNull();
  // 4. "All changes are saved." only when the text is the saved text of the base and no Save waits.
  const savedHere = state.sending === null && text === world.history.get(state.base.version);
  if (view.allSaved) expect(savedHere, "all saved, but the text is not saved").toBe(true);
  // 5. The leave question is on whenever something is not saved.
  if (!savedHere) expect(view.leaveAsks, "leaving would lose text").toBe(true);
}

function settle(world: EditWorld) {
  takeOnServer(world);
  answer(world);
  world.loads = [world.server];
  land(world, 0);
}

function checkSettled(world: EditWorld) {
  const view = viewOf(world);
  const { state, server } = world;
  // The editor shows the server text, or the owner's edit, with the conflict when the server is
  // ahead of the base.
  if (!view.leaveAsks) expect(state.form.current.body_md, "settled text").toBe(server.body);
  expect(view.conflict, "settled conflict").toBe(
    isNewer({ point: server.point, than: state.base }),
  );
  expect(isNewer({ point: state.base, than: server.point }), "base ahead of the server").toBe(
    false,
  );
}

function editModel(budget: EditWorld["budget"]): Model<EditWorld> {
  return {
    start: () => {
      const point = pointAt(3);
      return {
        log: [],
        server: { point, body: START.body_md },
        history: new Map([[3, START.body_md]]),
        state: initialEditState(START, point),
        inFlight: null,
        loads: [],
        dropped: new Set(),
        lastBase: point,
        lastServer: point,
        typed: 0,
        budget: { ...budget },
      };
    },
    copy: (world) => ({
      ...world,
      log: [...world.log],
      history: new Map(world.history),
      inFlight: world.inFlight === null ? null : { ...world.inFlight },
      loads: [...world.loads],
      dropped: new Set(world.dropped),
      budget: { ...world.budget },
    }),
    steps,
    check,
    settle,
    checkSettled,
  };
}

// The size of the work is a count, not a time, as in `bot-edit-sequences.test.ts`: each tree test
// checks its exact number of paths, and the random test has a fixed number of runs and steps. The
// time limit only stops a hang: measured on 2026-11-15, the slowest test took 0.3 s alone.
describe("the skill editor in every order", { timeout: 60_000 }, () => {
  it("every order of a Save, its answer, another place, loads, Discard and typing", () => {
    const paths = everyOrder(editModel({ saves: 1, others: 1, discards: 1, olderAnswers: 1 }), 8);
    expect(paths).toBe(11_540);
  });

  it("every order with two Saves and a late answer of an older action", () => {
    const paths = everyOrder(editModel({ saves: 2, others: 0, discards: 1, olderAnswers: 1 }), 9);
    expect(paths).toBe(9_078);
  });

  it("random orders from a seed, with two Saves and another place", () => {
    randomOrders(editModel({ saves: 2, others: 2, discards: 2, olderAnswers: 1 }), {
      runs: 300,
      length: 24,
      firstSeed: 1,
    });
  });
});
