import {
  avatarChanged,
  changedFields,
  lostSaveText,
  type EditContext,
  type EditField,
  type EditTab,
  editProblems,
  type EffectiveTools,
  mergeTab,
  tabOfField,
  withTab,
} from "./bot-edit-form.ts";
import {
  type CreateForm,
  isTooLong,
  keepUnchanged,
  type Problems,
  takenNameText,
} from "./create-bot-form.ts";

// The edit state of the bot page's Profile and Model tabs (bot-page.md §4.1, the table in §4.2):
// the form, the values it was loaded from, the `row_version` each tab's edit started from, the
// Save on its way, conflicts and errors. A reducer takes the state and an event to the next state,
// and `editView` computes what the page shows. A late answer is an event, so it acts on the state
// as it is now (lessons `state-table-before-stateful-code.md`, `two-of-my-requests-at-once.md`).
//
// Pure: no React, no request, no clock. `bot-edit-store.ts` holds the state and shows the toasts
// this module asks for; `bot-page.tsx` sends the events and the request.
//
// The rules:
// - Both tabs share one form; each tab has its own save bar and its own `row_version` (base).
// - A newer `row_version` from the server: a tab with no changes takes the new values at once,
//   also later when its changes go (typed back), and so does a tab whose changed fields already
//   have the server's values (Q4). A tab whose Save is on its way waits for the
//   answer: the event of that save can come first.
// - Conflict: a tab with changes whose base is older than the server, while no Save of the page
//   waits (Q1), or whose Save was refused as stale at its base. Save is off until Discard.
// - One Save at a time, with an id: an answer of another Save changes nothing. Text typed while
//   it waits stays a change against what it sent. A stale refusal puts every tab at the base it
//   was sent from in conflict while it has changes, also after a let-go.
// - The answer writes the sent fields only while the tab is still at the base it sent from, and
//   moves every tab at that base to the new `row_version`. A tab the owner let go while the Save
//   waited shows the saved values, with the fields typed after the let-go kept.
// - A failure of a Save that the owner let go is a toast; otherwise a stale save is a conflict, a
//   taken name or a field error shows under a field that still has the sent text, and the rest is
//   a toast.

export const EDIT_TABS: readonly EditTab[] = ["profile", "model"];

// A failed request's error body, as `readApiError` reads it; null for a network failure.
export type SaveError = { code: string; message: string; field?: string | undefined } | null;

// A Save on its way.
export interface SentSave {
  // Its answer names it, so an answer of another Save changes nothing.
  id: number;
  tab: EditTab;
  form: CreateForm;
  base: number;
  fields: readonly EditField[];
  // The tab's let-go count at send: a different count now means the owner let the tab go.
  letGoAtSend: number;
}

// A toast the page shows for a failed Save (bot-page.md §4.1).
export interface SaveToast {
  id: number;
  text: string;
}

export interface EditState {
  // The newest bot from the server, as the form shows it.
  server: { form: CreateForm; rowVersion: number };
  form: CreateForm;
  // The values each tab's edit started from.
  saved: CreateForm;
  base: Record<EditTab, number>;
  onItsWay: SentSave | null;
  // The base a Save of the tab was refused at (409 `stale_write`), until Discard.
  staleAt: Record<EditTab, number | null>;
  serverProblems: Problems;
  // Fields the owner left, and tabs where Save was pressed with errors: their errors show.
  left: ReadonlySet<string>;
  tried: ReadonlySet<EditTab>;
  // How many times each tab was let go (Discard, Esc, leaving).
  letGo: Record<EditTab, number>;
  toasts: readonly SaveToast[];
  nextToast: number;
  nextSave: number;
}

export type EditEvent =
  | { type: "typed"; change: (form: CreateForm) => CreateForm }
  | { type: "fieldLeft"; field: string }
  // Save pressed while the tab has errors.
  | { type: "saveTried"; tab: EditTab }
  | { type: "saveSent"; tab: EditTab; form: CreateForm; base: number; fields: readonly EditField[] }
  // The answer carries the bot as the server saved it, as the form shows it.
  | { type: "saveAnswered"; id: number; rowVersion: number; form: CreateForm }
  | { type: "saveFailed"; id: number; error: SaveError }
  // The bot in the list; only a newer `row_version` changes anything.
  | { type: "serverBot"; form: CreateForm; rowVersion: number }
  | { type: "letGo"; tabs: readonly EditTab[] }
  | { type: "toastsShown"; upTo: number }
  // The tool rules (`effective`) changed: a tab whose changes went takes newer values.
  | { type: "rulesChanged" };

