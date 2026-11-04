import { describe, expect, it } from "vitest";
import {
  BOT_SETTINGS,
  type Bot,
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

// The state of the bot list (bot-page.md §7.1, skills-page.md §2a, pin.md §2): the server value
// and the requests that wait, in send order. The page shows the server value with the requests
// put on it. One test per rule; `bot-list-sequences.test.ts` runs every order and random orders.

const BA = makeBot(1, "BA").id;
const off = makePin({ always_load: false });
const on = makePin({ always_load: true });
const v2 = makePin({ version: 2, skill_version_id: versionId(2) });
const expectedOff = { skill_version_id: off.skill_version_id, always_load: false };
const pinOfBa = { botId: BA, skillId: SKILL_ID };

function run(state: BotListState, ...events: BotListEvent[]): BotListState {
  return events.reduce(botListReducer, state);
}

function start(pins: Bot["pins"] = [off]): BotListState {
  return initialBotListState({ bots: [makeBot(1, "BA", pins)], settings: BOT_SETTINGS });
}

let lastId = 0;
function send(request: BotListRequest): { id: number; event: BotListEvent } {
  lastId += 1;
  return { id: lastId, event: { type: "sent", id: lastId, request } };
}

const toggle = (alwaysLoad = true, expected = expectedOff) =>
  send({ kind: "pin", botId: BA, skillId: SKILL_ID, expected, alwaysLoad });
const move = (expected = expectedOff) =>
  send({ kind: "pin", botId: BA, skillId: SKILL_ID, expected, alwaysLoad: null });
const add = () =>
  send({ kind: "pin", botId: BA, skillId: SKILL_ID, expected: null, alwaysLoad: null });
const remove = () => send({ kind: "remove", botId: BA, skillId: SKILL_ID });

const answered = (id: number, pins?: Bot["pins"]): BotListEvent => ({
  type: "answered",
  id,
  ...(pins === undefined ? {} : { answer: makeBot(1, "BA", pins) }),
});
const refused = (id: number): BotListEvent => ({ type: "refused", id });
const refreshEnded = (id: number): BotListEvent => ({ type: "refreshEnded", id });
const listLoaded = (pins: Bot["pins"]): BotListEvent => ({
  type: "listLoaded",
  bots: [makeBot(1, "BA", pins)],
});

const pinsShown = (state: BotListState) => shownBots(state)?.[0]?.pins;

describe("the bot list with nothing on its way", () => {
  it("shows the server value itself", () => {
    const state = start();
    expect(shownBots(state)).toBe(state.bots);
    expect(shownSettings(state)).toBe(state.settings);
  });

  it("takes each server load", () => {
    const state = run(start(), listLoaded([on]));
    expect(pinsShown(state)).toEqual([on]);
    expect(state.loads).toBe(1);
  });
});

describe("Remove of a skill", () => {
  it("takes the row away at once, with the counts", () => {
    const r = remove();
    const state = run(start(), r.event);
    expect(pinsShown(state)).toEqual([]);
    expect(shownBots(state)?.[0]?.counts.skills).toBe(0);
  });

  it("keeps the row away over a load that lands before the answer", () => {
    const r = remove();
    expect(pinsShown(run(start(), r.event, listLoaded([off])))).toEqual([]);
  });

  it("brings the row back at once when it is refused, with no load after it", () => {
    const r = remove();
    expect(pinsShown(run(start(), r.event, refused(r.id)))).toEqual([off]);
  });

  it("keeps the row away when it is saved, also with no load after it", () => {
    const r = remove();
    const state = run(start(), r.event, answered(r.id));
    expect(pinsShown(state)).toEqual([]);
    expect(state.requests).toEqual([]);
  });

  it("keeps the row away when an older Always load change answers", () => {
    const t = toggle();
    const r = remove();
    expect(pinsShown(run(start(), t.event, r.event, answered(t.id, [on])))).toEqual([]);
  });

  it("puts back the pin of an older change that the server saved when the Remove fails", () => {
    const t = toggle();
    const r = remove();
    const state = run(start(), t.event, r.event, answered(t.id, [on]), refused(r.id));
    expect(pinsShown(state)).toEqual([on]);
  });

  it("ends an older change of its pin when it is saved: that answer writes nothing", () => {
    const t = toggle();
    const r = remove();
    const state = run(start(), t.event, r.event, answered(r.id), answered(t.id, [on]));
    expect(pinsShown(state)).toEqual([]);
  });

  it("shows a skill the owner adds back while the Remove is on its way, and ends the Remove", () => {
    const r = remove();
    const a = add();
    const state = run(start([v2]), r.event, a.event, answered(a.id, [off]));
    expect(pinsShown(state)).toEqual([off]);
    expect(pinsShown(run(state, answered(r.id)))).toEqual([off]);
  });

  it("shows the added pin when a list load landed while the add and the Remove waited", () => {
    const r = remove();
    const a = add();
    const state = run(start([v2]), r.event, a.event, listLoaded([v2]), answered(a.id, [off]));
    expect(pinsShown(state)).toEqual([off]);
  });

  // Sequence test: the Remove answered first, so it no longer waited when the add answered.
  it("shows the added pin when the Remove answers before the add and a load landed", () => {
    const r = remove();
    const a = add();
    const state = run(
      start([v2]),
      r.event,
      a.event,
      listLoaded([off]),
      answered(r.id),
      answered(a.id, [off]),
    );
    expect(pinsShown(state)).toEqual([off]);
  });

  it("keeps the pin an add put back when an older change answers after it", () => {
    const t = toggle();
    const r = remove();
    const a = add();
    const state = run(
      start(),
      t.event,
      r.event,
      a.event,
      answered(a.id, [off]),
      answered(t.id, [on]),
      answered(r.id),
    );
    expect(pinsShown(state)).toEqual([off]);
  });
});

describe("a pin change (Always load, Move, + Add)", () => {
  it("writes its pin at the answer while the page shows the pin it expected", () => {
    const m = move();
    // The answer's pin differs from the one shown, so the test sees the write.
    expect(pinsShown(run(start([off]), m.event, answered(m.id, [v2])))).toEqual([v2]);
  });

  it("writes only its own pin and the counts; every other field stays", () => {
    const other = makePin({ skill_id: typeId("skill", 2), skill_name: "Other" });
    const state = initialBotListState({
      bots: [{ ...makeBot(1, "BA", [v2, other]), description: "Newer.", row_version: 2 }],
      settings: BOT_SETTINGS,
    });
    const m = move({ skill_version_id: versionId(2), always_load: false });
    const answer = {
      ...makeBot(1, "BA", [{ ...makePin(), latest_version: 4 }]),
      description: "Older.",
    };
    const next = run(state, m.event, { type: "answered", id: m.id, answer });
    const bot = shownBots(next)?.[0];
    expect(bot?.description).toBe("Newer.");
    expect(bot?.row_version).toBe(2);
    expect(bot?.pins).toEqual([{ ...makePin(), latest_version: 4 }, other]);
    expect(bot?.counts).toMatchObject({ skills: 2, skill_updates: 1 });
  });

  it("keeps a newer pin that is not the one it expected", () => {
    const m = move();
    const state = run(start([on]), m.event, answered(m.id, [makePin({ version: 1 })]));
    expect(pinsShown(state)).toEqual([on]);
  });

  it("adds a pin only when the page has none of that skill", () => {
    const a = add();
    expect(pinsShown(run(start([]), a.event, answered(a.id, [off])))).toEqual([off]);
    const b = add();
    expect(pinsShown(run(start([v2]), b.event, answered(b.id, [off])))).toEqual([v2]);
  });

  it("writes nothing after a list load that came after it went out", () => {
    const m = move();
    // The load shows the expected pin (on, then off in another tab): it tells nothing, so the
    // answer's pin must not go in.
    const state = run(start([off]), m.event, listLoaded([off]), answered(m.id, [v2]));
    expect(pinsShown(state)).toEqual([off]);
  });

  it("writes nothing when it is refused", () => {
    const m = move();
    expect(pinsShown(run(start([off]), m.event, refused(m.id)))).toEqual([off]);
  });

  it("ends an older change of the same pin when it is saved", () => {
    const first = move();
    const second = move();
    const state = run(
      start([off]),
      first.event,
      second.event,
      answered(second.id, [v2]),
      answered(first.id, [makePin()]),
    );
    expect(pinsShown(state)).toEqual([v2]);
  });

  it("shows nothing in the list while Always load waits; the switch shows the value", () => {
    const t = toggle();
    const state = run(start([off]), t.event);
    expect(pinsShown(state)).toEqual([off]);
    expect(alwaysLoadOnItsWay(state, pinOfBa)).toBe(true);
    expect(alwaysLoadOnItsWay(state, { botId: BA, skillId: typeId("skill", 2) })).toBeNull();
  });

  it("keeps the Always load value on its way until the refresh after the answer ends", () => {
    const t = toggle();
    const saved = run(start([off]), t.event, answered(t.id, [on]));
    expect(pinsShown(saved)).toEqual([on]);
    expect(alwaysLoadOnItsWay(saved, pinOfBa)).toBe(true);
    expect(alwaysLoadOnItsWay(run(saved, refreshEnded(t.id)), pinOfBa)).toBeNull();
    const failed = run(start([off]), t.event, refused(t.id));
    expect(alwaysLoadOnItsWay(failed, pinOfBa)).toBe(true);
    const ended = run(failed, refreshEnded(t.id));
    expect(alwaysLoadOnItsWay(ended, pinOfBa)).toBeNull();
    expect(ended.requests).toEqual([]);
  });

  it("does nothing for an answer that comes after its request ended", () => {
    const t = toggle();
    const state = run(start([off]), t.event, refused(t.id), refreshEnded(t.id));
    expect(run(state, answered(t.id, [on]), refused(t.id), refreshEnded(t.id))).toEqual(state);
  });
});

describe("pinned bots and the sort of the others", () => {
  const ux = makeBot(2, "UX", [], { created_at: "2026-10-21T10:00:00.000Z" });
  const qa = makeBot(3, "QA", [], { created_at: "2026-10-22T10:00:00.000Z" });
  const baPinned = makeBot(1, "BA", [], { pinned_position: 1 });
  // Header order: BA pinned, then the others by creation time, newest first.
  const serverBots = [baPinned, qa, ux];
  const createdDesc = { ...BOT_SETTINGS, bot_order: "created" as const };

  function bots(): BotListState {
    return initialBotListState({ bots: serverBots, settings: createdDesc });
  }
  const names = (state: BotListState) => shownBots(state)?.map((bot) => bot.name);
  const pinned = (ids: string[]) => send({ kind: "pinned", ids });
  const sort = (bot_order_direction: "asc" | "desc") =>
    send({ kind: "sort", order: { bot_order: "created", bot_order_direction } });

  it("shows a pin change at once, also over a load before its answer", () => {
    const p = pinned([baPinned.id, ux.id]);
    const state = run(bots(), p.event);
    expect(names(state)).toEqual(["BA", "UX", "QA"]);
    expect(names(run(state, { type: "listLoaded", bots: serverBots }))).toEqual(["BA", "UX", "QA"]);
  });

  it("keeps a saved pin change with no load after it", () => {
    const p = pinned([]);
    const state = run(bots(), p.event, answered(p.id));
    expect(names(state)).toEqual(["QA", "UX", "BA"]);
    expect(state.requests).toEqual([]);
  });

  it("never brings back an older pin change that answers after a newer one", () => {
    const older = pinned([]);
    const newer = pinned([baPinned.id, ux.id]);
    const state = run(bots(), older.event, newer.event, answered(newer.id), answered(older.id));
    expect(names(state)).toEqual(["BA", "UX", "QA"]);
  });

  it("shows the server's pins when two pin changes fail, in either order", () => {
    const unpinBa = pinned([]);
    const pinUx = pinned([ux.id]);
    const one = run(bots(), unpinBa.event, pinUx.event, refused(unpinBa.id), refused(pinUx.id));
    expect(names(one)).toEqual(["BA", "QA", "UX"]);
    const two = run(bots(), unpinBa.event, pinUx.event, refused(pinUx.id));
    // The older one waits still and shows.
    expect(names(two)).toEqual(["QA", "UX", "BA"]);
    expect(names(run(two, refused(unpinBa.id)))).toEqual(["BA", "QA", "UX"]);
  });

  it("shows the older value when it was saved and the newer one fails", () => {
    const unpinBa = pinned([]);
    const pinUx = pinned([ux.id]);
    const state = run(bots(), unpinBa.event, pinUx.event, answered(unpinBa.id), refused(pinUx.id));
    expect(names(state)).toEqual(["QA", "UX", "BA"]);
  });

  it("shows a sort at once on the settings and the list, also over loads", () => {
    const s = sort("asc");
    const state = run(
      bots(),
      s.event,
      { type: "listLoaded", bots: serverBots },
      { type: "settingsLoaded", settings: createdDesc },
    );
    expect(shownSettings(state)?.bot_order_direction).toBe("asc");
    expect(names(state)).toEqual(["BA", "UX", "QA"]);
  });

  it("puts the pinned order on its way in the sort on its way", () => {
    const s = sort("asc");
    const p = pinned([]);
    const state = run(bots(), s.event, p.event, { type: "settingsLoaded", settings: createdDesc });
    // Oldest first: with the server's sort it would be QA, UX, BA.
    expect(names(state)).toEqual(["BA", "UX", "QA"]);
  });

  it("goes back to the server's sort when a sort is refused, also one another tab saved", () => {
    const s = sort("asc");
    const otherTab = { ...BOT_SETTINGS, bot_order: "recent" as const };
    const state = run(
      bots(),
      s.event,
      { type: "settingsLoaded", settings: otherTab },
      refused(s.id),
    );
    expect(shownSettings(state)?.bot_order).toBe("recent");
  });

  it("keeps a saved sort and its list order with no load after it", () => {
    const s = sort("asc");
    const state = run(bots(), s.event, answered(s.id));
    expect(shownSettings(state)?.bot_order_direction).toBe("asc");
    expect(names(state)).toEqual(["BA", "UX", "QA"]);
    expect(state.requests).toEqual([]);
  });
});

describe("the answer of a Profile or Model save", () => {
  it("writes the fields a save owns into the server value, and keeps the pins", () => {
    const r = remove();
    const answer = { ...makeBot(1, "BA", [v2]), name: "Analyst", row_version: 2 };
    const state = run(start([off]), r.event, { type: "saveAnswered", answer });
    expect(shownBots(state)?.[0]?.name).toBe("Analyst");
    expect(state.bots?.[0]?.pins).toEqual([off]);
    // The Remove still waits, so the row stays away.
    expect(pinsShown(state)).toEqual([]);
  });
});
