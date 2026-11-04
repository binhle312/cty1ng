import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import { showToast } from "../../components/ui/toast.tsx";
import {
  EDIT_TABS,
  type EditEvent,
  editReducer,
  type EditRules,
  type EditState,
  initialEditState,
} from "./bot-edit-state.ts";
import type { CreateForm } from "./create-bot-form.ts";

// The edit state (`bot-edit-state.ts`) of one bot page, outside React. A late answer sends its
// event here and changes the state as it is now, also in the same render batch as an unmount or
// after the page is gone; the toasts of failed Saves show at once, so none is lost
// (frontend-conventions.md §1, "Answers write only what their request owns").

export interface EditStore {
  get: () => EditState;
  // Returns the state after the event.
  dispatch: (event: EditEvent) => EditState;
  subscribe: (listener: () => void) => () => void;
  setRules: (rules: EditRules) => void;
}

export function createEditStore({
  rules,
  initial,
}: {
  rules: EditRules;
  initial: EditState;
}): EditStore {
  let state = initial;
  let current = rules;
  let reduce = editReducer(rules);
  const listeners = new Set<() => void>();
  const dispatch = (event: EditEvent): EditState => {
    let next = reduce(state, event);
    const last = next.toasts.at(-1);
    if (last !== undefined) {
      for (const toast of next.toasts) showToast(toast.text);
      next = reduce(next, { type: "toastsShown", upTo: last.id });
    }
    if (next !== state) {
      state = next;
      for (const listener of listeners) listener();
    }
    return state;
  };
  return {
    get: () => state,
    dispatch,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setRules: (next) => {
      if (next === current) return;
      current = next;
      reduce = editReducer(next);
      dispatch({ type: "rulesChanged" });
    },
  };
}

// The store of a bot page. Each render sends the bot of the list (only a newer `row_version`
// changes anything) before the browser paints, so a tab with no changes never shows old values.
// Leaving the page lets every tab go: a Save on its way that fails then is a toast.
export function useEditStore({
  rules,
  form,
  rowVersion,
}: {
  rules: EditRules;
  form: CreateForm;
  rowVersion: number;
}): { state: EditState; store: EditStore } {
  const [store] = useState(() =>
    createEditStore({ rules, initial: initialEditState({ form, rowVersion }) }),
  );
  const state = useSyncExternalStore(store.subscribe, store.get);
  useLayoutEffect(() => {
    store.setRules(rules);
  }, [store, rules]);
  useLayoutEffect(() => {
    store.dispatch({ type: "serverBot", form, rowVersion });
  });
  // A layout cleanup runs in the commit that removes the page, so no answer lands in between.
  useLayoutEffect(
    () => () => {
      store.dispatch({ type: "letGo", tabs: EDIT_TABS });
    },
    [store],
  );
  return { state, store };
}
