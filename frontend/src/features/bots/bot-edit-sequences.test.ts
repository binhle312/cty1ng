import { describe, expect, it } from "vitest";
import { BOT_SETTINGS, makeBot } from "../../../test/fixtures.ts";
import { everyOrder, type Model, randomOrders, type Step } from "../../../test/sequences.ts";
import { type EditTab, editFormOf } from "./bot-edit-form.ts";
import {
  EDIT_TABS,
  type EditEvent,
  editReducer,
  type EditState,
  editView,
  initialEditState,
  type SaveError,
} from "./bot-edit-state.ts";
import { type CreateForm, formSettings } from "./create-bot-form.ts";

// Sequences of the Profile and Model edit state against a model of the server (testing.md §3,
// "State table cells"; bot-page.md §4.2). The owner types, saves and lets the tabs go; the server
// takes the Save at some time and its answer comes later; events and refreshes land in any order
// or fail; another place saves the bot. Two drivers run the same model: every order of a small set
// of steps, and random orders from a seed. After each step the invariants of `check` hold; after
// the last, every answer and load lands and the page must agree with the server.
//
// Not in the model: a Save that the server takes but whose answer is lost on the way. The page
// then shows its own change as a conflict; bot-page.md §4.2, Q4, asks the owner for a rule.

const settings = formSettings(BOT_SETTINGS);
const ctx = { settings, otherNames: ["Designer"] };
const rules = { effective: (form: CreateForm) => ({ ...form.tool_choices }) };
const reduce = editReducer(rules);

// The fields the model changes: one of each tab that the owner types, and the description, which
// only another place changes.
interface ServerBot {
  rowVersion: number;
  name: string;
  description: string;
  limit: number;
  // Who made this version.
  by: "start" | "page" | "other";
}

const TAKEN = "Taken";

const formOf = (bot: ServerBot): CreateForm =>
  editFormOf(
    makeBot(1, "BA", [], {
      row_version: bot.rowVersion,
      name: bot.name,
      description: bot.description,
      request_limit: bot.limit,
    }),
    settings,
  );

type Key = "name" | "description" | "limit";
type Typed = "name" | "limit";
const TAB_KEYS: Record<EditTab, readonly Key[]> = {
  profile: ["name", "description"],
  model: ["limit"],
};
const valueOf = (form: CreateForm, key: Key) => (key === "limit" ? form.request_limit : form[key]);
// The changed field of each key, as the save bar counts it.
const FIELD_OF: Record<Key, string> = {
  name: "name",
  description: "description",
  limit: "request_limit",
};

type Result = { ok: true; rowVersion: number } | { ok: false; error: SaveError };

interface InFlight {
  id: number;
  sent: Extract<EditEvent, { type: "saveSent" }>;
  // Set when the server took or refused it; the answer is on its way then.
  result: Result | null;
}

interface EditWorld {
  log: string[];
  server: ServerBot;
  // The server at each `row_version`.
  history: Map<number, ServerBot>;
  state: EditState;
  inFlight: InFlight | null;
  // Events and refreshes on their way: the server when each started.
  loads: ServerBot[];
  // Values typed since the last let-go; with the server's values, the only ones the form may show.
  typedSince: Record<Typed, Set<string | number>>;
  // Fields typed while the Save waited, which must stay a change after its answer.
  mustStayChanged: { tab: EditTab; fields: string[] } | null;
  budget: { saves: number; others: number };
}

function dispatch(world: EditWorld, event: EditEvent) {
  world.state = reduce(world.state, event);
}

const viewOf = (world: EditWorld) => editView(world.state, { rules, ctx });

function copyWorld(world: EditWorld): EditWorld {
  return {
    ...world,
    log: [...world.log],
    history: new Map(world.history),
    inFlight: world.inFlight === null ? null : { ...world.inFlight },
    loads: [...world.loads],
    typedSince: { name: new Set(world.typedSince.name), limit: new Set(world.typedSince.limit) },
    budget: { ...world.budget },
  };
}

function newVersion(world: EditWorld, next: ServerBot) {
  world.server = next;
  world.history.set(next.rowVersion, next);
  // Its `bot.updated` event.
  world.loads.push(next);
}

