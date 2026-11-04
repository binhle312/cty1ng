import { describe, expect, it } from "vitest";
import { BOT_SETTINGS, type Bot, makeBot } from "../../../test/fixtures.ts";
import { type EditTab, editFormOf } from "./bot-edit-form.ts";
import {
  type EditEvent,
  editReducer,
  type EditState,
  editView,
  initialEditState,
  type SaveError,
} from "./bot-edit-state.ts";
import { type CreateForm, formSettings } from "./create-bot-form.ts";

// The edit state of the Profile and Model tabs: one test per cell of the table in bot-page.md
// §4.2, named "<row>: <column>". `bot-edit-sequences.test.ts` runs every order and random orders.

const settings = formSettings(BOT_SETTINGS);
const ctx = { settings, otherNames: ["Designer"] };
const rules = { effective: (form: CreateForm) => ({ ...form.tool_choices }) };
const reduce = editReducer(rules);

const formAt = (rowVersion: number, overrides: Partial<Bot> = {}) =>
  editFormOf(makeBot(1, "BA", [], { row_version: rowVersion, ...overrides }), settings);

function start(): EditState {
  return initialEditState({ form: formAt(1), rowVersion: 1 });
}

function run(state: EditState, ...events: EditEvent[]): EditState {
  return events.reduce(reduce, state);
}

const view = (state: EditState) => editView(state, { rules, ctx });

const typed = (patch: Partial<CreateForm>): EditEvent => ({
  type: "typed",
  change: (form) => ({ ...form, ...patch }),
});
const name = (value: string) => typed({ name: value });
const limit = (value: number) => typed({ request_limit: value });

// The Save of the tab as the page sends it: the form, base and changed fields now.
const sent = (state: EditState, tab: EditTab = "profile"): EditEvent => ({
  type: "saveSent",
  tab,
  form: state.form,
  base: state.base[tab],
  fields: view(state).changed[tab],
});
function send(state: EditState, tab: EditTab = "profile"): EditState {
  return run(state, sent(state, tab));
}
// The answers of the first Save of a test (id 1), unless it says another.
// The answer carries the bot as the server saved it; by default the bot at that row_version
// with the name "BA two".
const answered = (
  rowVersion: number,
  {
    id = 1,
    form = formAt(rowVersion, { name: "BA two" }),
  }: { id?: number; form?: CreateForm } = {},
): EditEvent => ({ type: "saveAnswered", id, rowVersion, form });
const failed = (error: SaveError, id = 1): EditEvent => ({ type: "saveFailed", id, error });
const stale: SaveError = { code: "stale_write", message: "Changed in another place." };
const nameTaken: SaveError = { code: "name_taken", message: "Taken." };
const server = (rowVersion: number, overrides: Partial<Bot> = {}): EditEvent => ({
  type: "serverBot",
  form: formAt(rowVersion, overrides),
  rowVersion,
});
const letGo = (tabs: readonly EditTab[] = ["profile", "model"]): EditEvent => ({
  type: "letGo",
  tabs,
});

describe("Type a value", () => {
  it("No changes: the tab has changes", () => {
    const state = run(start(), name("BA two"));
    expect(view(state).unsaved.profile).toEqual(["name"]);
    expect(view(state).barState("profile")).toEqual({ kind: "changes", count: 1, avatar: false });
  });

  it("Changes: a server error on that field goes", () => {
    let state = send(run(start(), name("Designer two")));
    state = run(state, failed(nameTaken));
    expect(view(state).errorOf("name")).toContain("is taken");
    state = run(state, name("Designer three"));
    expect(view(state).errorOf("name")).toBeNull();
  });

  it("This tab's Save on its way: a change after the Save, counted against what it sent", () => {
    let state = send(run(start(), name("BA two")));
    state = run(state, name("BA three"));
    expect(view(state).unsaved.profile).toEqual(["name"]);
    state = run(state, answered(2));
    expect(state.saved.name).toBe("BA two");
    expect(view(state).changed.profile).toEqual(["name"]);
  });

  it("Conflict: the text is kept and the conflict stays", () => {
    let state = run(start(), name("BA two"), server(2, { description: "New." }));
    expect(view(state).conflict("profile")).toBe(true);
    state = run(state, typed({ persona_md: "Mine." }));
    expect(state.form.name).toBe("BA two");
    expect(view(state).conflict("profile")).toBe(true);
  });
});

