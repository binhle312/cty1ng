import { createRouter } from "@tanstack/react-router";
import { ErrorPage, logError } from "./features/placeholder/error-page.tsx";
import { routeTree } from "./routes/route-tree.ts";

// Each route match gets its own error boundary, so a page that fails shows the error screen in
// the place of that page and the shell stays (requirements/app-shell.md, "Errors"). The component
// tests use the same options (test/render-app.tsx).
export const routerErrorOptions = {
  defaultErrorComponent: ErrorPage,
  defaultOnCatch: (error: unknown) => {
    logError("page_error", error);
  },
};

// Links preload a page's code on hover or focus (frontend-conventions.md §4). The skeleton
// waits 200 ms by itself, so the router shows the pending page at once and keeps it no longer
// than needed.
export function createAppRouter() {
  return createRouter({
    routeTree,
    defaultPreload: "intent",
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
    ...routerErrorOptions,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