function saveOnServer(world: EditWorld, flight: InFlight) {
  const { sent } = flight;
  if (world.server.rowVersion !== sent.base) {
    flight.result = { ok: false, error: { code: "stale_write", message: "Stale." } };
    return;
  }
  if (sent.fields.includes("name") && sent.form.name === TAKEN) {
    flight.result = { ok: false, error: { code: "name_taken", message: "Taken." } };
    return;
  }
  const next: ServerBot = { ...world.server, rowVersion: world.server.rowVersion + 1, by: "page" };
  if (sent.fields.includes("name")) next.name = sent.form.name;
  if (sent.fields.includes("request_limit")) next.limit = sent.form.request_limit;
  newVersion(world, next);
  flight.result = { ok: true, rowVersion: next.rowVersion };
}

// The bot that a Save's answer carries: the server right after it.
function savedForm(world: EditWorld, rowVersion: number): CreateForm {
  const bot = world.history.get(rowVersion);
  if (bot === undefined) throw new Error(`no v${String(rowVersion)}`);
  return formOf(bot);
}

// Another place changed the bot after this `row_version`.
const otherAfter = (world: EditWorld, rowVersion: number) =>
  [...world.history.values()].some((bot) => bot.by === "other" && bot.rowVersion > rowVersion);

// What another place changes, in turn: the description, the name, the limit.
function otherChange(world: EditWorld): ServerBot {
  const next: ServerBot = {
    ...world.server,
    rowVersion: world.server.rowVersion + 1,
    by: "other",
  };
  switch (world.budget.others % 3) {
    case 0:
      next.description = `Other ${String(world.budget.others)}.`;
      break;
    case 1:
      next.name = "Other";
      break;
    default:
      next.limit = 30;
  }
  return next;
}

function typeStep(world: EditWorld, { key, value }: { key: Typed; value: string | number }): Step {
  return {
    label: `type ${key} ${String(value)}`,
    run: () => {
      dispatch(world, {
        type: "typed",
        change: (form) =>
          key === "name"
            ? { ...form, name: String(value) }
            : { ...form, request_limit: Number(value) },
      });
      world.typedSince[key].add(value);
    },
  };
}

// The answer of the Save on its way, and what the page must show right after it.
function answerStep(world: EditWorld, flight: InFlight): Step {
  const result = flight.result;
  if (result === null) throw new Error("no result yet");
  return {
    label: result.ok ? "the answer: saved" : `the answer: ${result.error?.code ?? "failed"}`,
    run: () => {
      const { sent, id } = flight;
      const letGo = world.state.letGo[sent.tab] !== world.state.onItsWay?.letGoAtSend;
      const typedAfter = TAB_KEYS[sent.tab]
        .filter((key) => valueOf(world.state.form, key) !== valueOf(sent.form, key))
        .map((key) => FIELD_OF[key]);
      world.inFlight = null;
      if (result.ok) {
        dispatch(world, {
          type: "saveAnswered",
          id,
          rowVersion: result.rowVersion,
          form: savedForm(world, result.rowVersion),
        });
        if (!letGo && typedAfter.length > 0) {
          world.mustStayChanged = { tab: sent.tab, fields: typedAfter };
        }
        // A let-go tab shows the saved values, except fields typed after the let-go, while the
        // tab is still at the base the Save was sent from.
        if (letGo && world.state.base[sent.tab] === result.rowVersion) {
          for (const key of TAB_KEYS[sent.tab]) {
            if (key === "description" || world.typedSince[key].size > 0) continue;
            expect(valueOf(world.state.form, key), `${key} after a let-go`).toBe(
              valueOf(sent.form, key),
            );
          }
        }
        // The refresh after the answer.
        world.loads.push(world.server);
        return;
      }
      dispatch(world, { type: "saveFailed", id, error: result.error });
      const code = result.error?.code ?? null;
      const view = viewOf(world);
      // A Save the owner let go is a toast; otherwise a stale save is a conflict, a taken name an
      // error under Name while it still has the sent text, and the rest a toast.
      const toasts = world.state.toasts.length;
      if (letGo || code === null) {
        expect(toasts, "one toast").toBe(1);
      } else {
        expect(toasts, "no toast").toBe(0);
      }
      if (!letGo && code === "stale_write" && view.changed[sent.tab].length > 0) {
        expect(view.conflict(sent.tab), "stale is a conflict").toBe(true);
      }
      if (!letGo && code === "name_taken") {
        const still = world.state.form.name === sent.form.name;
        expect(view.errorOf("name") !== null, "the name error").toBe(still);
      }
      dispatch(world, { type: "toastsShown", upTo: world.state.nextToast - 1 });
      if (code === "stale_write") world.loads.push(world.server);
    },
  };
}