describe("Type back to the saved value", () => {
  it("Changes: no changes, and the tab takes newer values", () => {
    let state = run(start(), name("BA two"), server(2, { description: "New." }));
    state = run(state, name("BA"));
    expect(view(state).unsaved.profile).toEqual([]);
    expect(state.form.description).toBe("New.");
    expect(state.base.profile).toBe(2);
  });

  it("This tab's Save on its way: still a change, because it differs from what the Save sent", () => {
    let state = send(run(start(), name("BA two")));
    state = run(state, name("BA"));
    expect(view(state).unsaved.profile).toEqual(["name"]);
    expect(view(state).dirtyFields).toEqual(["name"]);
    state = run(state, answered(2));
    expect(view(state).changed.profile).toEqual(["name"]);
  });

  it("Refused as stale: no changes, and the tab takes the newest values", () => {
    let state = send(run(start(), name("BA two")));
    state = run(state, failed(stale), server(2, { description: "New." }));
    expect(view(state).conflict("profile")).toBe(true);
    state = run(state, name("BA"));
    expect(view(state).conflict("profile")).toBe(false);
    expect(state.form.description).toBe("New.");
    expect(state.base.profile).toBe(2);
  });
});

describe("Save (button, Ctrl+S)", () => {
  it("No changes: off", () => {
    expect(view(start()).saveCheck("profile")).toBe("off");
    expect(view(start()).barState("profile")).toEqual({ kind: "clean" });
  });

  it("Changes: sends the changed fields with the tab's row_version", () => {
    const state = run(start(), name("BA two"), limit(20));
    expect(view(state).saveCheck("profile")).toBe("send");
    const after = send(state);
    expect(after.onItsWay).toMatchObject({ tab: "profile", base: 1, fields: ["name"] });
    expect(view(after).saving).toBe("profile");
  });

  it("Changes with errors: shows them and says Fix {n} fields", () => {
    let state = run(start(), name(""));
    expect(view(state).saveCheck("profile")).toBe("errors");
    expect(view(state).errorOf("name")).toBeNull();
    state = run(state, { type: "saveTried", tab: "profile" });
    expect(view(state).errorOf("name")).toBe("Required");
    expect(view(state).barState("profile")).toEqual({ kind: "errors", count: 1 });
  });

  it("This tab's Save on its way: off", () => {
    const state = run(send(run(start(), name("BA two"))), name("BA three"));
    expect(view(state).saveCheck("profile")).toBe("off");
  });

  it("A second saveSent while one waits changes nothing", () => {
    const state = send(run(start(), name("BA two")));
    expect(send(run(state, limit(20)), "model")).toEqual(run(state, limit(20)));
  });

  it("Conflict: off", () => {
    const state = run(start(), name("BA two"), server(2));
    expect(view(state).saveCheck("profile")).toBe("off");
    expect(view(state).barState("profile")).toEqual({ kind: "conflict" });
  });
});