export interface EditRules {
  effective: EffectiveTools;
}

export function initialEditState({
  form,
  rowVersion,
}: {
  form: CreateForm;
  rowVersion: number;
}): EditState {
  return {
    server: { form, rowVersion },
    form,
    saved: form,
    base: { profile: rowVersion, model: rowVersion },
    onItsWay: null,
    staleAt: { profile: null, model: null },
    serverProblems: {},
    left: new Set(),
    tried: new Set(),
    letGo: { profile: 0, model: 0 },
    toasts: [],
    nextToast: 1,
    nextSave: 1,
  };
}

// The reducer for one bot page; `effective` maps the tool switches as the server stores them.
export function editReducer(rules: EditRules): (state: EditState, event: EditEvent) => EditState {
  return (state, event) => takeNewer(next(state, { event, rules }), rules);
}

function next(
  state: EditState,
  { event, rules }: { event: EditEvent; rules: EditRules },
): EditState {
  switch (event.type) {
    case "typed": {
      const form = event.change(state.form);
      // A server error goes when the owner changes its field.
      const serverProblems = keepUnchanged({
        problems: state.serverProblems,
        before: state.form,
        after: form,
      });
      return { ...state, form, serverProblems };
    }
    case "fieldLeft":
      return state.left.has(event.field)
        ? state
        : { ...state, left: new Set(state.left).add(event.field) };
    case "saveTried":
      return state.tried.has(event.tab)
        ? state
        : { ...state, tried: new Set(state.tried).add(event.tab) };
    case "saveSent":
      if (state.onItsWay !== null) return state;
      return {
        ...state,
        nextSave: state.nextSave + 1,
        onItsWay: {
          id: state.nextSave,
          tab: event.tab,
          form: event.form,
          base: event.base,
          fields: event.fields,
          letGoAtSend: state.letGo[event.tab],
        },
      };
    case "saveAnswered":
      return state.onItsWay?.id === event.id
        ? answered(newerServer(state, event), {
            sent: state.onItsWay,
            rowVersion: event.rowVersion,
            rules,
          })
        : state;
    case "saveFailed":
      return state.onItsWay?.id === event.id
        ? failed(state, { sent: state.onItsWay, error: event.error })
        : state;
    case "serverBot":
      return newerServer(state, event);
    case "letGo":
      return letGo(state, event.tabs);
    case "toastsShown":
      return { ...state, toasts: state.toasts.filter((toast) => toast.id > event.upTo) };
    case "rulesChanged":
      return state;
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

// The bot of the server, when it is newer than the one the state has: a list load can be older
// than an answer that came first.
function newerServer(
  state: EditState,
  { form, rowVersion }: { form: CreateForm; rowVersion: number },
): EditState {
  return rowVersion > state.server.rowVersion ? { ...state, server: { form, rowVersion } } : state;
}

const changedOf = (state: EditState, { tab, rules }: { tab: EditTab; rules: EditRules }) =>
  changedFields({ tab, form: state.form, saved: state.saved, effective: rules.effective });

// A tab with an older base takes the server's values, unless its Save waits, when nothing of the
// owner's would be lost: it has no changes, or every field the owner changed already has the
// server's value (a Save whose answer was lost, or the same change in another place; Q4).
function takeNewer(state: EditState, rules: EditRules): EditState {
  const { rowVersion } = state.server;
  const nothingLost = (tab: EditTab) => {
    const toServer = changedFields({
      tab,
      form: state.form,
      saved: state.server.form,
      effective: rules.effective,
    });
    return changedOf(state, { tab, rules }).every((field) => !toServer.includes(field));
  };
  const behind = EDIT_TABS.filter(
    (tab) => tab !== state.onItsWay?.tab && state.base[tab] < rowVersion && nothingLost(tab),
  );
  if (behind.length === 0) return state;
  let { form, saved } = state;
  const base = { ...state.base };
  for (const tab of behind) {
    form = withTab({ into: form, from: state.server.form, tab });
    saved = withTab({ into: saved, from: state.server.form, tab });
    base[tab] = rowVersion;
  }
  return { ...state, form, saved, base };
}

function answered(
  state: EditState,
  { sent, rowVersion, rules }: { sent: SentSave; rowVersion: number; rules: EditRules },
): EditState {
  const { tab } = sent;
  let { form, saved } = state;
  // A Discard that loaded a newer `row_version` (another tab saved after this save) already shows
  // values newer than the answer; they stay.
  if (state.base[tab] === sent.base) {
    // A tab the owner let go shows the saved values, not the edit it dropped; a field typed in
    // after the let-go keeps its text, as a change.
    if (state.letGo[tab] !== sent.letGoAtSend) {
      form = mergeTab({
        tab,
        base: saved,
        mine: form,
        theirs: sent.form,
        effective: rules.effective,
      });
    }
    saved = withTab({ into: saved, from: sent.form, tab });
  }
  // The server took the save at `sent.base`, so nothing else changed in between: every tab whose
  // edit started there is now at the new `row_version`.
  const base = {
    profile: state.base.profile === sent.base ? rowVersion : state.base.profile,
    model: state.base.model === sent.base ? rowVersion : state.base.model,
  };
  return { ...state, form, saved, base, onItsWay: null };
}

function withToast(state: EditState, text: string): EditState {
  return {
    ...state,
    toasts: [...state.toasts, { id: state.nextToast, text }],
    nextToast: state.nextToast + 1,
  };
}

function failed(
  state: EditState,
  { sent, error }: { sent: SentSave; error: SaveError },
): EditState {
  const stale = error?.code === "stale_write";
  // The server is newer than the base the Save was sent from, so every tab at that base is in
  // conflict while it has changes, also changes typed later, until a newer bot moves it. This
  // holds after a let-go too: text typed then is at that base.
  const staleAt = { ...state.staleAt };
  if (stale) {
    for (const other of EDIT_TABS) if (state.base[other] === sent.base) staleAt[other] = sent.base;
  }
  const done = { ...state, onItsWay: null, staleAt };
  const { tab } = sent;
  const botName = state.server.form.name;
  // The owner let the tab go (Discard, Esc, leaving): no field or bar shows the failure.
  if (state.letGo[tab] !== sent.letGoAtSend) {
    return withToast(done, lostSaveText({ botName, sentName: sent.form.name, error }));
  }
  if (stale) return done;
  // An error is about the value that was sent: a field the owner changed while Save waited gets
  // no error, so it never blocks the corrected text.
  const stillSent = (problems: Problems) =>
    keepUnchanged({ problems, before: sent.form, after: state.form });
  if (error?.code === "name_taken") {
    const name = takenNameText({ name: sent.form.name, byServer: true });
    return { ...done, serverProblems: { ...state.serverProblems, ...stillSent({ name }) } };
  }
  if (error?.field !== undefined && tabOfField(error.field) === tab) {
    const problem = { [error.field]: error.message };
    return { ...done, serverProblems: { ...state.serverProblems, ...stillSent(problem) } };
  }
  return withToast(done, `Could not save ${botName}. Try again.`);
}

// Discard, Esc or leaving: the tabs show the newest values; a Save on its way goes on.
function letGo(state: EditState, tabs: readonly EditTab[]): EditState {
  let { form, saved } = state;
  const base = { ...state.base };
  const letGoCount = { ...state.letGo };
  const staleAt = { ...state.staleAt };
  for (const tab of tabs) {
    form = withTab({ into: form, from: state.server.form, tab });
    saved = withTab({ into: saved, from: state.server.form, tab });
    base[tab] = state.server.rowVersion;
    letGoCount[tab] += 1;
    staleAt[tab] = null;
  }
  return {
    ...state,
    form,
    saved,
    base,
    letGo: letGoCount,
    staleAt,
    serverProblems: Object.fromEntries(
      Object.entries(state.serverProblems).filter(([field]) => !tabs.includes(tabOfField(field))),
    ),
    tried: new Set([...state.tried].filter((tab) => !tabs.includes(tab))),
  };
}

// ---- What the page shows ---------------------------------------------------------------------

export type SaveBarState =
  | { kind: "clean" }
  | { kind: "changes"; count: number; avatar: boolean }
  | { kind: "errors"; count: number }
  | { kind: "conflict" };

export interface EditView {
  changed: Record<EditTab, EditField[]>;
  // Changed, and for the tab whose Save waits also the text typed since it went out.
  unsaved: Record<EditTab, EditField[]>;
  // The fields the leave question names.
  dirtyFields: EditField[];
  // The tab whose Save is on its way, or null.
  saving: EditTab | null;
  conflict: (tab: EditTab) => boolean;
  errorOf: (field: string) => string | null;
  shownErrors: (tab: EditTab) => number;
  // What Save does now: nothing, show the errors, or send.
  saveCheck: (tab: EditTab) => "off" | "errors" | "send";
  // The other tab whose Save waits, so this tab's Save is off.
  waitingFor: (tab: EditTab) => EditTab | null;
  barState: (tab: EditTab) => SaveBarState;
}

export function editView(
  state: EditState,
  { rules, ctx }: { rules: EditRules; ctx: EditContext },
): EditView {
  const { form, onItsWay } = state;
  const changed: Record<EditTab, EditField[]> = {
    profile: changedOf(state, { tab: "profile", rules }),
    model: changedOf(state, { tab: "model", rules }),
  };
  // A Save the owner let go has nothing of the owner's unsaved any more.
  const pending =
    onItsWay !== null && state.letGo[onItsWay.tab] === onItsWay.letGoAtSend ? onItsWay : null;
  const unsavedOf = (tab: EditTab): EditField[] => {
    if (pending?.tab !== tab) return changed[tab];
    const sinceSent = changedFields({ tab, form, saved: pending.form, effective: rules.effective });
    return [...new Set([...changed[tab], ...sinceSent])];
  };
  const unsaved = { profile: unsavedOf("profile"), model: unsavedOf("model") };
  const conflict = (tab: EditTab) =>
    changed[tab].length > 0 &&
    ((onItsWay === null && state.server.rowVersion > state.base[tab]) ||
      state.staleAt[tab] === state.base[tab]);
  const problems: Record<EditTab, Problems> = {
    profile: editProblems({ tab: "profile", form, changed: changed.profile, ctx }),
    model: editProblems({ tab: "model", form, changed: changed.model, ctx }),
  };
  const errorOf = (field: string): string | null => {
    const fromServer = state.serverProblems[field];
    if (fromServer !== undefined) return fromServer;
    const tab = tabOfField(field);
    const local = problems[tab][field];
    if (local === undefined) return null;
    // A size error shows at once; an empty field or a taken name after the owner leaves it.
    return isTooLong({ form, field, settings: ctx.settings }) ||
      state.left.has(field) ||
      state.tried.has(tab)
      ? local
      : null;
  };
  const shownErrors = (tab: EditTab) =>
    new Set(
      [...Object.keys(problems[tab]), ...Object.keys(state.serverProblems)].filter(
        (field) => tabOfField(field) === tab && errorOf(field) !== null,
      ),
    ).size;
  const saveCheck = (tab: EditTab) => {
    if (onItsWay !== null || changed[tab].length === 0 || conflict(tab)) return "off";
    return Object.keys(problems[tab]).length > 0 || shownErrors(tab) > 0 ? "errors" : "send";
  };
  return {
    changed,
    unsaved,
    dirtyFields: [...unsaved.profile, ...unsaved.model],
    saving: onItsWay?.tab ?? null,
    conflict,
    errorOf,
    shownErrors,
    saveCheck,
    waitingFor: (tab) => (onItsWay !== null && onItsWay.tab !== tab ? onItsWay.tab : null),
    barState: (tab) => {
      if (conflict(tab)) return { kind: "conflict" };
      const errors = shownErrors(tab);
      if (errors > 0) return { kind: "errors", count: errors };
      if (unsaved[tab].length === 0) return { kind: "clean" };
      return {
        kind: "changes",
        count: unsaved[tab].length,
        avatar: tab === "profile" && avatarChanged(unsaved.profile),
      };
    },
  };
}
