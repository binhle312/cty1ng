import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routes/route-tree.ts";

// Links preload a page's code on hover or focus (frontend-conventions.md §4). The skeleton
// waits 200 ms by itself, so the router shows the pending page at once and keeps it no longer
// than needed.
export function createAppRouter() {
  return createRouter({
    routeTree,
    defaultPreload: "intent",
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
