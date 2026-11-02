import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library cleans up by itself only with Vitest globals, which this repository does not
// turn on.
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

// jsdom does no layout, so it has no scrollIntoView; the header calls it when an avatar gets
// focus (app-shell.md UI-2.10).
if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = () => undefined;
}