describe("Save while the other tab's Save is on its way", () => {
  it("No changes: off", () => {
    const state = send(run(start(), name("BA two")));
    expect(view(state).saveCheck("model")).toBe("off");
  });

  it("Conflict: off", () => {
    // The Model save is refused as stale; the refresh moves the Profile tab, which has no
    // changes, to the new row_version, and the owner saves it.
    let state = run(send(run(start(), limit(20)), "model"), failed(stale), server(2));
    state = send(run(state, name("BA two")));
    expect(state.onItsWay?.tab).toBe("profile");
    expect(view(state).conflict("model")).toBe(true);
    expect(view(state).saveCheck("model")).toBe("off");
  });

  it("Changes: off, says which tab to wait for, and turns on at the new row_version", () => {
    let state = send(run(start(), name("BA two"), limit(20)));
    expect(view(state).waitingFor("model")).toBe("profile");
    expect(view(state).waitingFor("profile")).toBeNull();
    expect(view(state).saveCheck("model")).toBe("off");
    state = run(state, answered(2));
    expect(view(state).waitingFor("model")).toBeNull();
    expect(state.base.model).toBe(2);
    expect(view(state).saveCheck("model")).toBe("send");
  });
});

describe("The Save answers", () => {
  it("saved values are what it sent, and every tab at the same row_version moves on", () => {
    const state = run(send(run(start(), name("BA two"))), answered(2));
    expect(state.saved.name).toBe("BA two");
    expect(state.base).toEqual({ profile: 2, model: 2 });
    expect(state.onItsWay).toBeNull();
    expect(view(state).unsaved.profile).toEqual([]);
  });

  it("writes only the fields of its tab: the other tab's changes stay", () => {
    const state = run(send(run(start(), name("BA two"), limit(20))), answered(2));
    expect(view(state).changed.model).toEqual(["request_limit"]);
    expect(state.saved.request_limit).toBe(10);
  });

  it("a let-go tab shows the saved values", () => {
    const state = run(send(run(start(), name("BA two"))), letGo(), answered(2));
    expect(state.form.name).toBe("BA two");
    expect(view(state).unsaved.profile).toEqual([]);
  });

  it("a field typed after the let-go keeps its text, as a change", () => {
    const state = run(
      send(run(start(), name("BA two"))),
      letGo(),
      typed({ description: "Mine." }),
      answered(2),
    );
    expect(state.form.name).toBe("BA two");
    expect(state.form.description).toBe("Mine.");
    expect(view(state).changed.profile).toEqual(["description"]);
    expect(view(state).conflict("profile")).toBe(false);
  });

  it("a tab that a Discard moved to a newer row_version keeps it", () => {
    const state = run(
      send(run(start(), name("BA two"))),
      server(3, { name: "BA three" }),
      letGo(),
      answered(2),
    );
    expect(state.form.name).toBe("BA three");
    expect(state.base.profile).toBe(3);
  });

  it("a let-go after the answer, before its event, loads the saved values at the new row_version", () => {
    const state = run(send(run(start(), name("BA two"))), name("BA"), answered(2), letGo());
    expect(state.base).toEqual({ profile: 2, model: 2 });
    expect(state.form.name).toBe("BA two");
    expect(view(state).conflict("profile")).toBe(false);
    // The save's own event changes nothing then.
    expect(run(state, server(2, { name: "BA two" }))).toBe(state);
  });

  it("with no Save on its way, changes nothing", () => {
    const state = run(start(), name("BA two"));
    expect(run(state, answered(2))).toBe(state);
  });
});

describe("The Save is refused as stale (409)", () => {
  it("conflict at once, Save off, and the text stays", () => {
    const state = run(send(run(start(), name("BA two"))), failed(stale));
    expect(view(state).conflict("profile")).toBe(true);
    expect(view(state).saveCheck("profile")).toBe("off");
    expect(state.form.name).toBe("BA two");
    expect(state.toasts).toEqual([]);
  });

  it("let go: a toast says the change was lost, and the dropped edit does not come back", () => {
    const state = run(send(run(start(), name("BA two"))), letGo(), failed(stale));
    expect(state.form.name).toBe("BA");
    expect(state.toasts).toEqual([
      { id: 1, text: "BA changed in another place, so the app did not save your change." },
    ]);
    expect(view(state).conflict("profile")).toBe(false);
  });
});

