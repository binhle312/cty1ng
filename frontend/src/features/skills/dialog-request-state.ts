// A dialog that sends one request (bot-page.md §7, skills-page.md §2a, §7, §10): the dialog on
// screen, its error, and the request on its way. Each open makes a new dialog object, so an answer
// knows if its own dialog is still open. Pure: no React, no request, no clock; `dialog-requests.ts`
// holds the state and shows the toasts this module asks for (frontend-conventions.md §1).
//
//           | Its dialog is open        | Closed, a newer dialog, or the page is gone
// ----------+---------------------------+--------------------------------------------
// Answer    | The dialog closes         | Nothing more: the lists update
// Failure   | The error in the dialog;  | A toast with the late text: no dialog would
//           | a failure that closes the | show it, and a newer dialog gets no error
//           | dialog: closes, and a     |
//           | toast                     |
//
// Opening, closing and sending clear the error. The dialog is busy until its request ends.

export interface DialogRequestState<D> {
  dialog: D | null;
  error: string | null;
  // The dialog of the newest request on its way.
  busy: D | null;
  // Toasts to show; the store shows them at once and drops them.
  toasts: readonly string[];
}

export type DialogRequestEvent<D> =
  // Opens a new dialog; null closes the open one. The page that goes closes it too.
  | { type: "opened"; dialog: D | null }
  | { type: "sent"; dialog: D }
  | { type: "answered"; dialog: D }
  // `text` shows in the open dialog, or in the toast of a failure that closes it; `lateText` shows
  // in the toast when the dialog is not open any more. `closes`: a failure that closes the dialog.
  | { type: "failed"; dialog: D; text: string; lateText: string; closes: boolean }
  | { type: "ended"; dialog: D };

export function initialDialogRequestState<D>(dialog: D | null): DialogRequestState<D> {
  return { dialog, error: null, busy: null, toasts: [] };
}

export function dialogRequestReducer<D>(
  state: DialogRequestState<D>,
  event: DialogRequestEvent<D>,
): DialogRequestState<D> {
  switch (event.type) {
    case "opened":
      return state.dialog === event.dialog && state.error === null
        ? state
        : { ...state, dialog: event.dialog, error: null };
    case "sent":
      return { ...state, error: null, busy: event.dialog };
    case "answered":
      return state.dialog === event.dialog ? { ...state, dialog: null, error: null } : state;
    case "failed": {
      if (state.dialog !== event.dialog) {
        return { ...state, toasts: [...state.toasts, event.lateText] };
      }
      return event.closes
        ? { ...state, dialog: null, error: null, toasts: [...state.toasts, event.text] }
        : { ...state, error: event.text };
    }
    case "ended":
      return state.busy === event.dialog ? { ...state, busy: null } : state;
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}
