import { describe, expect, it } from "vitest";
import {
  BOT_SETTINGS,
  makeBot,
  makePin,
  SKILL_ID,
  typeId,
  versionId,
} from "../../../test/fixtures.ts";
import {
  alwaysLoadOnItsWay,
  type BotListEvent,
  type BotListRequest,
  type BotListState,
  botListReducer,
  initialBotListState,
  shownBots,
  shownSettings,
} from "./bot-list-state.ts";
import { pinnedOf, reorderedBots } from "./bot-order.ts";
import type { BotPin, BotRow } from "./bot-queries.ts";

// Sequences of the bot list state against a model of the server (testing.md §3, "State table
// cells"; lesson `two-of-my-requests-at-once.md`). The server takes each request at some time
// after it went out, in any order, and the answers come back in any order. Loads start and land
// at any time, refreshes fail, and another tab changes the server. Two drivers run the same
// model: every order of a small set of steps, and random orders from a seed. A failure prints
// the steps, and the random driver prints its seed.

// ---- A small model world -------------------------------------------------------------------

interface Step {
  label: string;
  run: () => void;
}

interface World<Server> {
  server: Server;
  state: BotListState;
  log: string[];
}

function dispatch<S>(world: World<S>, event: BotListEvent) {
  world.state = botListReducer(world.state, event);
}