describe("The Save is refused as stale (409): the other tab", () => {
  it("let go: a tab with changes typed after the let-go shows the conflict too", () => {
    let state = run(send(run(start(), name("BA two"))), letGo(), limit(20));
    state = run(state, failed(stale));
    expect(state.toasts).toHaveLength(1);
    expect(view(state).conflict("model")).toBe(true);
    expect(view(state).saveCheck("model")).toBe("off");
  });

  it("a tab with no changes then is in conflict when the owner types, until a refresh moves it", () => {
    let state = run(send(run(start(), name("BA two"))), failed(stale), limit(20));
    expect(view(state).conflict("model")).toBe(true);
    state = run(state, limit(10), server(2), limit(20));
    expect(view(state).conflict("model")).toBe(false);
  });

  it("a tab with changes at the same row_version shows the conflict too", () => {
    const state = run(send(run(start(), name("BA two"), limit(20))), failed(stale));
    expect(view(state).conflict("model")).toBe(true);
    expect(view(state).saveCheck("model")).toBe("off");
  });
});

describe("The Save gets name_taken or a field error", () => {
  it("the error shows under the field that still has the sent text", () => {
    const state = run(send(run(start(), name("Old BA"))), failed(nameTaken));
    expect(view(state).errorOf("name")).toBe(
      "Old BA is taken by another bot, maybe one in Trash. Pick another name.",
    );
    expect(view(state).barState("profile")).toEqual({ kind: "errors", count: 1 });
  });

  it("no error on a field changed while the Save waited", () => {
    const state = run(send(run(start(), name("Old BA"))), name("New BA"), failed(nameTaken));
    expect(view(state).errorOf("name")).toBeNull();
  });

  it("a field error of the tab shows under its field", () => {
    const error = { code: "validation", message: "Too short.", field: "description" };
    const state = run(send(run(start(), typed({ description: "x" }))), failed(error));
    expect(view(state).errorOf("description")).toBe("Too short.");
    expect(state.toasts).toEqual([]);
  });

  it("a field error of the other tab is a toast", () => {
    const error = { code: "validation", message: "Too big.", field: "request_limit" };
    const state = run(send(run(start(), name("BA two"))), failed(error));
    expect(state.toasts).toEqual([{ id: 1, text: "Could not save BA. Try again." }]);
  });

  it("let go: a toast, and the dropped name does not come back", () => {
    const state = run(send(run(start(), name("Old BA"))), letGo(), failed(nameTaken));
    expect(state.form.name).toBe("BA");
    expect(state.toasts).toEqual([
      { id: 1, text: "Could not save BA: Old BA is taken by another bot, maybe one in Trash." },
    ]);
    expect(view(state).errorOf("name")).toBeNull();
  });
});

describe("The Save fails another way", () => {
  it("a toast, and the text stays", () => {
    const state = run(send(run(start(), name("BA two"))), failed(null));
    expect(state.toasts).toEqual([{ id: 1, text: "Could not save BA. Try again." }]);
    expect(view(state).unsaved.profile).toEqual(["name"]);
    expect(view(state).saveCheck("profile")).toBe("send");
  });

  it("toastsShown takes the shown toasts away", () => {
    const state = run(send(run(start(), name("BA two"))), failed(null));
    expect(run(state, { type: "toastsShown", upTo: 1 }).toasts).toEqual([]);
  });
});

