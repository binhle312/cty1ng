import type { SkillTextField } from "@cty1ng/shared/skills";
import { CONFLICT_TEXT, lostSaveText, type SaveError, saveErrorOf } from "./save-error.ts";
import {
  discard,
  EDITOR_FIELDS,
  isDirty,
  isNewer,
  leaveTextFor,
  markSaved,
  newForm,
  type SavedPoint,
  saveKind,
  type SaveKind,
  setField,
  type SkillFields,
  type SkillForm,
  takesServerText,
} from "./skill-form.ts";

// The edit state of the skill page's Skill tab (skills-page.md §5, "The editor and its requests";
// the tables 52 and 53 of docs/plans/p3-skills-page-orders.md): the form, the server data, the
// saved state the edit started from (the base), the Save on its way, the save error and the
// changelog. A reducer takes the state and an event to the next state, and `editView` computes
// what the page shows. A late answer is an event, so it acts on the state as it is now.
//
// Pure: no React, no request, no clock. `skill-page.tsx` keeps the state in a toast store
// (`toast-store.ts`), sends the events and the requests, and shows the toasts this module asks for.
//
// The rules:
// - The editor takes new server data only with no changes and no Save on its way, and never data
//   older than the base (`takesServerText` in `skill-form.ts`). This check runs after each event.
// - A Save on its way counts as a change until its answer: text typed back to the saved text
//   still shows "1 change not saved", Save stays off ("Saving.") and leaving asks (DQ-071).
// - The answer makes the sent text the saved text and moves the base up. Text typed while it
//   waited stays a change. A failure asks for a toast when nothing on the page shows it.
// - Discard is off while a Save waits (Q2). Otherwise it puts back the saved text of this edit,
//   which after a Save is the text of that Save, and the base stays (DQ-072). In a conflict the
//   first rule then takes the server text and base.
// - The base and the server data only go up.

export interface EditState {
  // The newest server data that this page has seen.
  server: { fields: SkillFields; point: SavedPoint };
  form: SkillForm;
  // The saved state that the edit started from. Saves send it, so the server refuses a save over
  // a change made in another place (409 `stale_write`).
  base: SavedPoint;
  // The server data that the editor text last came from.
  taken: SavedPoint;
  // The Save on its way: the text it sent and its changelog.
  sending: { sent: SkillFields; note: string } | null;
  saveError: SaveError | null;
  changelog: string;
  // The owner left the page: a failure then is a toast.
  left: boolean;
  toasts: readonly string[];
}

export type EditEvent =
  | { type: "typed"; field: SkillTextField; value: string }
  | { type: "changelogTyped"; text: string }
  | { type: "saveSent" }
  | { type: "saveAnswered"; point: SavedPoint }
  // `error` is what the generated client threw.
  | { type: "saveFailed"; error: unknown }
  | { type: "serverData"; fields: SkillFields; point: SavedPoint }
  | { type: "discarded" }
  // A Deprecate or a Make active again of this page answered. `startedAt` is the `row_version`
  // that the request was sent from: the base moves only while the edit holds that data, so the move
  // never hides a change made in another place. Without it, the page checked that before.
  | { type: "baseMoved"; point: SavedPoint; startedAt?: number }
  // The page is on screen: at its first mount, and again after a cleanup that did not remove it
  // (React's StrictMode runs one in the development build).
  | { type: "entered" }
  | { type: "left" };

export function initialEditState(fields: SkillFields, point: SavedPoint): EditState {
  return {
    server: { fields, point },
    form: newForm(fields, false),
    base: point,
    taken: point,
    sending: null,
    saveError: null,
    changelog: "",
    left: false,
    toasts: [],
  };
}

const newer = (point: SavedPoint, than: SavedPoint) => (isNewer({ point, than }) ? point : than);

