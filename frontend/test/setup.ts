import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { forgetQueryClient } from "./fake-api.ts";

// Testing Library cleans up by itself only with Vitest globals, which this repository does not
// turn on. The query client of `heldAnswer` belongs to one test (DQ-115).
afterEach(() => {
  cleanup();
  window.localStorage.clear();
  forgetQueryClient();
});

// jsdom does no layout, so it has no scrollIntoView; the header calls it when an avatar gets
// focus (app-shell.md UI-2.10).
if (typeof Element.prototype.scrollIntoView !== "function") {
  Element.prototype.scrollIntoView = () => undefined;
}
