import { useLayoutEffect, useState, useSyncExternalStore } from "react";
import {
  type DialogRequestEvent,
  dialogRequestReducer,
  type DialogRequestState,
  initialDialogRequestState,
} from "./dialog-request-state.ts";
import { createToastStore } from "./toast-store.ts";

// The dialogs of a page that each send one request: the rules are in `dialog-request-state.ts`.
// This hook holds that state outside React, so an answer after the page went still shows its
// toast. `initial` is a dialog that is open from the start, such as a card after a save.
export function useDialogRequests<D extends object>({
  initial = null,
}: { initial?: D | null } = {}) {
  const [{ store, actions }] = useState(() => {
    const store = createToastStore<DialogRequestState<D>, DialogRequestEvent<D>>({
      initial: initialDialogRequestState<D>(initial),
      reduce: dialogRequestReducer,
    });
    const actions = {
      open: (next: D | null) => {
        store.dispatch({ type: "opened", dialog: next });
      },
      close: () => {
        store.dispatch({ type: "opened", dialog: null });
      },
      run: <T>({
        dialog,
        request,
        done,
        failed,
        lateText = failed,
        closes = () => false,
      }: {
        dialog: D;
        request: Promise<T>;
        done?: (result: T) => void;
        failed: (error: unknown) => string;
        // The toast of a failure after the dialog closed, when it needs other words.
        lateText?: (error: unknown) => string;
        // A failure that closes the dialog and shows as a toast (a stale pin, bot-page.md §7).
        closes?: (error: unknown) => boolean;
      }) => {
        store.dispatch({ type: "sent", dialog });
        void request
          .then(
            (result) => {
              done?.(result);
              store.dispatch({ type: "answered", dialog });
            },
            (cause: unknown) => {
              store.dispatch({
                type: "failed",
                dialog,
                text: failed(cause),
                lateText: lateText(cause),
                closes: closes(cause),
              });
            },
          )
          .finally(() => {
            store.dispatch({ type: "ended", dialog });
          });
      },
    };
    return { store, actions };
  });
  const state = useSyncExternalStore(store.subscribe, store.get);
  // A layout cleanup runs in the commit that removes the page, so no answer lands in between.
  // StrictMode runs this twice on mount: the second run opens `initial` again.
  useLayoutEffect(() => {
    store.dispatch({ type: "opened", dialog: initial });
    return () => {
      store.dispatch({ type: "opened", dialog: null });
    };
  }, [store, initial]);

  return {
    dialog: state.dialog,
    error: state.error,
    // The open dialog's request is on its way.
    pending: state.dialog !== null && state.busy === state.dialog,
    // A request is on its way, also of a dialog that closed.
    waiting: state.busy !== null,
    ...actions,
  };
}