function next(state: EditState, event: EditEvent): EditState {
  switch (event.type) {
    case "typed":
      return {
        ...state,
        form: setField(state.form, event.field, event.value),
        // An error under a field is about its old text.
        saveError: state.saveError?.field === event.field ? null : state.saveError,
      };
    case "changelogTyped":
      return { ...state, changelog: event.text };
    case "saveSent":
      return {
        ...state,
        sending: { sent: state.form.current, note: state.changelog.trim() },
        saveError: null,
      };
    case "saveAnswered": {
      const { sending } = state;
      if (sending === null) return state;
      return {
        ...state,
        form: markSaved(state.form, sending.sent),
        base: newer(event.point, state.base),
        sending: null,
        changelog: state.changelog.trim() === sending.note ? "" : state.changelog,
      };
    }
    case "saveFailed": {
      if (state.sending === null) return state;
      const after = { ...state, sending: null };
      // The save bar shows an error only while the form has changes. An owner who left or typed
      // the text back gets a toast, because nothing else shows the failure.
      if (!state.left && isDirty(state.form)) {
        return { ...after, saveError: saveErrorOf(event.error) };
      }
      return {
        ...after,
        toasts: [
          ...state.toasts,
          lostSaveText({ name: state.server.fields.name, error: event.error }),
        ],
      };
    }
    case "serverData":
      // The page sends its data on each render: the same or older data changes nothing.
      if (!isNewer({ point: event.point, than: state.server.point })) return state;
      return { ...state, server: { fields: event.fields, point: event.point } };
    case "discarded": {
      if (state.sending !== null) return state;
      const cleared = { ...state, changelog: "", saveError: null };
      // The saved text of this edit comes back. In a conflict, the edit then has no changes, so
      // `takeServerText` loads the newest text and base right after this event.
      return { ...cleared, form: discard(state.form) };
    }
    case "baseMoved":
      if (event.startedAt !== undefined && state.base.rowVersion < event.startedAt) return state;
      return { ...state, base: newer(event.point, state.base) };
    case "entered":
      return state.left ? { ...state, left: false } : state;
    case "left":
      return { ...state, left: true };
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

// The editor takes the server text whenever the rule allows it, also later when changes end.
function takeServerText(state: EditState): EditState {
  const { point, fields } = state.server;
  const takes = takesServerText({
    server: point,
    base: state.base,
    taken: state.taken,
    saving: state.sending !== null,
    dirty: isDirty(state.form),
  });
  if (!takes) return state;
  // An error was about the text that this replaces.
  return { ...state, form: newForm(fields, false), base: point, taken: point, saveError: null };
}

export function editReducer(state: EditState, event: EditEvent): EditState {
  return takeServerText(next(state, event));
}

export interface EditView {
  // The fields that are not saved yet, in page order: the text that differs from the saved text,
  // and the fields of a Save on its way.
  changes: SkillTextField[];
  allSaved: boolean;
  leaveAsks: boolean;
  leaveText: (skillName: string) => string;
  kind: SaveKind;
  // The server has a change that this edit did not start from.
  serverAhead: boolean;
  conflict: boolean;
  saveReason: string | null;
  discardReason: string | null;
  // The line in the save bar.
  error: string | null;
  // The error under a field.
  fieldError: Extract<SaveError, { field: SkillTextField }> | null;
}

const fieldErrorOf = (error: SaveError | null) =>
  error === null || error.field === null ? null : error;

export function editView(
  state: EditState,
  {
    limitsReason,
    problems,
  }: { limitsReason: string | null; problems: Record<SkillTextField, string | null> },
): EditView {
  const { form, sending } = state;
  // The slug is fixed after Create, so it never counts here.
  const changes = EDITOR_FIELDS.filter(
    (field) =>
      field !== "slug" &&
      (form.current[field] !== form.saved[field] ||
        (sending !== null && sending.sent[field] !== form.saved[field])),
  );
  const serverAhead = isNewer({ point: state.server.point, than: state.base });
  const conflict = serverAhead && sending === null;
  const problem = Object.values(problems).some((text) => text !== null);
  const saveReason =
    sending !== null
      ? "Saving."
      : (limitsReason ??
        (conflict
          ? "This skill changed in another place."
          : problem || state.saveError?.field != null
            ? "Fix the errors first."
            : null));
  return {
    changes,
    allSaved: changes.length === 0,
    leaveAsks: changes.length > 0,
    leaveText: (skillName) => leaveTextFor(changes, skillName),
    kind: saveKind(form),
    serverAhead,
    conflict,
    saveReason,
    discardReason: sending === null ? null : "Saving.",
    error: conflict
      ? CONFLICT_TEXT
      : state.saveError?.field === null
        ? state.saveError.message
        : null,
    fieldError: fieldErrorOf(state.saveError),
  };
}
