import { describe, expect, it } from "vitest";
import { BOT_SETTINGS, makeBot } from "../../../test/fixtures.ts";
import { editFormOf } from "./bot-edit-form.ts";
import { initialEditState } from "./bot-edit-state.ts";
import { createEditStore } from "./bot-edit-store.ts";
import { type CreateForm, formSettings } from "./create-bot-form.ts";

// The store of one bot page: it holds the edit state outside React. The page tests cover the
// toasts on the screen (`bot-page.test.tsx`).

const settings = formSettings(BOT_SETTINGS);
const rules = { effective: (form: CreateForm) => ({ ...form.tool_choices }) };
const form = editFormOf(makeBot(1, "BA"), settings);

function storeWithListener() {
  const store = createEditStore({ rules, initial: initialEditState({ form, rowVersion: 1 }) });
  const calls = { count: 0 };
  store.subscribe(() => {
    calls.count += 1;
  });
  return { store, calls };
}

describe("the bot edit store", () => {
  it("shows a failure toast at once and keeps no toast in the state", () => {
    const { store } = storeWithListener();
    store.dispatch({ type: "typed", change: (f) => ({ ...f, name: "BA two" }) });
    const before = store.get();
    store.dispatch({
      type: "saveSent",
      tab: "profile",
      form: before.form,
      base: 1,
      fields: ["name"],
    });
    const after = store.dispatch({ type: "saveFailed", id: 1, error: null });
    expect(after.toasts).toEqual([]);
    expect(after.nextToast).toBe(2);
    expect(store.get()).toBe(after);
  });

  it("tells its listeners only when the state changes", () => {
    const { store, calls } = storeWithListener();
    store.dispatch({ type: "serverBot", form, rowVersion: 1 });
    expect(calls.count).toBe(0);
    store.dispatch({ type: "typed", change: (f) => ({ ...f, name: "BA two" }) });
    expect(calls.count).toBe(1);
  });

  it("re-checks newer values when the rules change, and not for the same rules", () => {
    const { store, calls } = storeWithListener();
    store.dispatch({ type: "typed", change: (f) => ({ ...f, tool_choices: { read_file: true } }) });
    store.dispatch({
      type: "serverBot",
      form: { ...form, request_limit: 42 },
      rowVersion: 2,
    });
    const count = calls.count;
    store.setRules(rules);
    expect(calls.count).toBe(count);
    // The new catalog has no such tool: the switch is no change, so the tab takes version 2.
    store.setRules({ effective: () => ({}) });
    expect(store.get().base.model).toBe(2);
    expect(store.get().form.request_limit).toBe(42);
  });
});
