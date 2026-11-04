// A pure state module's state outside React, for a module whose reducer asks for toasts. A late
// answer sends its event here and changes the state as it is now, also after the page that sent
// it is gone, and its toast shows at once, so none is lost (frontend-conventions.md §1, "One pure
// module for a stateful screen").
import { showToast } from "../../components/ui/toast.tsx";

export interface ToastStore<S, E> {
  get: () => S;
  // Returns the state after the event.
  dispatch: (event: E) => S;
  subscribe: (listener: () => void) => () => void;
}

export function createToastStore<S extends { toasts: readonly string[] }, E>({
  initial,
  reduce,
}: {
  initial: S;
  reduce: (state: S, event: E) => S;
}): ToastStore<S, E> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    dispatch: (event) => {
      let next = reduce(state, event);
      if (next.toasts.length > 0) {
        for (const toast of next.toasts) showToast(toast);
        next = { ...next, toasts: [] };
      }
      if (next !== state) {
        state = next;
        for (const listener of listeners) listener();
      }
      return state;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
