import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library cleans up by itself only with Vitest globals, which this repository does not
// turn on.
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