// mulberry32: a small seeded random number generator, so a failing run can be run again.
function random(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Model<W> {
  start: () => W;
  copy: (world: W) => W;
  steps: (world: W) => Step[];
  // Throws when the page shows something it must not, after any step.
  check: (world: W) => void;
  // Ends every request and lands a last load; then the page must show the server's value.
  settle: (world: W) => void;
  checkSettled: (world: W) => void;
}

function fail({ log, seed }: { log: readonly string[]; seed?: number }, why: unknown): never {
  const head = seed === undefined ? "" : `seed ${String(seed)}: `;
  const message = why instanceof Error ? why.message : String(why);
  throw new Error(`${head}${message}\nsteps:\n  ${log.join("\n  ")}`);
}

interface Run<W> {
  model: Model<W>;
  seed?: number;
}

function checked<W extends World<unknown>>({ model, seed }: Run<W>, world: W) {
  try {
    model.check(world);
  } catch (error) {
    fail({ log: world.log, ...(seed === undefined ? {} : { seed }) }, error);
  }
}

function settled<W extends World<unknown>>({ model, seed }: Run<W>, world: W) {
  const end = model.copy(world);
  try {
    model.settle(end);
    model.checkSettled(end);
  } catch (error) {
    fail({ log: end.log, ...(seed === undefined ? {} : { seed }) }, error);
  }
}

// Every order: each path through the steps, up to `depth` steps.
function everyOrder<W extends World<unknown>>(model: Model<W>, depth: number): number {
  let paths = 0;
  const walk = (world: W, left: number) => {
    checked({ model }, world);
    const steps = model.steps(world);
    if (left === 0 || steps.length === 0) {
      settled({ model }, world);
      paths += 1;
      return;
    }
    for (let i = 0; i < steps.length; i += 1) {
      const next = model.copy(world);
      const step = model.steps(next)[i];
      if (step === undefined) continue;
      next.log.push(step.label);
      step.run();
      walk(next, left - 1);
    }
  };
  walk(model.start(), depth);
  return paths;
}

function randomOrders<W extends World<unknown>>(
  model: Model<W>,
  { runs, length, firstSeed }: { runs: number; length: number; firstSeed: number },
) {
  for (let seed = firstSeed; seed < firstSeed + runs; seed += 1) {
    const next = random(seed);
    const world = model.start();
    for (let n = 0; n < length; n += 1) {
      const steps = model.steps(world);
      const step = steps[Math.floor(next() * steps.length)];
      if (step === undefined) break;
      world.log.push(step.label);
      step.run();
      checked({ model, seed }, world);
    }
    settled({ model, seed }, world);
  }
}

// ---- Skill pins of one bot --------------------------------------------------------------------

const BOT = makeBot(1, "BA").id;
const SKILLS = [SKILL_ID, typeId("skill", 2)] as const;
type SkillId = (typeof SKILLS)[number];

interface ServerPin {
  version: number;
  alwaysLoad: boolean;
}
type PinServer = Partial<Record<SkillId, ServerPin | null>>;
const pinIn = (server: PinServer, skillId: SkillId): ServerPin | null => server[skillId] ?? null;

function pinRow(skillId: SkillId, pin: ServerPin): BotPin {
  return makePin({
    skill_id: skillId,
    skill_name: skillId === SKILL_ID ? "Write user stories" : "Review code",
    version: pin.version,
    skill_version_id: versionId(pin.version),
    always_load: pin.alwaysLoad,
  });
}

const botOf = (server: PinServer): BotRow =>
  makeBot(
    1,
    "BA",
    SKILLS.flatMap((skillId) => {
      const pin = pinIn(server, skillId);
      return pin === null ? [] : [pinRow(skillId, pin)];
    }),
  );

type PinRequestKind = "toggle" | "move" | "add" | "remove";
type Outcome = "takes" | "fails" | "loses";
interface PinRequest {
  id: number;
  kind: PinRequestKind;
  skillId: SkillId;
  expected: ServerPin | null;
  // What a toggle, move or add sets.
  value: ServerPin | null;
  // Set when the server took or refused it; the answer is on its way then.
  done: { ok: boolean; answer: BotRow } | null;
  // A newer request of the same pin was saved before this one answered: the server has a newer
  // value, so this one's answer changes nothing.
  ended: boolean;
  // Sent while a Remove of the same pin waited.
  afterRemove: boolean;
}

interface PinWorld extends World<PinServer> {
  sent: PinRequest[];
  // The requests whose answer has not come yet.
  open: PinRequest[];
  // Always load changes whose refresh has not ended.
  refreshing: number[];
  // The server after each change, oldest first; a load holds the index of its snapshot.
  history: PinServer[];
  load: { server: PinServer; at: number } | null;
  // The snapshot of the last load that landed.
  loadedAt: number;
  budget: number;
  otherTab: boolean;
  loadsLand: boolean;
  // The newest request of each pin that the server took, and the pins the page cannot know
  // without a load: the server took an older request after a newer one (a pin has no version,
  // so a toggle after a Remove and an add looks like the add), or it took a request whose answer
  // was lost. The checks with no load skip those pins.
  taken: Partial<Record<SkillId, number>>;
  unknown: SkillId[];
  // Pins with an answer since the last load that the spec lets in also after a load: a saved
  // Remove, and an add sent while a Remove waited. Another tab's newer value can hide behind
  // them until the next load.
  blind: SkillId[];
}

const samePin = (a: ServerPin | null, b: ServerPin | null) =>
  a === null || b === null ? a === b : a.version === b.version && a.alwaysLoad === b.alwaysLoad;

function shownPin(world: PinWorld, skillId: SkillId): ServerPin | null {
  const pin = shownBots(world.state)?.[0]?.pins.find((item) => item.skill_id === skillId);
  return pin === undefined ? null : { version: pin.version, alwaysLoad: pin.always_load };
}

function pinModel({
  budget,
  otherTab,
  loadsLand,
  skills = SKILLS,
}: {
  budget: number;
  otherTab: boolean;
  loadsLand: boolean;
  skills?: readonly SkillId[];
}): Model<PinWorld> {
  const start = (): PinWorld => {
    const server: PinServer = {
      [SKILLS[0]]: { version: 2, alwaysLoad: false },
      [SKILLS[1]]: null,
    };
    return {
      server,
      state: initialBotListState({ bots: [botOf(server)], settings: BOT_SETTINGS }),
      log: [],
      sent: [],
      open: [],
      refreshing: [],
      history: [{ ...server }],
      load: null,
      loadedAt: 0,
      budget,
      otherTab,
      loadsLand,
      taken: {},
      unknown: [],
      blind: [],
    };
  };
  const copy = (world: PinWorld): PinWorld => {
    const sent = world.sent.map((request) => ({ ...request }));
    const byId = new Map(sent.map((request) => [request.id, request]));
    return {
      ...world,
      server: { ...world.server },
      log: [...world.log],
      sent,
      open: world.open.map((request) => byId.get(request.id) ?? request),
      refreshing: [...world.refreshing],
      history: [...world.history],
      load: world.load === null ? null : { ...world.load },
      taken: { ...world.taken },
      unknown: [...world.unknown],
      blind: [...world.blind],
    };
  };

  function setServer(
    world: PinWorld,
    { skillId, pin }: { skillId: SkillId; pin: ServerPin | null },
  ) {
    world.server = { ...world.server, [skillId]: pin };
    world.history.push(world.server);
  }

  function send(
    world: PinWorld,
    request: Omit<PinRequest, "id" | "done" | "ended" | "afterRemove">,
  ) {
    const id = world.sent.length + 1;
    const afterRemove = world.open.some(
      (other) => other.kind === "remove" && other.skillId === request.skillId && !other.ended,
    );
    const mine: PinRequest = { ...request, id, done: null, ended: false, afterRemove };
    world.sent.push(mine);
    world.open.push(mine);
    world.budget -= 1;
    const sent: BotListRequest =
      request.kind === "remove"
        ? { kind: "remove", botId: BOT, skillId: request.skillId }
        : {
            kind: "pin",
            botId: BOT,
            skillId: request.skillId,
            expected:
              request.expected === null
                ? null
                : {
                    skill_version_id: versionId(request.expected.version),
                    always_load: request.expected.alwaysLoad,
                  },
            alwaysLoad: request.kind === "toggle" ? (request.value?.alwaysLoad ?? null) : null,
          };
    dispatch(world, { type: "sent", id, request: sent });
  }

  // The server takes the request, or refuses it as stale (409), or fails (500), or takes it
  // and the answer is lost on the way (the page sees a failure).
  function take(world: PinWorld, { request, outcome }: { request: PinRequest; outcome: Outcome }) {
    const { skillId } = request;
    if (outcome === "fails") {
      request.done = { ok: false, answer: botOf(world.server) };
      return;
    }
    const newest = world.taken[skillId] ?? 0;
    if (newest > request.id) world.unknown.push(skillId);
    world.taken[skillId] = Math.max(newest, request.id);
    const ok = request.kind === "remove" || samePin(pinIn(world.server, skillId), request.expected);
    if (ok) setServer(world, { skillId, pin: request.kind === "remove" ? null : request.value });
    if (outcome === "loses" && ok) world.unknown.push(skillId);
    request.done = { ok: ok && outcome === "takes", answer: botOf(world.server) };
  }

  function answer(world: PinWorld, request: PinRequest) {
    const done = request.done;
    if (done === null) return;
    world.open = world.open.filter((other) => other !== request);
    if (done.ok && !request.ended && (request.kind === "remove" || request.afterRemove)) {
      world.blind.push(request.skillId);
    }
    if (done.ok && !request.ended) {
      for (const other of world.open) {
        if (other.skillId === request.skillId && other.id < request.id) other.ended = true;
      }
    }
    if (done.ok) {
      dispatch(
        world,
        request.kind === "remove"
          ? { type: "answered", id: request.id }
          : { type: "answered", id: request.id, answer: done.answer },
      );
    } else {
      dispatch(world, { type: "refused", id: request.id });
    }
    if (request.kind === "toggle" && !request.ended) world.refreshing.push(request.id);
  }

  const steps = (world: PinWorld): Step[] => {
    const out: Step[] = [];
    if (world.budget > 0) {
      for (const skillId of skills) {
        const pin = shownPin(world, skillId);
        if (pin === null) {
          out.push({
            label: `add ${skillId}`,
            run: () => {
              send(world, {
                kind: "add",
                skillId,
                expected: null,
                value: { version: 3, alwaysLoad: false },
              });
            },
          });
          continue;
        }
        if (alwaysLoadOnItsWay(world.state, { botId: BOT, skillId }) === null) {
          out.push({
            label: `toggle ${skillId} to ${String(!pin.alwaysLoad)}`,
            run: () => {
              send(world, {
                kind: "toggle",
                skillId,
                expected: pin,
                value: { ...pin, alwaysLoad: !pin.alwaysLoad },
              });
            },
          });
        }
        out.push(
          {
            label: `move ${skillId} from v${String(pin.version)}`,
            run: () => {
              send(world, {
                kind: "move",
                skillId,
                expected: pin,
                value: { ...pin, version: pin.version === 3 ? 2 : 3 },
              });
            },
          },
          {
            label: `remove ${skillId}`,
            run: () => {
              send(world, { kind: "remove", skillId, expected: pin, value: null });
            },
          },
        );
      }
    }
    for (const request of world.open) {
      const name = `#${String(request.id)} ${request.kind}`;
      if (request.done === null) {
        out.push(
          {
            label: `server takes ${name}`,
            run: () => {
              take(world, { request, outcome: "takes" });
            },
          },
          {
            label: `server fails ${name} (500)`,
            run: () => {
              take(world, { request, outcome: "fails" });
            },
          },
          {
            label: `server takes ${name}, and the answer is lost`,
            run: () => {
              take(world, { request, outcome: "loses" });
            },
          },
        );
      } else {
        out.push({
          label: `${name} answers ${request.done.ok ? "ok" : "refused"}`,
          run: () => {
            answer(world, request);
          },
        });
      }
    }
    for (const id of world.refreshing) {
      out.push({
        label: `refresh after #${String(id)} ends`,
        run: () => {
          world.refreshing = world.refreshing.filter((other) => other !== id);
          dispatch(world, { type: "refreshEnded", id });
        },
      });
    }
    if (world.loadsLand) {
      out.push({
        label: "a list load starts",
        run: () => {
          world.load = { server: world.server, at: world.history.length - 1 };
        },
      });
      const load = world.load;
      if (load !== null) {
        out.push({
          label: "the list load lands",
          run: () => {
            world.load = null;
            world.loadedAt = load.at;
            world.blind = [];
            dispatch(world, { type: "listLoaded", bots: [botOf(load.server)] });
          },
        });
      }
    }
    if (world.otherTab) {
      for (const skillId of skills) {
        const pin = pinIn(world.server, skillId);
        out.push({
          label: `another tab ${pin === null ? "adds" : "toggles"} ${skillId}`,
          run: () => {
            setServer(world, {
              skillId,
              pin:
                pin === null
                  ? { version: 3, alwaysLoad: false }
                  : { ...pin, alwaysLoad: !pin.alwaysLoad },
            });
          },
        });
      }
    }
    return out;
  };

  // The switch shows the value of the newest Always load change of the pin that waits, or
  // whose refresh has not ended; none when a newer saved request ended it.
  const checkSwitch = (world: PinWorld) => {
    for (const skillId of skills) {
      const live = world.sent.filter(
        (request) =>
          request.kind === "toggle" &&
          request.skillId === skillId &&
          ((world.open.includes(request) && !request.ended) ||
            world.refreshing.includes(request.id)),
      );
      const want = live.at(-1)?.value?.alwaysLoad ?? null;
      const got = alwaysLoadOnItsWay(world.state, { botId: BOT, skillId });
      if (got !== want) {
        throw new Error(
          `the ${skillId} switch shows ${String(got)} on its way, not ${String(want)}`,
        );
      }
    }
  };

  // With loads: a pin with no request on its way shows a value the server had at or after the
  // snapshot of the last load that landed (with another tab, except after a blind answer). An older answer never puts back a
  // value that a newer load replaced.
  const checkSinceLoad = (world: PinWorld) => {
    if (!world.loadsLand) return;
    for (const skillId of skills) {
      if (world.unknown.includes(skillId)) continue;
      if (world.otherTab && world.blind.includes(skillId)) continue;
      if (world.open.some((request) => request.skillId === skillId)) continue;
      const shown = shownPin(world, skillId);
      const since = world.history.slice(world.loadedAt);
      if (!since.some((server) => samePin(pinIn(server, skillId), shown))) {
        throw new Error(
          `${skillId} shows ${JSON.stringify(shown)}, which the server has not had since the last load`,
        );
      }
    }
  };

  const check = (world: PinWorld) => {
    for (const skillId of skills) {
      // A Remove that waits hides its row, unless the owner added the skill again after it.
      const removing = world.open.find(
        (request) => request.kind === "remove" && request.skillId === skillId,
      );
      const addedAfter =
        removing !== undefined &&
        world.sent.some(
          (request) =>
            request.kind === "add" && request.skillId === skillId && request.id > removing.id,
        );
      if (removing !== undefined && !addedAfter && shownPin(world, skillId) !== null) {
        throw new Error(`the row of ${skillId} shows while its Remove waits`);
      }
      // With no other tab and no load, the server value is only what this page sent: when no
      // request of a pin waits for its answer, the page shows the server's pin.
      const waits = world.open.some((request) => request.skillId === skillId);
      const known = !world.unknown.includes(skillId);
      if (!world.otherTab && !world.loadsLand && !waits && known) {
        const shown = shownPin(world, skillId);
        if (!samePin(shown, pinIn(world.server, skillId))) {
          throw new Error(
            `${skillId} shows ${JSON.stringify(shown)}, the server has ${JSON.stringify(pinIn(world.server, skillId))}`,
          );
        }
      }
    }
    checkSwitch(world);
    checkSinceLoad(world);
  };

  const settle = (world: PinWorld) => {
    world.log.push("— settle: the server takes the rest, every answer comes, a last load lands");
    for (const request of world.open) {
      if (request.done === null) take(world, { request, outcome: "takes" });
    }
    for (const request of [...world.open]) answer(world, request);
    for (const id of world.refreshing) dispatch(world, { type: "refreshEnded", id });
    world.refreshing = [];
    if (!world.otherTab && !world.loadsLand) check(world);
    dispatch(world, { type: "listLoaded", bots: [botOf(world.server)] });
  };

  const checkSettled = (world: PinWorld) => {
    if (world.state.requests.length > 0) {
      throw new Error(`requests left: ${JSON.stringify(world.state.requests)}`);
    }
    for (const skillId of skills) {
      if (!samePin(shownPin(world, skillId), pinIn(world.server, skillId))) {
        throw new Error(`${skillId} does not show the server's pin after the last load`);
      }
      if (alwaysLoadOnItsWay(world.state, { botId: BOT, skillId }) !== null) {
        throw new Error(`${skillId} keeps an Always load value on its way`);
      }
    }
  };

  return { start, copy, steps, check, settle, checkSettled };
}

describe("skill pins: every order of a small set of steps", () => {
  it("one skill, two requests, no load: the page ends on the server's pin", () => {
    const paths = everyOrder(
      pinModel({ budget: 2, otherTab: false, loadsLand: false, skills: [SKILL_ID] }),
      8,
    );
    // Every path ends: two requests, each taken and answered, and the refreshes.
    expect(paths).toBeGreaterThan(300);
  });

  it("one skill, two requests, with loads", () => {
    const paths = everyOrder(
      pinModel({ budget: 2, otherTab: false, loadsLand: true, skills: [SKILL_ID] }),
      8,
    );
    expect(paths).toBeGreaterThan(1000);
  });
});

describe("skill pins: random orders", () => {
  it("this page alone, no load lands: each pin shows the server's pin when nothing waits", () => {
    randomOrders(pinModel({ budget: 5, otherTab: false, loadsLand: false }), {
      runs: 400,
      length: 24,
      firstSeed: 1,
    });
  });

  it("this page alone, with loads: a pin shows a value the server had since the last load", () => {
    randomOrders(pinModel({ budget: 5, otherTab: false, loadsLand: true }), {
      runs: 2000,
      length: 24,
      firstSeed: 40_001,
    });
  });

  it("with loads and another tab: a waiting Remove hides its row, and the end shows the server", () => {
    randomOrders(pinModel({ budget: 5, otherTab: true, loadsLand: true }), {
      runs: 4000,
      length: 24,
      firstSeed: 10_001,
    });
  });
});

// ---- Pinned bots and the sort -----------------------------------------------------------------
// With loads, another tab also changes the pins and the sort.

const BOTS = [
  makeBot(1, "BA", [], { created_at: "2026-10-20T10:00:00.000Z" }),
  makeBot(2, "UX", [], { created_at: "2026-10-21T10:00:00.000Z" }),
  makeBot(3, "QA", [], { created_at: "2026-10-22T10:00:00.000Z" }),
];

interface OrderServer {
  pinned: readonly string[];
  direction: "asc" | "desc";
}

const listOf = (server: OrderServer) =>
  reorderedBots(BOTS, {
    pinnedIds: server.pinned,
    order: {
      bot_order: "created",
      bot_order_direction: server.direction,
    },
  });
const settingsOf = (server: OrderServer) => ({
  ...BOT_SETTINGS,
  bot_order: "created" as const,
  bot_order_direction: server.direction,
});

interface OrderRequest {
  id: number;
  kind: "pinned" | "sort";
  ids: readonly string[];
  expected: readonly string[];
  direction: "asc" | "desc";
  done: { ok: boolean } | null;
}

interface OrderWorld extends World<OrderServer> {
  open: OrderRequest[];
  sent: number;
  // The newest request of each kind that answered ok: older ones never show after it.
  saved: { pinned: number; sort: number };
  // The newest request of each kind the server took, and whether it took an older one after it.
  // A sort sends no expected value, and a pinned list can have the same value twice (pin, unpin,
  // pin), so the last one the server takes wins, and only a load tells the page.
  taken: { pinned: number; sort: number };
  unordered: { pinned: boolean; sort: boolean };
  budget: number;
  listLoad: OrderServer | null;
  settingsLoad: OrderServer | null;
}

const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, i) => id === b[i]);

