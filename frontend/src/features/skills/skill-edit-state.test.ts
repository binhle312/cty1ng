import { describe, expect, it } from "vitest";
import {
  editReducer,
  editView,
  type EditEvent,
  type EditState,
  initialEditState,
} from "./skill-edit-state.ts";
import type { SkillFields } from "./skill-form.ts";

// The cells of the state tables 52 and 53 of docs/plans/p3-skills-page-orders.md (skills-page.md
// §5, "The editor and its requests"): one test per cell.

const SAVED: SkillFields = {
  name: "Write user stories",
  slug: "write-user-stories",
  description: "Use it for stories.",
  body_md: "Old text.",
};
const V3 = { version: 3, rowVersion: 1 };
const V4 = { version: 4, rowVersion: 2 };
const V5 = { version: 5, rowVersion: 3 };
const NO_PROBLEMS = { name: null, slug: null, description: null, body_md: null };

const run = (events: EditEvent[], start: EditState = initialEditState(SAVED, V3)) =>
  events.reduce(editReducer, start);
const view = (state: EditState) => editView(state, { limitsReason: null, problems: NO_PROBLEMS });
const typed = (body_md: string): EditEvent => ({ type: "typed", field: "body_md", value: body_md });
const data = (body_md: string, point = V4): EditEvent => ({
  type: "serverData",
  fields: { ...SAVED, body_md },
  point,
});
// The generated client throws the error body of a failed request.
const failed = (code: string): EditEvent => ({
  type: "saveFailed",
  error: { error: { code, message: "Failed." } },
});

// Sent S ("New text."), saved O ("Old text."): a Save on its way.
const saving = () => run([typed("New text."), { type: "saveSent" }]);
// The Save answered with v4; its refresh has not come.
const answered = () => run([{ type: "saveAnswered", point: V4 }], saving());

describe("the skill editor while a Save waits (table 52)", () => {
  it("counts the Save's change while it waits and the text is typed back", () => {
    const state = run([typed("Old text.")], saving());
    expect(view(state).changes, "the Save's change").toEqual(["body_md"]);
  });

  it('keeps Save off with "Saving." while a Save waits', () => {
    const state = run([typed("Old text.")], saving());
    expect(view(state).saveReason, "the Save reason while it waits").toBe("Saving.");
  });

  it("asks before leaving while a Save waits and the text is typed back", () => {
    const state = run([typed("Old text.")], saving());
    expect(view(state).leaveAsks, "the leave question while a Save waits").toBe(true);
  });

  it("counts one change while a Save waits with its own text", () => {
    expect(view(saving()).changes, "the change of the sent text").toEqual(["body_md"]);
  });

  it("keeps text typed back when the Save's own data comes first", () => {
    const state = run([typed("Old text."), data("New text.")], saving());
    expect(state.form.current.body_md, "the text typed back").toBe("Old text.");
  });

  it("counts text typed back as a change after the Save succeeds", () => {
    const state = run([typed("Old text."), { type: "saveAnswered", point: V4 }], saving());
    expect(view(state).changes, "text typed back after the answer").toEqual(["body_md"]);
  });

  it("says all is saved after a failed Save with text typed back", () => {
    const state = run([typed("Old text."), failed("internal_error")], saving());
    expect(view(state).allSaved, "all saved after the failure").toBe(true);
  });

  it("asks for a toast when a Save fails with text typed back", () => {
    const state = run([typed("Old text."), failed("internal_error")], saving());
    expect(state.toasts, "the toast of the lost Save").toEqual([
      "Could not save Write user stories. Try again.",
    ]);
  });
});

describe("Discard (table 53)", () => {
  it("puts back the text of the answered Save on Discard", () => {
    const state = run([typed("Another edit."), { type: "discarded" }], answered());
    expect(state.form.current.body_md, "the text after Discard").toBe("New text.");
  });

  it("keeps the base of the answered Save on Discard", () => {
    const state = run([typed("Another edit."), { type: "discarded" }], answered());
    expect(state.base, "the base after Discard").toEqual(V4);
  });

  it("shows no conflict after Discard, an edit and the Save's own data", () => {
    const state = run(
      [typed("Another edit."), { type: "discarded" }, typed("A third edit."), data("New text.")],
      answered(),
    );
    expect(view(state).conflict, "the conflict after the refresh").toBe(false);
  });

  it("takes the server text and base on Discard during a conflict", () => {
    const state = run([typed("Mine."), data("Theirs.", V4), { type: "discarded" }]);
    expect({ text: state.form.current.body_md, base: state.base }, "Discard in a conflict").toEqual(
      { text: "Theirs.", base: V4 },
    );
  });

  it("changes nothing on Discard while a Save waits", () => {
    const before = saving();
    expect(run([{ type: "discarded" }], before), "the state after Discard").toBe(before);
  });

  it('gives "Saving." as the Discard reason while a Save waits', () => {
    expect(view(saving()).discardReason, "the Discard reason").toBe("Saving.");
  });
});

describe("the base of the edit", () => {
  it("moves no base for an action sent from data that the edit does not hold", () => {
    const state = run([
      typed("Mine."),
      data("Theirs.", V4),
      { type: "baseMoved", point: V5, startedAt: 2 },
    ]);
    expect(state.base, "the base after the answer").toEqual(V3);
  });

  it("keeps the base when a late action answer is older", () => {
    const state = run([data("New text.", V5), { type: "baseMoved", point: V4 }]);
    expect(state.base, "the base after an older answer").toEqual(V5);
  });
});