describe("A newer row_version (event, refresh, another tab)", () => {
  it("No changes: takes the new values", () => {
    const state = run(start(), server(2, { name: "BA two" }));
    expect(state.form.name).toBe("BA two");
    expect(state.base).toEqual({ profile: 2, model: 2 });
  });

  it("Changes: conflict", () => {
    const state = run(start(), name("Mine"), server(2, { name: "Theirs" }));
    expect(view(state).conflict("profile")).toBe(true);
    expect(state.form.name).toBe("Mine");
    // The other tab has no changes, so it takes the new values.
    expect(state.base.model).toBe(2);
  });

  // Q4 (owner, 2026-11-04): nothing of the owner's would be lost, so there is nothing to ask.
  it("Changes the server already has: takes the new values, with no conflict (Q4)", () => {
    const state = run(start(), name("BA two"), server(2, { name: "BA two", description: "New." }));
    expect(view(state).conflict("profile")).toBe(false);
    expect(view(state).changed.profile).toEqual([]);
    expect(state.base.profile).toBe(2);
    expect(state.form.description).toBe("New.");
  });

  it("Changes the server has only in part: conflict (Q4)", () => {
    const state = run(
      start(),
      name("BA two"),
      typed({ persona_md: "Mine." }),
      server(2, { name: "BA two" }),
    );
    expect(view(state).conflict("profile")).toBe(true);
    expect(state.form.persona_md).toBe("Mine.");
  });

  it("a Save the server took whose answer was lost: its event shows no conflict (Q4)", () => {
    let state = run(send(run(start(), name("BA two"))), failed(null));
    state = run(state, server(2, { name: "BA two" }));
    expect(view(state).conflict("profile")).toBe(false);
    expect(view(state).dirtyFields).toEqual([]);
    expect(state.base).toEqual({ profile: 2, model: 2 });
  });

  it("Changes while the other tab's Save waits: no conflict; the answer decides (Q1)", () => {
    let state = send(run(start(), name("BA two"), limit(20)));
    state = run(state, server(2, { name: "BA two" }));
    expect(view(state).conflict("model")).toBe(false);
    state = run(state, answered(2));
    expect(view(state).conflict("model")).toBe(false);
    expect(state.base.model).toBe(2);
  });

  it("Changes while the other tab's Save waits: a newer one left after the answer is a conflict", () => {
    let state = send(run(start(), name("BA two"), limit(20)));
    state = run(state, server(3, { description: "Theirs." }));
    state = run(state, answered(2));
    expect(view(state).conflict("model")).toBe(true);
  });

  it("This tab's Save on its way: no conflict, and it waits for the answer", () => {
    let state = send(run(start(), name("BA two")));
    state = run(state, name("BA"), server(2, { name: "BA two" }));
    expect(view(state).conflict("profile")).toBe(false);
    expect(state.form.name).toBe("BA");
    state = run(state, answered(2));
    expect(view(state).conflict("profile")).toBe(false);
    expect(view(state).changed.profile).toEqual(["name"]);
  });

  it("Refused as stale: the conflict stays", () => {
    const state = run(send(run(start(), name("BA two"))), failed(stale), server(2));
    expect(view(state).conflict("profile")).toBe(true);
    expect(state.form.name).toBe("BA two");
  });

  it("an older row_version changes nothing", () => {
    const state = run(start(), server(3, { name: "BA three" }));
    expect(run(state, server(2, { name: "BA two" }))).toBe(state);
  });
});

describe("The same row_version (a pin, the pinned order)", () => {
  it("never blocks an edit", () => {
    const state = run(start(), name("Mine"));
    expect(run(state, server(1))).toBe(state);
    expect(view(state).conflict("profile")).toBe(false);
  });
});

describe("A refresh fails", () => {
  it("Refused as stale: keeps its conflict (no newer bot comes)", () => {
    const state = run(send(run(start(), name("BA two"))), failed(stale), limit(20));
    expect(view(state).conflict("profile")).toBe(true);
  });
});