function orderModel({
  budget,
  loadsLand,
}: {
  budget: number;
  loadsLand: boolean;
}): Model<OrderWorld> {
  const start = (): OrderWorld => {
    const server: OrderServer = { pinned: [BOTS[0]?.id ?? ""], direction: "desc" };
    return {
      server,
      state: initialBotListState({ bots: listOf(server), settings: settingsOf(server) }),
      log: [],
      open: [],
      sent: 0,
      saved: { pinned: 0, sort: 0 },
      taken: { pinned: 0, sort: 0 },
      unordered: { pinned: false, sort: false },
      budget,
      listLoad: null,
      settingsLoad: null,
    };
  };
  const copy = (world: OrderWorld): OrderWorld => ({
    ...world,
    server: { ...world.server },
    log: [...world.log],
    open: world.open.map((request) => ({ ...request })),
    saved: { ...world.saved },
    taken: { ...world.taken },
    unordered: { ...world.unordered },
  });
  const shownPinned = (world: OrderWorld) =>
    pinnedOf(shownBots(world.state) ?? []).map((b) => b.id);
  const shownDirection = (world: OrderWorld) => shownSettings(world.state)?.bot_order_direction;

  const steps = (world: OrderWorld): Step[] => {
    const out: Step[] = [];
    const send = (request: Omit<OrderRequest, "id" | "done">) => {
      world.sent += 1;
      const mine: OrderRequest = { ...request, id: world.sent, done: null };
      world.open.push(mine);
      world.budget -= 1;
      dispatch(world, {
        type: "sent",
        id: mine.id,
        request:
          request.kind === "pinned"
            ? { kind: "pinned", ids: request.ids }
            : {
                kind: "sort",
                order: { bot_order: "created", bot_order_direction: request.direction },
              },
      });
    };
    if (world.budget > 0) {
      const pinned = shownPinned(world);
      for (const bot of BOTS) {
        const ids = pinned.includes(bot.id)
          ? pinned.filter((id) => id !== bot.id)
          : [...pinned, bot.id];
        out.push({
          label: `${pinned.includes(bot.id) ? "unpin" : "pin"} ${bot.name}`,
          run: () => {
            send({ kind: "pinned", ids, expected: pinned, direction: "desc" });
          },
        });
      }
      const direction = shownDirection(world) === "desc" ? "asc" : "desc";
      out.push({
        label: `sort ${direction}`,
        run: () => {
          send({ kind: "sort", ids: [], expected: [], direction });
        },
      });
    }
    for (const request of world.open) {
      const name = `#${String(request.id)} ${request.kind}`;
      if (request.done === null) {
        out.push(
          {
            label: `server takes ${name}`,
            run: () => {
              if (world.taken[request.kind] > request.id) world.unordered[request.kind] = true;
              world.taken[request.kind] = Math.max(world.taken[request.kind], request.id);
              if (request.kind === "sort") {
                world.server.direction = request.direction;
                request.done = { ok: true };
                return;
              }
              const ok = sameIds(world.server.pinned, request.expected);
              if (ok) world.server.pinned = request.ids;
              request.done = { ok };
            },
          },
          {
            label: `server fails ${name} (500)`,
            run: () => {
              request.done = { ok: false };
            },
          },
        );
      } else {
        const ok = request.done.ok;
        out.push({
          label: `${name} answers ${ok ? "ok" : "refused"}`,
          run: () => {
            world.open = world.open.filter((other) => other !== request);
            if (ok) world.saved[request.kind] = Math.max(world.saved[request.kind], request.id);
            dispatch(
              world,
              ok ? { type: "answered", id: request.id } : { type: "refused", id: request.id },
            );
          },
        });
      }
    }
    if (loadsLand) {
      out.push(
        {
          label: "a list load starts",
          run: () => {
            world.listLoad = { ...world.server };
          },
        },
        {
          label: "a settings load starts",
          run: () => {
            world.settingsLoad = { ...world.server };
          },
        },
      );
      // Another tab pins or unpins a bot, or flips the sort.
      for (const bot of BOTS) {
        const pinnedThere = world.server.pinned.includes(bot.id);
        out.push({
          label: `another tab ${pinnedThere ? "unpins" : "pins"} ${bot.name}`,
          run: () => {
            world.server = {
              ...world.server,
              pinned: pinnedThere
                ? world.server.pinned.filter((id) => id !== bot.id)
                : [...world.server.pinned, bot.id],
            };
          },
        });
      }
      out.push({
        label: "another tab flips the sort",
        run: () => {
          world.server = {
            ...world.server,
            direction: world.server.direction === "desc" ? "asc" : "desc",
          };
        },
      });
      const list = world.listLoad;
      if (list !== null) {
        out.push({
          label: "the list load lands",
          run: () => {
            world.listLoad = null;
            dispatch(world, { type: "listLoaded", bots: listOf(list) });
          },
        });
      }
      const settings = world.settingsLoad;
      if (settings !== null) {
        out.push({
          label: "the settings load lands",
          run: () => {
            world.settingsLoad = null;
            dispatch(world, { type: "settingsLoaded", settings: settingsOf(settings) });
          },
        });
      }
    }
    return out;
  };

  const showsServer = (world: OrderWorld, { afterLoad }: { afterLoad: boolean }) => {
    const names = (bots: readonly BotRow[] | undefined) => bots?.map((bot) => bot.name).join(" ");
    if (afterLoad || !world.unordered.pinned) {
      if (!sameIds(shownPinned(world), world.server.pinned)) {
        throw new Error("the page does not show the server's pinned bots");
      }
    }
    if (!afterLoad && (world.unordered.pinned || world.unordered.sort)) return;
    if (shownDirection(world) !== world.server.direction) {
      throw new Error("the page does not show the server's sort");
    }
    if (names(shownBots(world.state)) !== names(listOf(world.server))) {
      throw new Error(`the list is in the wrong order: ${String(names(shownBots(world.state)))}`);
    }
  };

  const check = (world: OrderWorld) => {
    // While a pin change or a sort waits, the list is in the order of the pins and the sort it
    // shows. With nothing on its way it is the server's list, and a list load and a settings
    // load from different times can disagree until the next load of both.
    const shown = shownBots(world.state) ?? [];
    const computed = !loadsLand || world.state.requests.length > 0;
    const ordered = reorderedBots(shown, {
      pinnedIds: shownPinned(world),
      order: {
        bot_order: "created",
        bot_order_direction: shownDirection(world) ?? "desc",
      },
    });
    if (computed && ordered.map((bot) => bot.id).join() !== shown.map((bot) => bot.id).join()) {
      throw new Error("the list is not in the order of the pins and the sort it shows");
    }
    // A newest request that waits shows its value.
    const newestPinned = world.open.findLast(
      (request) => request.kind === "pinned" && request.id > world.saved.pinned,
    );
    if (newestPinned !== undefined && !sameIds(shownPinned(world), newestPinned.ids)) {
      throw new Error("the newest pin change that waits does not show");
    }
    const newestSort = world.open.findLast(
      (request) => request.kind === "sort" && request.id > world.saved.sort,
    );
    if (newestSort !== undefined && shownDirection(world) !== newestSort.direction) {
      throw new Error("the newest sort that waits does not show");
    }
    if (!loadsLand && world.open.length === 0) showsServer(world, { afterLoad: false });
  };

  const settle = (world: OrderWorld) => {
    world.log.push("— settle");
    for (const request of world.open) {
      if (request.done !== null) {
        dispatch(
          world,
          request.done.ok
            ? { type: "answered", id: request.id }
            : { type: "refused", id: request.id },
        );
      } else {
        dispatch(world, { type: "refused", id: request.id });
      }
    }
    world.open = [];
    if (!loadsLand) showsServer(world, { afterLoad: false });
    dispatch(world, { type: "listLoaded", bots: listOf(world.server) });
    dispatch(world, { type: "settingsLoaded", settings: settingsOf(world.server) });
  };

  const checkSettled = (world: OrderWorld) => {
    if (world.state.requests.length > 0) throw new Error("requests left");
    showsServer(world, { afterLoad: true });
  };

  return { start, copy, steps, check, settle, checkSettled };
}

describe("pinned bots and the sort", () => {
  it("every order of two changes with no load: the page ends on the server's order", () => {
    expect(everyOrder(orderModel({ budget: 2, loadsLand: false }), 6)).toBeGreaterThan(300);
  });

  it("random orders with loads", () => {
    randomOrders(orderModel({ budget: 5, loadsLand: true }), {
      runs: 400,
      length: 24,
      firstSeed: 20_001,
    });
  });

  it("random orders with no load", () => {
    randomOrders(orderModel({ budget: 5, loadsLand: false }), {
      runs: 400,
      length: 24,
      firstSeed: 30_001,
    });
  });
});
