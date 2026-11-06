import { flushSync } from "react-dom";

// A key press as the browser sends it (audit row 1). In a browser, the stack is empty after each
// listener of a real key press, so React's work runs before the event goes on: a keydown that
// opens a dialog runs the dialog's effects, and the listener that the dialog adds on `document`
// sees the same event. Neither `fireEvent` nor a bare `dispatchEvent` shows this: `act()` holds the
// effects, and a dispatch from a script keeps the stack full until it ends. So this press flushes
// React after React's own listeners, where the browser would, and outside `act()`.
export async function pressKey(target: Element, init: KeyboardEventInit): Promise<void> {
  const before: unknown = Reflect.get(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", false);
  const flush = () => {
    flushSync(() => undefined);
  };
  document.body.addEventListener("keydown", flush);
  try {
    target.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }),
    );
    // What the press did settles: a dialog that closes in the same event is gone after this.
    await new Promise((resolve) => setTimeout(resolve, 50));
  } finally {
    document.body.removeEventListener("keydown", flush);
    Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", before);
  }
}