function editModel({
  saves,
  others,
  names,
  limits,
}: {
  saves: number;
  others: number;
  names: readonly string[];
  limits: readonly number[];
}): Model<EditWorld> {
  const first: ServerBot = {
    rowVersion: 1,
    name: "BA",
    description: "BA does its job.",
    limit: 10,
    by: "start",
  };
  return {
    start: () => ({
      log: [],
      server: first,
      history: new Map([[1, first]]),
      state: initialEditState({ form: formOf(first), rowVersion: 1 }),
      inFlight: null,
      loads: [],
      typedSince: { name: new Set(), limit: new Set() },
      mustStayChanged: null,
      budget: { saves, others },
    }),
    copy: copyWorld,
    steps: (world) => {
      const steps: Step[] = [];
      const view = viewOf(world);
      for (const value of names) {
        if (world.state.form.name !== value) steps.push(typeStep(world, { key: "name", value }));
      }
      for (const value of limits) {
        if (world.state.form.request_limit !== value) {
          steps.push(typeStep(world, { key: "limit", value }));
        }
      }
      for (const tab of EDIT_TABS) {
        if (world.budget.saves > 0 && view.saveCheck(tab) === "send") {
          steps.push({
            label: `save ${tab}`,
            run: () => {
              const sent = {
                type: "saveSent" as const,
                tab,
                form: world.state.form,
                base: world.state.base[tab],
                fields: viewOf(world).changed[tab],
              };
              const id = world.state.nextSave;
              dispatch(world, sent);
              world.inFlight = { id, sent, result: null };
              world.budget.saves -= 1;
            },
          });
        }
      }
      const flight = world.inFlight;
      if (flight !== null && flight.result === null) {
        steps.push({
          label: "server takes the save",
          run: () => {
            saveOnServer(world, flight);
          },
        });
        steps.push({
          label: "the save fails on the way",
          run: () => {
            flight.result = { ok: false, error: null };
          },
        });
      }
      if (flight !== null && flight.result !== null) steps.push(answerStep(world, flight));
      if (world.budget.others > 0) {
        steps.push({
          label: "another place saves",
          run: () => {
            newVersion(world, otherChange(world));
            world.budget.others -= 1;
          },
        });
      }
      world.loads.forEach((load, i) => {
        steps.push({
          label: `load v${String(load.rowVersion)} lands`,
          run: () => {
            world.loads.splice(i, 1);
            dispatch(world, { type: "serverBot", form: formOf(load), rowVersion: load.rowVersion });
          },
        });
      });
      if (world.loads.length > 0) {
        steps.push({
          label: "the oldest load fails",
          run: () => {
            world.loads.shift();
          },
        });
      }
      if (view.dirtyFields.length > 0) {
        steps.push({
          label: "let go",
          run: () => {
            dispatch(world, { type: "letGo", tabs: EDIT_TABS });
            world.typedSince = { name: new Set(), limit: new Set() };
          },
        });
      }
      return steps;
    },
    check: (world) => {
      const { state } = world;
      const view = viewOf(world);
      // An edit the owner dropped never comes back: the form shows the server's values, or text
      // typed since the last let-go.
      const known = [...world.history.values()];
      for (const key of ["name", "limit"] as const) {
        const value = valueOf(state.form, key);
        expect(
          known.some((bot) => bot[key] === value) || world.typedSince[key].has(value),
          `${key} ${String(value)} was dropped`,
        ).toBe(true);
      }
      for (const tab of EDIT_TABS) {
        // An older answer never replaces a newer value: the values a tab started from are the
        // server's at its base.
        const atBase = world.history.get(state.base[tab]);
        expect(atBase, `${tab} base ${String(state.base[tab])}`).toBeDefined();
        if (atBase !== undefined) {
          for (const key of TAB_KEYS[tab]) {
            expect(valueOf(state.saved, key), `${tab} saved ${key}`).toBe(atBase[key]);
          }
        }
        // A conflict shows only when another place changed the bot after the tab's base.
        if (view.conflict(tab)) {
          expect(otherAfter(world, state.base[tab]), `${tab} conflict with no other change`).toBe(
            true,
          );
          // Save is off while a conflict shows.
          expect(view.saveCheck(tab), `${tab} save in conflict`).toBe("off");
        }
        // At most one Save waits.
        if (state.onItsWay !== null) expect(view.saveCheck(tab)).toBe("off");
        // With nothing waiting and no conflict, a tab with no changes is not behind the server.
        if (state.onItsWay === null && view.changed[tab].length === 0) {
          expect(state.base[tab], `${tab} behind`).toBeGreaterThanOrEqual(state.server.rowVersion);
        }
      }
      // While a Save waits, text that differs from what it sent is unsaved, also text typed back.
      const waiting = state.onItsWay;
      if (waiting !== null && state.letGo[waiting.tab] === waiting.letGoAtSend) {
        for (const key of TAB_KEYS[waiting.tab]) {
          if (valueOf(state.form, key) !== valueOf(waiting.form, key)) {
            expect(view.unsaved[waiting.tab], `${key} differs from the sent text`).toContain(
              FIELD_OF[key],
            );
          }
        }
      }
      // Text typed while a Save waits stays a change.
      const must = world.mustStayChanged;
      if (must !== null) {
        for (const field of must.fields) {
          expect(view.unsaved[must.tab], `${field} typed during the Save`).toContain(field);
        }
        world.mustStayChanged = null;
      }
    },
    settle: (world) => {
      const flight = world.inFlight;
      if (flight !== null) {
        if (flight.result === null) saveOnServer(world, flight);
        const result = flight.result;
        if (result?.ok === true) {
          dispatch(world, {
            type: "saveAnswered",
            id: flight.id,
            rowVersion: result.rowVersion,
            form: savedForm(world, result.rowVersion),
          });
        } else if (result !== null) {
          dispatch(world, { type: "saveFailed", id: flight.id, error: result.error });
        }
        world.inFlight = null;
      }
      for (const load of world.loads) {
        dispatch(world, { type: "serverBot", form: formOf(load), rowVersion: load.rowVersion });
      }
      world.loads = [];
      dispatch(world, {
        type: "serverBot",
        form: formOf(world.server),
        rowVersion: world.server.rowVersion,
      });
    },
    checkSettled: (world) => {
      const { state, server } = world;
      const view = viewOf(world);
      expect(state.onItsWay).toBeNull();
      expect(state.server.rowVersion).toBe(server.rowVersion);
      for (const tab of EDIT_TABS) {
        if (view.changed[tab].length === 0) {
          // A tab with no changes shows the server's values.
          expect(state.base[tab]).toBe(server.rowVersion);
          for (const key of TAB_KEYS[tab]) {
            expect(valueOf(state.form, key), `${tab} ${key}`).toBe(server[key]);
          }
        } else {
          // A tab with changes shows the conflict exactly when another place changed the bot
          // after its base; otherwise it is at the server's row_version.
          const other = otherAfter(world, state.base[tab]);
          expect(view.conflict(tab), `${tab} conflict`).toBe(other);
          if (!other) expect(state.base[tab], `${tab} base`).toBe(server.rowVersion);
        }
      }
    },
  };
}

describe("Profile and Model edit sequences", () => {
  it("every order of a Save, its answer, another place, loads, Discard and typing", () => {
    const paths = everyOrder(
      editModel({ saves: 1, others: 1, names: ["BA", "X", TAKEN], limits: [] }),
      7,
    );
    expect(paths).toBeGreaterThan(1000);
  });

  it("every order with both tabs and two Saves", () => {
    const paths = everyOrder(
      editModel({ saves: 2, others: 0, names: ["BA", "X"], limits: [10, 20] }),
      6,
    );
    expect(paths).toBeGreaterThan(1000);
  });

  it("every order with both tabs and another place that changes the name and the limit", () => {
    const paths = everyOrder(
      editModel({ saves: 1, others: 2, names: ["BA", "X"], limits: [10, 20] }),
      6,
    );
    expect(paths).toBeGreaterThan(1000);
  });

  it("random orders from a seed, with both tabs and another place", () => {
    randomOrders(
      editModel({ saves: 5, others: 4, names: ["BA", "X", "Y", TAKEN], limits: [10, 20] }),
      { runs: 2000, length: 30, firstSeed: 1 },
    );
  });
});
