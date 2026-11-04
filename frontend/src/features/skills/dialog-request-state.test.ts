import { describe, expect, it } from "vitest";
import { everyOrder, type Model, type Step } from "../../../test/sequences.ts";
import {
  type DialogRequestEvent,
  dialogRequestReducer,
  type DialogRequestState,
  initialDialogRequestState,
} from "./dialog-request-state.ts";

// A dialog that sends one request (frontend-conventions.md §5; bot-page.md §7, skills-page.md §7):
// one test per cell of the table in `dialog-request-state.ts`, then every order of two dialogs
// against a small model.

interface Dialog {
  name: string;
}
const A: Dialog = { name: "A" };
const B: Dialog = { name: "B" };

type Event = DialogRequestEvent<Dialog>;
const reduce = (state: DialogRequestState<Dialog>, event: Event) =>
  dialogRequestReducer(state, event);
const run = (state: DialogRequestState<Dialog>, ...events: Event[]) => events.reduce(reduce, state);
const start = () => initialDialogRequestState<Dialog>(null);

const opened = (dialog: Dialog | null): Event => ({ type: "opened", dialog });
const sent = (dialog: Dialog): Event => ({ type: "sent", dialog });
const answered = (dialog: Dialog): Event => ({ type: "answered", dialog });
const ended = (dialog: Dialog): Event => ({ type: "ended", dialog });
const failed = (dialog: Dialog, closes = false): Event => ({
  type: "failed",
  dialog,
  text: "No.",
  lateText: "It did not work. No.",
  closes,
});

describe("a dialog's request: the answer", () => {
  it("same dialog open: the dialog closes", () => {
    const state = run(start(), opened(A), sent(A), answered(A));
    expect(state.dialog).toBeNull();
    expect(state.error).toBeNull();
    expect(state.toasts).toEqual([]);
  });

  it("the dialog was closed: nothing more", () => {
    const before = run(start(), opened(A), sent(A), opened(null));
    expect(run(before, answered(A))).toEqual(before);
  });

  it("a newer dialog is open: it stays, with its error", () => {
    const before = run(start(), opened(A), sent(A), opened(B), sent(B), failed(B));
    const state = run(before, answered(A));
    expect(state.dialog).toBe(B);
    expect(state.error).toBe("No.");
  });
});

describe("a dialog's request: the failure", () => {
  it("same dialog open: the error shows in the dialog", () => {
    const state = run(start(), opened(A), sent(A), failed(A));
    expect(state.dialog).toBe(A);
    expect(state.error).toBe("No.");
    expect(state.toasts).toEqual([]);
  });

  it("same dialog open, and the failure closes it: closes with a toast", () => {
    const state = run(start(), opened(A), sent(A), failed(A, true));
    expect(state.dialog).toBeNull();
    expect(state.error).toBeNull();
    expect(state.toasts).toEqual(["No."]);
  });

  it("the dialog was closed: a toast with the late text", () => {
    const state = run(start(), opened(A), sent(A), opened(null), failed(A));
    expect(state.dialog).toBeNull();
    expect(state.error).toBeNull();
    expect(state.toasts).toEqual(["It did not work. No."]);
  });

  it("a newer dialog is open: a toast, and no error in that dialog", () => {
    const state = run(start(), opened(A), sent(A), opened(B), failed(A));
    expect(state.dialog).toBe(B);
    expect(state.error).toBeNull();
    expect(state.toasts).toEqual(["It did not work. No."]);
  });
});

describe("a dialog's request: the rest", () => {
  it("a request that goes out clears the error", () => {
    const state = run(start(), opened(A), sent(A), failed(A), sent(A));
    expect(state.error).toBeNull();
    expect(state.busy).toBe(A);
  });

  it("opening or closing clears the error", () => {
    const failing = run(start(), opened(A), sent(A), failed(A));
    expect(run(failing, opened(B)).error).toBeNull();
    expect(run(failing, opened(null)).error).toBeNull();
  });

  it("is busy with the newest request until that one ends", () => {
    const state = run(start(), opened(A), sent(A), opened(B), sent(B));
    expect(state.busy).toBe(B);
    expect(run(state, ended(A)).busy).toBe(B);
    expect(run(state, ended(B)).busy).toBeNull();
  });

  it("returns the same state when nothing changes", () => {
    const state = start();
    expect(reduce(state, opened(null))).toBe(state);
    expect(reduce(state, ended(A))).toBe(state);
  });
});

