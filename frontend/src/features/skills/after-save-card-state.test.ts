import { describe, expect, it } from "vitest";
import { everyOrder, type Model, type Step } from "../../../test/sequences.ts";
import {
  type AfterSaveCard,
  type AfterSaveCardEvent,
  afterSaveCardReducer,
  type AfterSaveCardState,
  cardToast,
  initialAfterSaveCardState,
} from "./after-save-card-state.ts";

// The card after a save (skills-page.md §7): one test per cell of the table in
// `after-save-card-state.ts`, then every order of two saves against a small model.

const upgrade = (version: number): AfterSaveCard => ({
  kind: "upgrade",
  skillId: "skill",
  skillName: "Skill",
  version,
  versionId: `version-${String(version)}`,
  candidates: [],
});
const V2 = upgrade(2);
const V3 = upgrade(3);

const run = (state: AfterSaveCardState, ...events: AfterSaveCardEvent[]) =>
  events.reduce(afterSaveCardReducer, state);
const start = () => initialAfterSaveCardState();
const asked: AfterSaveCardEvent = { type: "asked" };
const read = (turn: number, card: AfterSaveCard): AfterSaveCardEvent => ({
  type: "cardRead",
  turn,
  card,
});
const closed = (card: AfterSaveCard): AfterSaveCardEvent => ({ type: "closed", card });
const left: AfterSaveCardEvent = { type: "pageLeft" };
const entered: AfterSaveCardEvent = { type: "pageEntered" };

describe("the card after a save: its read ends", () => {
  it("the newest save asked, and the page is here: the card opens", () => {
    const state = run(start(), asked, read(1, V2));
    expect(state.card).toBe(V2);
    expect(state.toasts).toEqual([]);
  });

  it("a newer save asked: its toast, and no card", () => {
    const state = run(start(), asked, asked, read(1, V2));
    expect(state.card).toBeNull();
    expect(state.toasts).toEqual([cardToast(V2)]);
  });

  it("a newer save asked, and its card is open: the newer card stays", () => {
    const state = run(start(), asked, asked, read(2, V3), read(1, V2));
    expect(state.card).toBe(V3);
    expect(state.toasts).toEqual([cardToast(V2)]);
  });

  it("the page is gone: its toast", () => {
    const state = run(start(), asked, left, read(1, V2));
    expect(state.card).toBeNull();
    expect(state.toasts).toEqual([cardToast(V2)]);
  });

  it("a newer card replaces the one that is open", () => {
    const state = run(start(), asked, read(1, V2), asked, read(2, V3));
    expect(state.card).toBe(V3);
    expect(state.toasts).toEqual([]);
  });
});

describe("the card after a save: close", () => {
  it("the card on screen: it closes", () => {
    expect(run(start(), asked, read(1, V2), closed(V2)).card).toBeNull();
  });

  it("another card: nothing", () => {
    expect(run(start(), asked, read(1, V3), closed(V2)).card).toBe(V3);
  });

  it("no card: nothing", () => {
    const state = start();
    expect(afterSaveCardReducer(state, closed(V2))).toBe(state);
  });
});

describe("the card after a save: the page", () => {
  it("goes: the card goes", () => {
    expect(run(start(), asked, read(1, V2), left).card).toBeNull();
  });

  it("comes back (StrictMode mounts twice): a card opens again", () => {
    expect(run(start(), left, entered, asked, read(1, V2)).card).toBe(V2);
  });
});

// ---- Every order of two saves -------------------------------------------------------------------

interface World {
  log: string[];
  state: AfterSaveCardState;
  // The saves that asked, oldest first; each read ends once.
  reading: { turn: number; card: AfterSaveCard }[];
  next: number;
  pageHere: boolean;
  newestAsked: number;
  wantCard: AfterSaveCard | null;
  wantToasts: string[];
}

function act(world: World, event: AfterSaveCardEvent) {
  world.state = afterSaveCardReducer(world.state, event);
}

const CARDS = [V2, V3] as const;

function readEnds(world: World, read_: { turn: number; card: AfterSaveCard }) {
  act(world, read(read_.turn, read_.card));
  world.reading = world.reading.filter((other) => other !== read_);
  if (world.pageHere && read_.turn === world.newestAsked) world.wantCard = read_.card;
  else world.wantToasts.push(cardToast(read_.card));
}

const model: Model<World> = {
  start: () => ({
    log: [],
    state: start(),
    reading: [],
    next: 0,
    pageHere: true,
    newestAsked: 0,
    wantCard: null,
    wantToasts: [],
  }),
  copy: (world) => ({
    ...world,
    log: [...world.log],
    reading: [...world.reading],
    wantToasts: [...world.wantToasts],
  }),
  steps: (world) => {
    const steps: Step[] = [];
    const card = CARDS[world.next];
    if (world.pageHere && card !== undefined) {
      steps.push({
        label: `save asks for ${card.versionId}`,
        run: () => {
          act(world, asked);
          world.next += 1;
          world.newestAsked = world.next;
          world.reading.push({ turn: world.next, card });
        },
      });
    }
    for (const reading of world.reading) {
      steps.push({
        label: `read of ${reading.card.versionId} ends`,
        run: () => {
          readEnds(world, reading);
        },
      });
    }
    const shown = world.wantCard;
    if (shown !== null) {
      steps.push({
        label: `close ${shown.versionId}`,
        run: () => {
          act(world, closed(shown));
          world.wantCard = null;
        },
      });
    }
    if (world.pageHere) {
      steps.push({
        label: "leave the page",
        run: () => {
          act(world, left);
          world.pageHere = false;
          world.wantCard = null;
        },
      });
    }
    return steps;
  },
  check: (world) => {
    expect(world.state.card).toBe(world.wantCard);
    expect(world.state.toasts).toEqual(world.wantToasts);
  },
  settle: (world) => {
    for (const reading of [...world.reading]) readEnds(world, reading);
  },
  checkSettled: (world) => {
    expect(world.state.card).toBe(world.wantCard);
    expect(world.state.toasts).toEqual(world.wantToasts);
    // Each save ends as its card or as its toast; an older card never shows after a newer one.
    const count = (world.wantCard === null ? 0 : 1) + world.wantToasts.length;
    expect(count).toBeLessThanOrEqual(world.next);
  },
};

describe("the card after a save: every order of two saves", () => {
  it("an older card never replaces a newer one, and a card that cannot show is its toast", () => {
    expect(everyOrder(model, 7)).toBeGreaterThan(20);
  });
});