describe("Discard or Esc", () => {
  it("Changes: drops both tabs' changes and shows the newest values", () => {
    const state = run(
      start(),
      name("Mine"),
      limit(20),
      server(2, { description: "New." }),
      letGo(),
    );
    expect(view(state).dirtyFields).toEqual([]);
    expect(state.form.description).toBe("New.");
    expect(state.base).toEqual({ profile: 2, model: 2 });
  });

  it("This tab's Save on its way: drops the change; the Save goes on", () => {
    const state = run(send(run(start(), name("BA two"))), name("BA three"), letGo());
    expect(state.onItsWay).not.toBeNull();
    expect(view(state).dirtyFields).toEqual([]);
    expect(view(state).saving).toBe("profile");
  });

  it("Refused as stale: loads the newest values again and the conflict goes", () => {
    let state = run(send(run(start(), name("BA two"))), failed(stale));
    state = run(state, letGo(["profile"]));
    expect(view(state).conflict("profile")).toBe(false);
    expect(state.staleAt.profile).toBeNull();
    expect(state.form.name).toBe("BA");
  });

  it("drops the server errors and the tried Saves of the let-go tabs only", () => {
    let state = run(start(), name(""), { type: "saveTried", tab: "profile" });
    state = run(state, limit(0), { type: "saveTried", tab: "model" }, letGo(["profile"]));
    expect(state.tried).toEqual(new Set(["model"]));
    expect(view(state).errorOf("request_limit")).not.toBeNull();
  });
});

describe("Leave (another tab, bot or page; ← Back)", () => {
  it("names the changed fields of both tabs", () => {
    const state = run(start(), name("Mine"), limit(20));
    expect(view(state).dirtyFields).toEqual(["name", "request_limit"]);
  });

  it("This tab's Save on its way: nothing is unsaved after the answer", () => {
    let state = send(run(start(), name("BA two")));
    expect(view(state).dirtyFields).toEqual(["name"]);
    state = run(state, answered(2));
    expect(view(state).dirtyFields).toEqual([]);
  });

  it("This tab's Save on its way: text typed during the Save is still unsaved after it", () => {
    const state = run(send(run(start(), name("BA two"))), name("BA three"), answered(2));
    expect(view(state).dirtyFields).toEqual(["name"]);
  });
});

describe("An avatar upload answers", () => {
  it("style and image change on the form as it is now", () => {
    const avatar = { id: "avatar_1", url: "/avatars/1.png" };
    const state = run(
      start(),
      server(2, { name: "Renamed" }),
      typed({ avatar, avatar_style: "upload" }),
    );
    expect(state.form.name).toBe("Renamed");
    expect(view(state).changed.profile).toEqual(["avatar_style", "avatar_image"]);
    expect(view(state).barState("profile")).toEqual({ kind: "changes", count: 2, avatar: true });
  });
});

describe("Errors", () => {
  it("a size error shows at once; an empty field after the owner leaves it", () => {
    let state = run(start(), typed({ description: "" }));
    expect(view(state).errorOf("description")).toBeNull();
    state = run(state, { type: "fieldLeft", field: "description" });
    expect(view(state).errorOf("description")).toBe("Required");
    state = run(state, name("x".repeat(settings.limits.nameMax + 1)));
    expect(view(state).errorOf("name")).not.toBeNull();
  });
});

describe("Answers of another Save", () => {
  it("an answer or a failure of a Save that does not wait changes nothing", () => {
    const state = send(run(start(), name("BA two")));
    expect(run(state, answered(2, { id: 7 }))).toBe(state);
    expect(run(state, failed(stale, 7))).toBe(state);
  });

  it("each Save has its own id", () => {
    let state = run(send(run(start(), name("BA two"))), answered(2));
    state = send(run(state, name("BA three")));
    expect(state.onItsWay?.id).toBe(2);
    expect(run(state, answered(3, { id: 1 }))).toBe(state);
    expect(
      run(state, answered(3, { id: 2, form: formAt(3, { name: "BA three" }) })).saved.name,
    ).toBe("BA three");
  });
});

describe("The tool rules change (the catalog loads again)", () => {
  it("a tab whose changes go under the new rules takes the newer values", () => {
    let state = run(
      start(),
      typed({ tool_choices: { read_file: true } }),
      server(2, { request_limit: 42 }),
    );
    expect(view(state).conflict("model")).toBe(true);
    // The new catalog has no such tool, so the switch is no change any more.
    state = editReducer({ effective: () => ({}) })(state, { type: "rulesChanged" });
    expect(state.base.model).toBe(2);
    expect(state.form.request_limit).toBe(42);
  });
});