// ---- Every order of two dialogs -----------------------------------------------------------------

interface World {
  log: string[];
  state: DialogRequestState<Dialog>;
  shown: Dialog | null;
  // The requests on their way, in the order they went out.
  waiting: Dialog[];
  // The requests that ended, and those that went out at all.
  sentOnce: Dialog[];
  // What the model expects after the last step.
  wantError: string | null;
  wantToasts: string[];
  budget: number;
}

function act(world: World, event: Event) {
  world.state = dialogRequestReducer(world.state, event);
}

const model: Model<World> = {
  start: () => ({
    log: [],
    state: start(),
    shown: null,
    waiting: [],
    sentOnce: [],
    wantError: null,
    wantToasts: [],
    budget: 2,
  }),
  copy: (world) => ({
    ...world,
    log: [...world.log],
    waiting: [...world.waiting],
    sentOnce: [...world.sentOnce],
    wantToasts: [...world.wantToasts],
  }),
  steps: (world) => {
    const steps: Step[] = [];
    const openStep = (dialog: Dialog | null) => ({
      label: `open ${dialog?.name ?? "nothing"}`,
      run: () => {
        act(world, opened(dialog));
        world.shown = dialog;
        world.wantError = null;
      },
    });
    if (world.shown !== null) steps.push(openStep(null));
    for (const dialog of [A, B]) {
      if (world.shown !== dialog && !world.sentOnce.includes(dialog)) steps.push(openStep(dialog));
    }
    const shown = world.shown;
    if (shown !== null && world.budget > 0 && !world.sentOnce.includes(shown)) {
      steps.push({
        label: `send ${shown.name}`,
        run: () => {
          act(world, sent(shown));
          world.waiting.push(shown);
          world.sentOnce.push(shown);
          world.budget -= 1;
          world.wantError = null;
        },
      });
    }
    for (const dialog of world.waiting) {
      const done = () => {
        world.waiting = world.waiting.filter((other) => other !== dialog);
      };
      steps.push(
        {
          label: `${dialog.name} answers`,
          run: () => {
            act(world, answered(dialog));
            act(world, ended(dialog));
            done();
            if (world.shown === dialog) {
              world.shown = null;
              world.wantError = null;
            }
          },
        },
        {
          label: `${dialog.name} fails`,
          run: () => {
            act(world, failed(dialog));
            act(world, ended(dialog));
            done();
            if (world.shown === dialog) world.wantError = "No.";
            else world.wantToasts.push("It did not work. No.");
          },
        },
        {
          label: `${dialog.name} fails and closes`,
          run: () => {
            act(world, failed(dialog, true));
            act(world, ended(dialog));
            done();
            if (world.shown === dialog) {
              world.shown = null;
              world.wantError = null;
              world.wantToasts.push("No.");
            } else {
              world.wantToasts.push("It did not work. No.");
            }
          },
        },
      );
    }
    return steps;
  },
  check: (world) => {
    expect(world.state.dialog).toBe(world.shown);
    expect(world.state.error).toBe(world.wantError);
    expect(world.state.toasts).toEqual(world.wantToasts);
    expect(world.state.busy === null || world.waiting.includes(world.state.busy)).toBe(true);
  },
  settle: (world) => {
    for (const dialog of world.waiting) {
      act(world, answered(dialog));
      act(world, ended(dialog));
      if (world.shown === dialog) {
        world.shown = null;
        world.wantError = null;
      }
    }
    world.waiting = [];
  },
  checkSettled: (world) => {
    expect(world.state.busy).toBeNull();
    expect(world.state.dialog).toBe(world.shown);
    expect(world.state.toasts).toEqual(world.wantToasts);
  },
};

describe("a dialog's request: every order of two dialogs", () => {
  it("an answer goes to its own dialog, or to one toast", () => {
    expect(everyOrder(model, 7)).toBeGreaterThan(1000);
  });
});
